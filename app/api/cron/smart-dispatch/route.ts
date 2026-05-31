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
import { createServiceClient } from '@/lib/supabase/server';

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
    const [dispatchResult, kitchenResult, staleResult, etaResult, shiftResult] = await Promise.all([
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
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg, duration_ms: Date.now() - start }, { status: 500 });
  }
}
