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
import { generateMissingRatingTokens, processPendingRatingLinks } from '@/lib/delivery/satisfaction';
import { runDelayMonitorAllLocations } from '@/lib/delivery/delay-monitor';
import { releaseScheduledOrders } from '@/lib/delivery/scheduled';
import { processAllWebhooks } from '@/lib/delivery/webhooks';
import { runDailyReportCache } from '@/lib/delivery/reporting';
import { recomputeAllLocations as recomputeEtaCalibration } from '@/lib/delivery/eta-calibration';
import { evaluateSurgeAllLocations } from '@/lib/delivery/surge';
import { processWindowDispatchAllLocations, markMissedWindows } from '@/lib/delivery/windows';
import { releaseRetryAttempts } from '@/lib/delivery/proof';
import { evaluateAutoSignalAllLocations } from '@/lib/delivery/capacity';
import { expireStaleCredits } from '@/lib/delivery/credits';
import { expireOldBroadcasts } from '@/lib/delivery/messaging';
import { processAllCustomerNotifications } from '@/lib/delivery/customer-push';
import { autoCreateIncidentsForRatings } from '@/lib/delivery/incidents';
import { snapshotAllLocations as snapshotDriverPerformance } from '@/lib/delivery/driver-performance';
import { evaluateComplianceAllLocations } from '@/lib/delivery/compliance';
import { expireStaleApplicationsAllLocations } from '@/lib/delivery/onboarding';
import { runSlaEscalationAllLocations } from '@/lib/delivery/sla-escalation';
import { processExpiredPointsAllLocations } from '@/lib/delivery/loyalty-points';
import { pruneNavCache } from '@/lib/delivery/navigation';
import { detectAndHandleNoShowsAllLocations } from '@/lib/delivery/driver-reliability';
import { processUnscoredAllLocations as processCdesAllLocations } from '@/lib/delivery/cdes';
import { generateDigestAllLocations } from '@/lib/delivery/daily-digest';
import { checkAndAwardChallengesAllLocations } from '@/lib/delivery/challenges';
import { runPositioningAllLocations } from '@/lib/delivery/positioning';
import { snapshotAllLocations as snapshotProfitability } from '@/lib/delivery/profitability';
import { analyzeChurnAllLocations, runReEngagementAllLocations } from '@/lib/delivery/churn-prevention';
import { takeSnapshotAllLocations as takeHealthSnapshots, pruneOldSnapshots } from '@/lib/delivery/health-observatory';

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
    // Daily digest: täglich um 03:00 UTC (nach Report-Cache bei 02:00)
    const isDigestTick = nowHour === 3 && nowMin < 2;
    // Churn-Analyse: täglich um 02:00 UTC (zusammen mit Report-Cache)
    // Re-Engagement: täglich um 04:00 UTC (nach Digest)
    const isChurnTick   = nowHour === 2 && nowMin < 2;
    const isReEngageTick = nowHour === 4 && nowMin < 2;

    const [dispatchResult, kitchenResult, staleResult, etaResult, shiftResult, demandResult, alertResult, recoveryResult, ratingTokensGenerated, delayResult, scheduleResult, webhookResult, reportCacheResult, etaCalibResult, surgeResult, windowResult, missedWindows, retryResult, queueSignalResult, creditsResult, broadcastsResult, customerPushResult, incidentsCreated, driverPerfResult, complianceResult, onboardingResult, slaEscalationResult, loyaltyExpireResult, navCachePruned, noShowResult, cdesResult, digestResult, challengeResult, positioningResult, profitabilityResult, churnAnalysisResult, reEngagementResult, healthObservatoryResult, healthSnapshotsPruned] = await Promise.all([
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
      // Rating-Tokens generieren + Links versenden (alle 10 Min)
      isRatingTick ? (async () => {
        try {
          const { data: locs } = await serviceSb.from('locations').select('id').eq('active', true).limit(20);
          let totalTokens = 0;
          for (const loc of locs ?? []) {
            totalTokens += await generateMissingRatingTokens(loc.id as string);
          }
          const linkResult = await processPendingRatingLinks();
          return { tokens: totalTokens, links_sent: linkResult.sent, links_processed: linkResult.processed };
        } catch { return { tokens: 0, links_sent: 0, links_processed: 0 }; }
      })() : Promise.resolve({ tokens: 0, links_sent: 0, links_processed: 0 }),
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
      // Window Booking: fällige Lieferfenster freigeben + abgelaufene als missed markieren
      processWindowDispatchAllLocations().catch(() => ({ locations: 0, released: 0 })),
      markMissedWindows().catch(() => 0),
      // Retry-Attempts: fällige Wiederholungsversuche in Dispatch-Queue freigeben
      releaseRetryAttempts().catch(() => ({ released: 0 })),
      // Queue-Signal: Küchenauslastung → Storefront-Wartezeit-Banner (jeder Tick)
      evaluateAutoSignalAllLocations().catch(() => ({ locations: 0, upgraded: 0, downgraded: 0, errors: 0 })),
      // Credits: abgelaufene Gutschriften als 'expired' markieren (stündlich ausreichend, hier jeder Tick)
      expireStaleCredits().catch(() => ({ expired: 0 })),
      // Broadcasts: abgelaufene Nachrichten (>24h) bereinigen (stündlich ausreichend, hier jeder Tick)
      expireOldBroadcasts().catch(() => ({ deleted: 0 })),
      // Customer Push: ausstehende SMS/WhatsApp-Benachrichtigungen versenden (jeder Tick)
      processAllCustomerNotifications().catch(() => ({ processed: 0, sent: 0, failed: 0, skipped: 0 })),
      // Incidents: schlechte Bewertungen (≤2★) ohne Incident nachholen (Sicherheitsnetz)
      autoCreateIncidentsForRatings().catch(() => 0),
      // Driver-Performance-Snapshots täglich um 02:00 UTC: gestrigen Tag für alle Locations
      isReportTick
        ? snapshotDriverPerformance().catch(() => ({ locations: 0, snapshots: 0, errors: 1 }))
        : Promise.resolve(null),
      // Compliance: abgelaufene Zertifikate markieren + ablaufende zählen (stündlich ausreichend)
      isReportTick || isDemandTick
        ? evaluateComplianceAllLocations().catch(() => ({ locations: 0, alertsGenerated: 0, expiredAutoUpdated: 0, errors: 1 }))
        : Promise.resolve(null),
      // Onboarding: abgelaufene pending-Bewerbungen als 'withdrawn' markieren (alle 30 Min reicht)
      isDemandTick
        ? expireStaleApplicationsAllLocations().catch(() => ({ expired: 0 }))
        : Promise.resolve(null),
      // SLA-Eskalation: kritischer Alert wenn On-Time-Rate < 80% (alle 10 Min)
      isRatingTick
        ? runSlaEscalationAllLocations().catch(() => ({ locations_checked: 0, escalated: 0, resolved: 0, below_threshold: [] }))
        : Promise.resolve(null),
      // Loyalty-Punkte: abgelaufene Punkte verfallen lassen (täglich um 02:00 UTC)
      isReportTick
        ? processExpiredPointsAllLocations().catch(() => ({ locations: 0, totalExpired: 0 }))
        : Promise.resolve(null),
      // Nav-Cache: alte Routen-Caches löschen (alle 2 Stunden)
      pruneNavCache().catch(() => 0),
      // No-Show-Erkennung: verpasste Schichten → Event + Broadcast (alle 30 Min)
      isDemandTick
        ? detectAndHandleNoShowsAllLocations().catch(() => ({ locations: 0, total_detected: 0, broadcasts_sent: 0 }))
        : Promise.resolve(null),
      // CDES: Customer Delivery Experience Score für abgeschlossene Lieferungen berechnen (alle 30 Min)
      isDemandTick
        ? processCdesAllLocations().catch(() => ({ locations: 0, totalProcessed: 0, totalRecoveries: 0, errors: 0 }))
        : Promise.resolve(null),
      // Daily Digest: täglich um 03:00 UTC — gestrigen Tag für alle Locations
      isDigestTick
        ? generateDigestAllLocations().catch(() => ({ locations: 0, generated: 0, errors: 1 }))
        : Promise.resolve(null),
      // Challenges: Fortschritt aktualisieren + abgelaufene/neue Challenges aktivieren (alle 5 Min)
      isRatingTick
        ? checkAndAwardChallengesAllLocations().catch(() => ({ locations: 0, checked: 0, progressUpdated: 0, autoCompleted: 0 }))
        : Promise.resolve(null),
      // Fahrer-Positionierung: Vorschläge generieren (alle 10 Min)
      isRatingTick
        ? runPositioningAllLocations().catch(() => ({ locations: 0, total_created: 0, total_expired: 0 }))
        : Promise.resolve(null),
      // Profitabilitäts-Snapshot: täglich um 02:00 UTC (Vortag aggregieren)
      isReportTick
        ? snapshotProfitability().catch(() => ({ locations: 0, snapshots: 0 }))
        : Promise.resolve(null),
      // Churn-Prävention: Abwanderungsrisiko täglich um 02:00 UTC analysieren
      isChurnTick
        ? analyzeChurnAllLocations().catch(() => ({ locations: 0, totalAnalyzed: 0, totalUpserted: 0 }))
        : Promise.resolve(null),
      // Re-Engagement: Gutschriften an gefährdete Kunden täglich um 04:00 UTC
      isReEngageTick
        ? runReEngagementAllLocations().catch(() => ({ locations: 0, totalEligible: 0, totalSent: 0, totalCredits: 0 }))
        : Promise.resolve(null),
      // Health-Observatory: operationale KPI-Snapshots alle 10 Min
      isRatingTick
        ? takeHealthSnapshots().catch(() => ({ locations: 0, snapshots: 0, errors: 0 }))
        : Promise.resolve(null),
      // Health-Snapshots Cleanup: Snapshots > 7 Tage löschen (täglich 02:00 UTC)
      isReportTick
        ? pruneOldSnapshots().catch(() => 0)
        : Promise.resolve(0),
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
      ...(isRatingTick ? { rating: ratingTokensGenerated } : {}),
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
      windows: {
        released: windowResult.released,
        missed_marked: missedWindows,
      },
      retry_attempts_released: retryResult.released,
      queue_signal: {
        locations: queueSignalResult.locations,
        upgraded:  queueSignalResult.upgraded,
        downgraded: queueSignalResult.downgraded,
      },
      credits_expired: creditsResult.expired,
      broadcasts_cleaned: broadcastsResult.deleted,
      customer_push: {
        processed: customerPushResult.processed,
        sent:      customerPushResult.sent,
        failed:    customerPushResult.failed,
      },
      incidents_created: incidentsCreated,
      ...(driverPerfResult ? { driver_performance_snapshots: driverPerfResult } : {}),
      ...(complianceResult ? { compliance: complianceResult } : {}),
      ...(onboardingResult ? { onboarding_expired: onboardingResult.expired } : {}),
      ...(slaEscalationResult ? { sla_escalation: { escalated: slaEscalationResult.escalated, resolved: slaEscalationResult.resolved, below_threshold: slaEscalationResult.below_threshold.length } } : {}),
      ...(loyaltyExpireResult ? { loyalty_points_expired: loyaltyExpireResult.totalExpired } : {}),
      nav_cache_pruned: navCachePruned ?? 0,
      ...(noShowResult ? { no_show_detection: { detected: noShowResult.total_detected, broadcasts_sent: noShowResult.broadcasts_sent } } : {}),
      ...(cdesResult ? { cdes: { processed: cdesResult.totalProcessed, recoveries: cdesResult.totalRecoveries } } : {}),
      ...(digestResult ? { daily_digest: { locations: digestResult.locations, generated: digestResult.generated, errors: digestResult.errors } } : {}),
      ...(challengeResult ? { challenges: { checked: challengeResult.checked, progress_updated: challengeResult.progressUpdated, auto_completed: challengeResult.autoCompleted } } : {}),
      ...(positioningResult ? { positioning: { locations: positioningResult.locations, created: positioningResult.total_created, expired: positioningResult.total_expired } } : {}),
      ...(profitabilityResult ? { profitability_snapshots: { locations: profitabilityResult.locations, snapshots: profitabilityResult.snapshots } } : {}),
      ...(churnAnalysisResult ? { churn_analysis: { locations: churnAnalysisResult.locations, analyzed: churnAnalysisResult.totalAnalyzed, upserted: churnAnalysisResult.totalUpserted } } : {}),
      ...(reEngagementResult ? { churn_re_engagement: { locations: reEngagementResult.locations, eligible: reEngagementResult.totalEligible, sent: reEngagementResult.totalSent, credits: reEngagementResult.totalCredits } } : {}),
      ...(healthObservatoryResult ? { health_observatory: { locations: healthObservatoryResult.locations, snapshots: healthObservatoryResult.snapshots, errors: healthObservatoryResult.errors } } : {}),
      ...(healthSnapshotsPruned ? { health_snapshots_pruned: healthSnapshotsPruned } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg, duration_ms: Date.now() - start }, { status: 500 });
  }
}
