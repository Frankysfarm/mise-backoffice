/**
 * lib/delivery/delay-alert-push.ts — Phase 318
 *
 * Delay-Aware Customer Push Alert Engine
 *
 * Scans active order_delay_predictions for orders with risk_level = 'critical'
 * (delay_risk_score ≥ 75) and sends a proactive 'delayed' push notification to
 * the customer if one hasn't been sent yet (dedup via delay_push_alerts).
 *
 * Public API:
 *   alertCriticalOrders(locationId)     — Scan + alert one location
 *   alertCriticalAllLocations()         — Cron batch
 *   getDelayAlertStats(locationId)      — Admin stats
 *   pruneOldDelayAlerts(daysOld)        — Cleanup
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { notifyCustomerViaPush } from './customer-web-push';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AlertBatchResult {
  locationId: string;
  alerted: number;
  suppressed: number;
  errors: number;
}

export interface DelayAlertStats {
  alertsToday: number;
  alertsTotal: number;
  suppressedTotal: number;
  criticalActiveNow: number;
  alreadyAlertedToday: number;
}

// ─── Core ─────────────────────────────────────────────────────────────────────

export async function alertCriticalOrders(locationId: string): Promise<AlertBatchResult> {
  const svc = createServiceClient();
  const result: AlertBatchResult = { locationId, alerted: 0, suppressed: 0, errors: 0 };

  // Load critical predictions for active (non-terminal) orders
  const { data: predictions } = await svc
    .from('order_delay_predictions')
    .select('id, order_id, delay_risk_score, risk_level')
    .eq('location_id', locationId)
    .eq('risk_level', 'critical')
    .is('settled_at', null)
    .limit(30);

  if (!predictions || predictions.length === 0) return result;

  const rows = predictions as Array<{
    id: string; order_id: string; delay_risk_score: number; risk_level: string;
  }>;

  // Which orders have already been alerted?
  const orderIds = rows.map(r => r.order_id);
  const { data: existing } = await svc
    .from('delay_push_alerts')
    .select('order_id')
    .in('order_id', orderIds);

  const alreadyAlerted = new Set(
    ((existing ?? []) as Array<{ order_id: string }>).map(r => r.order_id),
  );

  for (const pred of rows) {
    if (alreadyAlerted.has(pred.order_id)) {
      result.suppressed++;
      continue;
    }

    try {
      // Load order for email + status check (skip terminal orders)
      const { data: order } = await svc
        .from('customer_orders')
        .select('id, location_id, bestellnummer, kunde_email, status')
        .eq('id', pred.order_id)
        .eq('location_id', locationId)
        .maybeSingle();

      const ord = order as {
        id: string; location_id: string;
        bestellnummer: string | null;
        kunde_email: string | null;
        status: string;
      } | null;

      if (!ord) {
        result.suppressed++;
        continue;
      }

      // Skip orders already in terminal state
      if (['geliefert', 'storniert', 'abgebrochen'].includes(ord.status)) {
        await svc.from('delay_push_alerts').upsert({
          order_id:        pred.order_id,
          location_id:     locationId,
          delay_risk_score: pred.delay_risk_score,
          risk_level:      pred.risk_level,
          suppressed_reason: 'terminal_status',
        }, { onConflict: 'order_id', ignoreDuplicates: true });
        result.suppressed++;
        continue;
      }

      const trackingUrl = ord.bestellnummer ? `/track/${ord.bestellnummer}` : undefined;

      // Send push (fire-and-forget — never throws)
      await notifyCustomerViaPush(
        locationId,
        pred.order_id,
        'delayed',
        ord.kunde_email ?? undefined,
        trackingUrl,
      );

      // Record alert for dedup
      await svc.from('delay_push_alerts').upsert({
        order_id:        pred.order_id,
        location_id:     locationId,
        delay_risk_score: pred.delay_risk_score,
        risk_level:      pred.risk_level,
      }, { onConflict: 'order_id', ignoreDuplicates: true });

      result.alerted++;
    } catch {
      result.errors++;
    }
  }

  return result;
}

// ─── Cron batch ───────────────────────────────────────────────────────────────

export async function alertCriticalAllLocations(): Promise<{
  locations: number;
  alerted: number;
  errors: number;
}> {
  const svc = createServiceClient();
  const { data: locations } = await svc
    .from('locations')
    .select('id')
    .eq('active', true);

  const rows = (locations ?? []) as Array<{ id: string }>;
  let alerted = 0; let errors = 0;

  await Promise.allSettled(
    rows.map(async loc => {
      const r = await alertCriticalOrders(loc.id);
      alerted += r.alerted;
      errors  += r.errors;
    }),
  );

  return { locations: rows.length, alerted, errors };
}

// ─── Admin stats ──────────────────────────────────────────────────────────────

export async function getDelayAlertStats(locationId: string): Promise<DelayAlertStats> {
  const svc = createServiceClient();

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [todayRes, totalRes, criticalRes] = await Promise.all([
    svc.from('delay_push_alerts')
      .select('suppressed_reason', { count: 'exact' })
      .eq('location_id', locationId)
      .gte('sent_at', todayStart.toISOString()),
    svc.from('delay_push_alerts')
      .select('suppressed_reason', { count: 'exact' })
      .eq('location_id', locationId),
    svc.from('order_delay_predictions')
      .select('order_id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('risk_level', 'critical')
      .is('settled_at', null),
  ]);

  const todayRows = (todayRes.data ?? []) as Array<{ suppressed_reason: string | null }>;
  const totalRows = (totalRes.data ?? []) as Array<{ suppressed_reason: string | null }>;

  const alertsToday = todayRows.filter(r => !r.suppressed_reason).length;
  const alreadyAlertedToday = todayRows.filter(r => !!r.suppressed_reason).length;
  const suppressedTotal = totalRows.filter(r => !!r.suppressed_reason).length;
  const alertsTotal = totalRows.filter(r => !r.suppressed_reason).length;

  return {
    alertsToday,
    alertsTotal,
    suppressedTotal,
    criticalActiveNow: criticalRes.count ?? 0,
    alreadyAlertedToday,
  };
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

export async function pruneOldDelayAlerts(daysOld: number = 30): Promise<{ pruned: number }> {
  const svc = createServiceClient();
  const cutoff = new Date(Date.now() - daysOld * 86400_000).toISOString();
  const { count } = await svc
    .from('delay_push_alerts')
    .delete({ count: 'exact' })
    .lt('sent_at', cutoff);
  return { pruned: count ?? 0 };
}
