/**
 * GET /api/cron/smart-dispatch
 *
 * Vercel Cron-Endpoint: läuft alle 2 Minuten.
 * Scannt unzugewiesene Lieferbestellungen und dispatcht sie via Smart-Engine.
 *
 * Schutz: CRON_SECRET env (Vercel setzt Authorization: Bearer <secret>)
 * oder BISS_INTERNAL_TOKEN Header für Rückwärtskompatibilität.
 */
import { NextRequest, NextResponse } from 'next/server';
import { smartDispatchTick } from '@/lib/delivery/dispatch-engine';
import { syncKitchenNotifications } from '@/lib/delivery/kitchen-sync';
import { refreshEnRouteEtas } from '@/lib/delivery/eta';
import { autoCloseMissedShifts } from '@/lib/delivery/shifts';
import { snapshotAllLocations } from '@/lib/delivery/forecast';
import { evaluateAlertsAllLocations } from '@/lib/delivery/alerts';
import { scanStaleBatches } from '@/lib/delivery/recovery';
import { createServiceClient } from '@/lib/supabase/server';
import { generateMissingRatingTokens } from '@/lib/delivery/satisfaction';
import { runDelayMonitorAllLocations } from '@/lib/delivery/delay-monitor';
import { releaseScheduledOrders } from '@/lib/delivery/scheduled';
import { processAllWebhooks } from '@/lib/delivery/webhooks';
import { runDailyReportCache } from '@/lib/delivery/reporting';
import { recomputeAllLocations as recomputeEtaCalibration } from '@/lib/delivery/eta-calibration';
import { evaluateSurgeAllLocations } from '@/lib/delivery/surge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  // Vercel Cron setzt Authorization: Bearer <CRON_SECRET>
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth === `Bearer ${cronSecret}`) return true;
  }

  // Rückwärtskompatibel: x-internal-token
  const internalToken = process.env.BISS_INTERNAL_TOKEN;
  if (internalToken && internalToken.length >= 16) {
    if (req.headers.get('x-internal-token') === internalToken) return true;
  }

  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const start = Date.now();
  try {
    // Parallel: Dispatch + Küchen-Sync + Stale-Driver-Cleanup + Live-ETA-Refresh + Shift-Cleanup
    const serviceSb = createServiceClient();

    // Demand-Snapshot alle 30 Min (Minute :00 oder :30)
    const nowMin = new Date().getUTCMinutes();
    const isDemandTick = nowMin < 2 || (nowMin >= 30 && nowMin < 32);

    // Rating-Tokens alle 10 Min generieren (Minute :00, :10, :20, :30, :40, :50)
    const isRatingTick = nowMin % 10 < 2;

    // Report-Cache täglich um 02:00 UTC (Tag-Report + Wochen-Report für alle Locations)
    const nowHour       = new Date().getUTCHours();
    const isReportTick  = nowHour === 2 && nowMin < 2;

    const [dispatchResult, kitchenResult, staleResult, etaResult, shiftResult, demandResult, alertResult, recoveryResult, ratingTokensGenerated, delayResult, scheduleResult, webhookResult, reportCacheResult, etaCalibResult, surgeResult] = await Promise.all([
      smartDispatchTick(),
      syncKitchenNotifications(),
      serviceSb.rpc('mark_stale_drivers_offline').then(
        ({ data }) => ({ drivers_marked_offline: (data as number | null) ?? 0 }),
        () => ({ drivers_marked_offline: 0 }),
      ),
      refreshEnRouteEtas().catch(() => ({
        batches_processed: 0, orders_updated: 0, orders_skipped: 0, errors: 1,
      })),
      autoCloseMissedShifts().catch(() => ({ missed: 0 })),
      isDemandTick
        ? snapshotAllLocations().catch(() => ({ locations: 0, snapshots: 0 }))
        : Promise.resolve(null),
      evaluateAlertsAllLocations().catch(() => ({ locations: 0, created: 0, resolved: 0 })),
      scanStaleBatches(60).catch(() => ({ scanned: 0, recovered: [] as string[] })),
      // Rating-Tokens für kürzlich gelieferte Orders generieren
      isRatingTick ? (async () => {
        try {
          const { data: locs } = await serviceSb.from('locations').select('id').eq('active', true).limit(20);
          let total = 0;
          for (const loc of locs ?? []) {
            total += await generateMissingRatingTokens(loc.id as string);
          }
          return total;
        } catch { return 0; }
      })() : Promise.resolve(0),
      // Delay-Monitor: verspätete Lieferungen erkennen + Gutscheine erstellen
      runDelayMonitorAllLocations().catch(() => ({
        locations: 0, totalScanned: 0, totalFirstNotices: 0,
        totalCriticalNotices: 0, totalVouchers: 0,
      })),
      // Geplante Vorbestellungen freigeben wenn Küchen-Startzeit erreicht
      releaseScheduledOrders().catch(() => ({ released: 0, orders: [] as string[] })),
      // Webhook-Queue verarbeiten: Events an externe Systeme ausliefern
      processAllWebhooks().catch(() => ({ processed: 0, succeeded: 0, failed: 0, disabled: 0 })),
      // Report-Cache täglich um 02:00 UTC: Tages- + Wochen-Snapshot für alle aktiven Locations
      isReportTick
        ? runDailyReportCache().catch(() => ({ locations: 0, snapshots: 0, errors: 1 }))
        : Promise.resolve(null),
      // ETA-Kalibrierung täglich um 02:00 UTC: Faktoren aus letzten 30 Tagen neu berechnen
      isReportTick
        ? recomputeEtaCalibration().catch(() => ({ locations: 0, factorsUpdated: 0, errors: 1 }))
        : Promise.resolve(null),
      // Surge Pricing: Nachfragespitzen erkennen + Fahrer-Boni aktivieren (jeder Tick)
      evaluateSurgeAllLocations().catch(() => ({ locations: 0, activated: 0, deactivated: 0, active: 0 })),
    ]);

    const durationMs = Date.now() - start;
    return NextResponse.json({
      ok: true,
      duration_ms: durationMs,
      scanned:    dispatchResult.scanned,
      dispatched: dispatchResult.dispatched,
      bundled:    dispatchResult.bundled,
      held:       dispatchResult.held,
      escalated:  dispatchResult.escalated,
      kitchen: {
        notified: kitchenResult.notified,
        locations: kitchenResult.locations,
      },
      stale_drivers_cleaned: staleResult.drivers_marked_offline,
      eta_refresh: {
        batches: etaResult.batches_processed,
        updated: etaResult.orders_updated,
      },
      shifts_closed: shiftResult.missed,
      alerts: {
        created:  alertResult.created,
        resolved: alertResult.resolved,
      },
      ...(demandResult ? { demand_snapshot: demandResult } : {}),
      recovery: {
        batches_scanned: recoveryResult.scanned,
        batches_recovered: recoveryResult.recovered.length,
      },
      ...(isRatingTick ? { rating_tokens_generated: ratingTokensGenerated } : {}),
      delay_monitor: {
        scanned:          delayResult.totalScanned,
        first_notices:    delayResult.totalFirstNotices,
        critical_notices: delayResult.totalCriticalNotices,
        vouchers_created: delayResult.totalVouchers,
      },
      scheduled_releases: scheduleResult.released,
      webhooks: {
        processed: webhookResult.processed,
        succeeded: webhookResult.succeeded,
        failed:    webhookResult.failed,
      },
      ...(reportCacheResult ? { report_cache: reportCacheResult } : {}),
      ...(etaCalibResult ? { eta_calibration: etaCalibResult } : {}),
      surge: {
        locations: surgeResult.locations,
        activated: surgeResult.activated,
        deactivated: surgeResult.deactivated,
        active: surgeResult.active,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg, duration_ms: Date.now() - start }, { status: 500 });
  }
}
