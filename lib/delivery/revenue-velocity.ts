/**
 * lib/delivery/revenue-velocity.ts — Phase 312
 *
 * Revenue Velocity Engine:
 * - Stündliche Umsatz-Snapshots je Location
 * - Heute vs. Gestern vs. Vorwoche Vergleich
 * - Schicht-Hochrechnung (Pace × verbleibende Stunden)
 * - Cron-Batch alle 10 Min
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface RevenueVelocityHour {
  hourBucket:    string; // ISO
  revenueEur:    number;
  ordersCount:   number;
  avgOrderValue: number | null;
  velocityEurH:  number | null;
  deliveryCount: number;
  pickupCount:   number;
}

export interface RevenueVelocityComparison {
  hour:         number; // 0–23
  today:        number | null;
  yesterday:    number | null;
  lastWeek:     number | null;
}

export interface RevenueVelocityDashboard {
  locationId:        string;
  snappedAt:         string;
  // KPIs Heute
  todayRevenue:      number;
  todayOrders:       number;
  avgOrderValue:     number | null;
  currentVelocity:   number | null;  // Umsatz der letzten Stunde
  peakVelocity:      number | null;
  deliveryShare:     number;         // % Lieferungen vs. Gesamt
  // Trend
  revenueDeltaPct:   number | null;  // vs. Gestern
  ordersDeltaPct:    number | null;
  // Prognose
  shiftProjection:   number | null;  // Hochrechnung bis Schichtende
  paceLabel:         'ahead' | 'on_track' | 'behind' | 'no_data';
  // Chart-Daten
  hourlyToday:       RevenueVelocityHour[];
  comparison:        RevenueVelocityComparison[];
}

// ─── 1. Stündlicher Snapshot ──────────────────────────────────────────────────

export async function snapshotRevenueVelocity(locationId: string): Promise<RevenueVelocityHour> {
  const sb = createServiceClient();

  const now       = new Date();
  const hourStart = new Date(now);
  hourStart.setMinutes(0, 0, 0);
  const hourEnd   = new Date(hourStart);
  hourEnd.setHours(hourStart.getHours() + 1);

  const { data: orders } = await sb
    .from('customer_orders')
    .select('id, total_eur, typ, status')
    .eq('location_id', locationId)
    .gte('created_at', hourStart.toISOString())
    .lt('created_at', hourEnd.toISOString())
    .in('status', ['bestätigt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert', 'abgeschlossen', 'abgeholt']);

  const rows = orders ?? [];
  const revenueEur   = rows.reduce((s, o) => s + Number(o.total_eur ?? 0), 0);
  const ordersCount  = rows.length;
  const deliveryCount = rows.filter((o) => o.typ === 'lieferung').length;
  const pickupCount   = rows.filter((o) => o.typ === 'abholung').length;
  const avgOrderValue = ordersCount > 0 ? Math.round((revenueEur / ordersCount) * 100) / 100 : null;

  const snap: RevenueVelocityHour = {
    hourBucket:    hourStart.toISOString(),
    revenueEur:    Math.round(revenueEur * 100) / 100,
    ordersCount,
    avgOrderValue,
    velocityEurH:  Math.round(revenueEur * 100) / 100, // 1-h slot = velocity = revenue
    deliveryCount,
    pickupCount,
  };

  // Upsert
  await sb.from('revenue_velocity_snapshots').upsert(
    {
      location_id:     locationId,
      hour_bucket:     snap.hourBucket,
      revenue_eur:     snap.revenueEur,
      orders_count:    snap.ordersCount,
      avg_order_value: snap.avgOrderValue,
      velocity_eur_h:  snap.velocityEurH,
      delivery_count:  snap.deliveryCount,
      pickup_count:    snap.pickupCount,
    },
    { onConflict: 'location_id,hour_bucket' },
  );

  return snap;
}

// ─── 2. Cron-Batch ────────────────────────────────────────────────────────────

export async function snapshotRevenueVelocityAllLocations(): Promise<{
  locations: number;
  snapshots: number;
  errors:    number;
}> {
  const sb = createServiceClient();
  const { data: locs } = await sb.from('locations').select('id').eq('active', true);
  let snapshots = 0; let errors = 0;
  await Promise.allSettled(
    (locs ?? []).map(async (loc) => {
      try {
        await snapshotRevenueVelocity(loc.id as string);
        snapshots++;
      } catch { errors++; }
    }),
  );
  return { locations: (locs ?? []).length, snapshots, errors };
}

// ─── 3. Dashboard ─────────────────────────────────────────────────────────────

export async function getRevenueVelocityDashboard(
  locationId: string,
): Promise<RevenueVelocityDashboard> {
  const sb = createServiceClient();

  const todayStart     = new Date(); todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const lastWeekStart  = new Date(todayStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd    = new Date(lastWeekStart); lastWeekEnd.setDate(lastWeekEnd.getDate() + 1);

  const [todayRows, yesterdayRows, lastWeekRows] = await Promise.all([
    sb
      .from('revenue_velocity_snapshots')
      .select('hour_bucket, revenue_eur, orders_count, avg_order_value, velocity_eur_h, delivery_count, pickup_count')
      .eq('location_id', locationId)
      .gte('hour_bucket', todayStart.toISOString())
      .order('hour_bucket', { ascending: true }),
    sb
      .from('revenue_velocity_snapshots')
      .select('hour_bucket, revenue_eur, orders_count')
      .eq('location_id', locationId)
      .gte('hour_bucket', yesterdayStart.toISOString())
      .lt('hour_bucket', todayStart.toISOString())
      .order('hour_bucket', { ascending: true }),
    sb
      .from('revenue_velocity_snapshots')
      .select('hour_bucket, revenue_eur, orders_count')
      .eq('location_id', locationId)
      .gte('hour_bucket', lastWeekStart.toISOString())
      .lt('hour_bucket', lastWeekEnd.toISOString())
      .order('hour_bucket', { ascending: true }),
  ]);

  const today     = (todayRows.data ?? []) as { hour_bucket: string; revenue_eur: number; orders_count: number; avg_order_value: number | null; velocity_eur_h: number | null; delivery_count: number; pickup_count: number }[];
  const yesterday = (yesterdayRows.data ?? []) as { hour_bucket: string; revenue_eur: number; orders_count: number }[];
  const lastWeek  = (lastWeekRows.data ?? []) as { hour_bucket: string; revenue_eur: number; orders_count: number }[];

  // KPIs Heute
  const todayRevenue  = today.reduce((s, r) => s + Number(r.revenue_eur), 0);
  const todayOrders   = today.reduce((s, r) => s + Number(r.orders_count), 0);
  const deliveryTotal = today.reduce((s, r) => s + Number(r.delivery_count), 0);
  const pickupTotal   = today.reduce((s, r) => s + Number(r.pickup_count), 0);
  const totalTypes    = deliveryTotal + pickupTotal;
  const deliveryShare = totalTypes > 0 ? Math.round((deliveryTotal / totalTypes) * 100) : 0;

  const avgOrderValue  = todayOrders > 0 ? Math.round((todayRevenue / todayOrders) * 100) / 100 : null;
  const peakVelocity   = today.length > 0 ? Math.max(...today.map((r) => Number(r.velocity_eur_h ?? 0))) : null;
  const lastSnap       = today[today.length - 1];
  const currentVelocity = lastSnap ? Number(lastSnap.velocity_eur_h ?? 0) : null;

  // Trend vs. Gestern (selbe Stunden)
  const currentHour    = new Date().getHours();
  const yesterdaySoFar = yesterday.filter((r) => new Date(r.hour_bucket).getHours() <= currentHour);
  const ydRevenue      = yesterdaySoFar.reduce((s, r) => s + Number(r.revenue_eur), 0);
  const ydOrders       = yesterdaySoFar.reduce((s, r) => s + Number(r.orders_count), 0);
  const revDelta       = ydRevenue > 0 ? Math.round(((todayRevenue - ydRevenue) / ydRevenue) * 1000) / 10 : null;
  const ordDelta       = ydOrders  > 0 ? Math.round(((todayOrders  - ydOrders)  / ydOrders)  * 1000) / 10 : null;

  // Schicht-Prognose (einfach: Pace × 8h-Fenster)
  const shiftHoursTotal   = 8;
  const shiftStart        = new Date(todayStart); shiftStart.setHours(10, 0, 0, 0); // 10 Uhr UTC
  const hoursElapsed      = Math.max(0, (Date.now() - shiftStart.getTime()) / 3_600_000);
  const hoursRemaining    = Math.max(0, shiftHoursTotal - hoursElapsed);
  const pace              = hoursElapsed > 0 ? todayRevenue / hoursElapsed : 0;
  const shiftProjection   = hoursElapsed > 0 ? Math.round((todayRevenue + pace * hoursRemaining) * 100) / 100 : null;

  let paceLabel: RevenueVelocityDashboard['paceLabel'] = 'no_data';
  if (revDelta !== null) {
    if      (revDelta >= 10)  paceLabel = 'ahead';
    else if (revDelta >= -5)  paceLabel = 'on_track';
    else                      paceLabel = 'behind';
  }

  // Stunden-Chart Heute
  const hourlyToday: RevenueVelocityHour[] = today.map((r) => ({
    hourBucket:    r.hour_bucket,
    revenueEur:    Number(r.revenue_eur),
    ordersCount:   Number(r.orders_count),
    avgOrderValue: r.avg_order_value != null ? Number(r.avg_order_value) : null,
    velocityEurH:  r.velocity_eur_h  != null ? Number(r.velocity_eur_h)  : null,
    deliveryCount: Number(r.delivery_count),
    pickupCount:   Number(r.pickup_count),
  }));

  // Vergleichs-Chart (alle 24 Stunden)
  const byHour = (rows: { hour_bucket: string; revenue_eur: number }[]) => {
    const m: Record<number, number> = {};
    for (const r of rows) m[new Date(r.hour_bucket).getHours()] = Number(r.revenue_eur);
    return m;
  };
  const todayMap     = byHour(today);
  const ydMap        = byHour(yesterday);
  const lwMap        = byHour(lastWeek);

  const comparison: RevenueVelocityComparison[] = Array.from({ length: 24 }, (_, h) => ({
    hour:      h,
    today:     todayMap[h]   ?? null,
    yesterday: ydMap[h]      ?? null,
    lastWeek:  lwMap[h]      ?? null,
  }));

  return {
    locationId,
    snappedAt:      new Date().toISOString(),
    todayRevenue:   Math.round(todayRevenue * 100) / 100,
    todayOrders,
    avgOrderValue,
    currentVelocity,
    peakVelocity:   peakVelocity != null ? Math.round(peakVelocity * 100) / 100 : null,
    deliveryShare,
    revenueDeltaPct: revDelta,
    ordersDeltaPct:  ordDelta,
    shiftProjection,
    paceLabel,
    hourlyToday,
    comparison,
  };
}

// ─── 4. Prune ─────────────────────────────────────────────────────────────────

export async function pruneRevenueVelocitySnapshots(daysOld = 30): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const { error } = await sb.rpc('prune_revenue_velocity_snapshots', { days_old: daysOld });
  return { pruned: error ? 0 : 1 };
}
