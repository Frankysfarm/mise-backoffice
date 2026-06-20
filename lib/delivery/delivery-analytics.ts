/**
 * lib/delivery/delivery-analytics.ts
 *
 * Phase 320: Delivery Analytics Dashboard Engine
 *
 * Aggregierte Lieferkennzahlen täglich pro Location:
 *   Lieferrate, ø Lieferzeit, SLA-Einhaltung, Stornoquote, Umsatz/Lieferung, Top-Fahrer
 *
 * Public API:
 *   computeAnalyticsSnapshot(locationId, date) — KPIs für einen Tag berechnen
 *   snapshotAllLocations()                     — Cron-Batch: Vortag aller aktiven Locations
 *   getAnalyticsDashboard(locationId)          — Live-KPIs + 30-Tage-Trend + Top-Fahrer
 *   pruneOldSnapshots(daysToKeep)              — Cleanup über RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalyticsSnapshot {
  locationId:             string;
  analyticsDate:          string;      // YYYY-MM-DD
  totalOrders:            number;
  deliveryOrders:         number;
  completedDeliveries:    number;
  cancelledOrders:        number;
  deliveryRate:           number | null;  // %
  avgDeliveryMin:         number | null;
  slaTotal:               number;
  slaOnTime:              number;
  slaCompliancePct:       number | null;  // %
  cancellationRate:       number | null;  // %
  totalRevenueEur:        number | null;
  revenuePerDeliveryEur:  number | null;
  activeDrivers:          number;
}

export interface TopDriver {
  driverId:       string;
  name:           string | null;
  vehicle:        string | null;
  deliveries:     number;
  onTimePct:      number | null;
  avgDeliveryMin: number | null;
  totalEur:       number | null;
}

export interface WeekComparison {
  thisWeekDeliveries:    number;
  lastWeekDeliveries:    number;
  thisWeekSlaAvgPct:     number | null;
  lastWeekSlaAvgPct:     number | null;
  thisWeekAvgMinutes:    number | null;
  lastWeekAvgMinutes:    number | null;
  deliveriesDeltaPct:    number | null;
  slaDeltaPct:           number | null;
  minutesDeltaPct:       number | null;
}

export interface AnalyticsDashboard {
  today:          AnalyticsSnapshot;
  trend30:        AnalyticsSnapshot[];  // letzte 30 Tage aus snapshots (neueste zuerst)
  topDrivers:     TopDriver[];
  weekComparison: WeekComparison;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(a: number, b: number): number | null {
  if (b === 0) return null;
  return Math.round((a / b) * 10000) / 100;
}

function round2(v: number | null): number | null {
  if (v == null) return null;
  return Math.round(v * 100) / 100;
}

function deltaPct(next: number | null, prev: number | null): number | null {
  if (prev == null || next == null || prev === 0) return null;
  return round2(((next - prev) / prev) * 100);
}

// ─── Snapshot-Berechnung ──────────────────────────────────────────────────────

export async function computeAnalyticsSnapshot(
  locationId: string,
  date: string,   // YYYY-MM-DD (Berlin → UTC-Fenster vom Vortag reicht für DE)
): Promise<AnalyticsSnapshot> {
  const svc = createServiceClient();

  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd   = `${date}T23:59:59.999Z`;

  // Alle Bestellungen des Tages
  const { data: orders } = await svc
    .from('customer_orders')
    .select('id, bestellart, status, gesamtbetrag, geliefert_am, dispatched_at, eta_latest')
    .eq('location_id', locationId)
    .gte('bestellt_am', dayStart)
    .lte('bestellt_am', dayEnd)
    .limit(5000);

  const rows = (orders ?? []) as {
    id: string;
    bestellart: string;
    status: string;
    gesamtbetrag: number | null;
    geliefert_am: string | null;
    dispatched_at: string | null;
    eta_latest: string | null;
  }[];

  const totalOrders       = rows.length;
  const deliveryRows      = rows.filter((r) => r.bestellart === 'lieferung');
  const deliveryOrders    = deliveryRows.length;
  const completedDeliveries = deliveryRows.filter((r) => r.status === 'geliefert').length;
  const cancelledOrders   = rows.filter((r) => r.status === 'storniert').length;
  const deliveryRate      = pct(completedDeliveries, deliveryOrders);
  const cancellationRate  = pct(cancelledOrders, totalOrders);

  // Ø Lieferzeit: Abholung (dispatched_at) → Übergabe (geliefert_am)
  const deliveryTimes: number[] = [];
  for (const r of deliveryRows) {
    if (r.status === 'geliefert' && r.dispatched_at && r.geliefert_am) {
      const mins = (new Date(r.geliefert_am).getTime() - new Date(r.dispatched_at).getTime()) / 60000;
      if (mins > 0 && mins < 300) deliveryTimes.push(mins);
    }
  }
  const avgDeliveryMin = deliveryTimes.length > 0
    ? round2(deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length)
    : null;

  // SLA-Compliance: geliefert_am <= eta_latest
  const slaRows = deliveryRows.filter((r) => r.status === 'geliefert' && r.eta_latest);
  const slaTotal = slaRows.length;
  const slaOnTime = slaRows.filter((r) =>
    r.geliefert_am && r.eta_latest &&
    new Date(r.geliefert_am) <= new Date(r.eta_latest),
  ).length;
  const slaCompliancePct = pct(slaOnTime, slaTotal);

  // Umsatz
  const totalRevenueEur = deliveryRows
    .filter((r) => r.status === 'geliefert')
    .reduce((s, r) => s + (r.gesamtbetrag ?? 0), 0);
  const revenuePerDeliveryEur = completedDeliveries > 0
    ? round2(totalRevenueEur / completedDeliveries)
    : null;

  // Aktive Fahrer (min. 1 gelieferte Bestellung)
  const { data: batchData } = await svc
    .from('delivery_batches')
    .select('driver_id')
    .eq('location_id', locationId)
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd)
    .not('driver_id', 'is', null)
    .limit(500);

  const activeDrivers = new Set(
    (batchData ?? []).map((b: { driver_id: string | null }) => b.driver_id).filter(Boolean),
  ).size;

  return {
    locationId,
    analyticsDate: date,
    totalOrders,
    deliveryOrders,
    completedDeliveries,
    cancelledOrders,
    deliveryRate,
    avgDeliveryMin,
    slaTotal,
    slaOnTime,
    slaCompliancePct,
    cancellationRate,
    totalRevenueEur: round2(totalRevenueEur),
    revenuePerDeliveryEur,
    activeDrivers,
  };
}

// ─── Top-Fahrer ───────────────────────────────────────────────────────────────

async function getTopDrivers(
  locationId: string,
  sinceDate: string,  // YYYY-MM-DD
): Promise<TopDriver[]> {
  const svc = createServiceClient();

  // Bestellungen der letzten 7 Tage mit Fahrer-Daten
  const { data: orders } = await svc
    .from('customer_orders')
    .select('driver_id, status, gesamtbetrag, geliefert_am, dispatched_at, eta_latest')
    .eq('location_id', locationId)
    .eq('bestellart', 'lieferung')
    .gte('bestellt_am', `${sinceDate}T00:00:00.000Z`)
    .not('driver_id', 'is', null)
    .limit(2000);

  const rows = (orders ?? []) as {
    driver_id: string;
    status: string;
    gesamtbetrag: number | null;
    geliefert_am: string | null;
    dispatched_at: string | null;
    eta_latest: string | null;
  }[];

  // Fahrer-Aggregation
  const byDriver = new Map<string, {
    deliveries: number;
    onTime: number;
    slaTotal: number;
    deliveryMins: number[];
    totalEur: number;
  }>();

  for (const r of rows) {
    if (r.status !== 'geliefert') continue;
    const key = r.driver_id;
    if (!byDriver.has(key)) byDriver.set(key, { deliveries: 0, onTime: 0, slaTotal: 0, deliveryMins: [], totalEur: 0 });
    const acc = byDriver.get(key)!;
    acc.deliveries++;
    acc.totalEur += r.gesamtbetrag ?? 0;
    if (r.eta_latest) {
      acc.slaTotal++;
      if (r.geliefert_am && new Date(r.geliefert_am) <= new Date(r.eta_latest)) acc.onTime++;
    }
    if (r.dispatched_at && r.geliefert_am) {
      const mins = (new Date(r.geliefert_am).getTime() - new Date(r.dispatched_at).getTime()) / 60000;
      if (mins > 0 && mins < 300) acc.deliveryMins.push(mins);
    }
  }

  if (byDriver.size === 0) return [];

  // Fahrernamen aus employees
  const driverIds = Array.from(byDriver.keys());
  const { data: empRows } = await svc
    .from('employees')
    .select('id, name, fahrzeug')
    .in('id', driverIds)
    .limit(50);

  const nameMap = new Map(
    (empRows ?? []).map((e: { id: string; name: string | null; fahrzeug: string | null }) => [
      e.id,
      { name: e.name, vehicle: e.fahrzeug },
    ]),
  );

  const result: TopDriver[] = Array.from(byDriver.entries()).map(([driverId, acc]) => ({
    driverId,
    name:           nameMap.get(driverId)?.name ?? null,
    vehicle:        nameMap.get(driverId)?.vehicle ?? null,
    deliveries:     acc.deliveries,
    onTimePct:      pct(acc.onTime, acc.slaTotal),
    avgDeliveryMin: acc.deliveryMins.length > 0
      ? round2(acc.deliveryMins.reduce((a, b) => a + b, 0) / acc.deliveryMins.length)
      : null,
    totalEur:       round2(acc.totalEur),
  }));

  return result.sort((a, b) => b.deliveries - a.deliveries).slice(0, 10);
}

// ─── Wochenvergleich ──────────────────────────────────────────────────────────

function buildWeekComparison(trend: AnalyticsSnapshot[]): WeekComparison {
  // trend ist neueste-zuerst
  const thisWeek  = trend.slice(0, 7);
  const lastWeek  = trend.slice(7, 14);

  const sum = (arr: AnalyticsSnapshot[], key: keyof AnalyticsSnapshot) =>
    arr.reduce((s, r) => s + ((r[key] as number | null) ?? 0), 0);

  const avg = (arr: AnalyticsSnapshot[], key: keyof AnalyticsSnapshot) => {
    const vals = arr.map((r) => r[key] as number | null).filter((v): v is number => v != null);
    if (vals.length === 0) return null;
    return round2(vals.reduce((a, b) => a + b, 0) / vals.length);
  };

  const thisDeliveries = sum(thisWeek, 'completedDeliveries');
  const lastDeliveries = sum(lastWeek, 'completedDeliveries');
  const thisSla        = avg(thisWeek, 'slaCompliancePct');
  const lastSla        = avg(lastWeek, 'slaCompliancePct');
  const thisMin        = avg(thisWeek, 'avgDeliveryMin');
  const lastMin        = avg(lastWeek, 'avgDeliveryMin');

  return {
    thisWeekDeliveries:  thisDeliveries,
    lastWeekDeliveries:  lastDeliveries,
    thisWeekSlaAvgPct:   thisSla,
    lastWeekSlaAvgPct:   lastSla,
    thisWeekAvgMinutes:  thisMin,
    lastWeekAvgMinutes:  lastMin,
    deliveriesDeltaPct:  deltaPct(thisDeliveries, lastDeliveries),
    slaDeltaPct:         deltaPct(thisSla, lastSla),
    minutesDeltaPct:     deltaPct(thisMin, lastMin),
  };
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getAnalyticsDashboard(locationId: string): Promise<AnalyticsDashboard> {
  const svc = createServiceClient();

  // Heute live
  const today = new Date().toISOString().slice(0, 10);
  const liveSnapshot = await computeAnalyticsSnapshot(locationId, today);

  // 30-Tage-Trend aus Snapshots
  const { data: snapshotRows } = await svc
    .from('delivery_analytics_snapshots')
    .select('*')
    .eq('location_id', locationId)
    .order('analytics_date', { ascending: false })
    .limit(30);

  const trend30: AnalyticsSnapshot[] = (snapshotRows ?? []).map((r: Record<string, unknown>) => ({
    locationId:             r.location_id as string,
    analyticsDate:          r.analytics_date as string,
    totalOrders:            (r.total_orders as number) ?? 0,
    deliveryOrders:         (r.delivery_orders as number) ?? 0,
    completedDeliveries:    (r.completed_deliveries as number) ?? 0,
    cancelledOrders:        (r.cancelled_orders as number) ?? 0,
    deliveryRate:           r.delivery_rate as number | null,
    avgDeliveryMin:         r.avg_delivery_min as number | null,
    slaTotal:               (r.sla_total as number) ?? 0,
    slaOnTime:              (r.sla_on_time as number) ?? 0,
    slaCompliancePct:       r.sla_compliance_pct as number | null,
    cancellationRate:       r.cancellation_rate as number | null,
    totalRevenueEur:        r.total_revenue_eur as number | null,
    revenuePerDeliveryEur:  r.revenue_per_delivery_eur as number | null,
    activeDrivers:          (r.active_drivers as number) ?? 0,
  }));

  // Top-Fahrer: letzte 7 Tage
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const topDrivers = await getTopDrivers(locationId, sevenDaysAgo);

  const weekComparison = buildWeekComparison(trend30);

  return { today: liveSnapshot, trend30, topDrivers, weekComparison };
}

// ─── Cron-Batch ───────────────────────────────────────────────────────────────

export async function snapshotAllLocations(): Promise<{
  locations: number;
  snapshots: number;
  errors: number;
}> {
  const svc = createServiceClient();
  const { data: locs } = await svc
    .from('locations')
    .select('id')
    .eq('active', true)
    .limit(50);

  if (!locs?.length) return { locations: 0, snapshots: 0, errors: 0 };

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let snapshots = 0;
  let errors    = 0;

  await Promise.allSettled(
    locs.map(async (loc: { id: string }) => {
      try {
        const snap = await computeAnalyticsSnapshot(loc.id, yesterday);
        const { error } = await svc
          .from('delivery_analytics_snapshots')
          .upsert({
            location_id:              snap.locationId,
            analytics_date:           snap.analyticsDate,
            total_orders:             snap.totalOrders,
            delivery_orders:          snap.deliveryOrders,
            completed_deliveries:     snap.completedDeliveries,
            cancelled_orders:         snap.cancelledOrders,
            delivery_rate:            snap.deliveryRate,
            avg_delivery_min:         snap.avgDeliveryMin,
            sla_total:                snap.slaTotal,
            sla_on_time:              snap.slaOnTime,
            sla_compliance_pct:       snap.slaCompliancePct,
            cancellation_rate:        snap.cancellationRate,
            total_revenue_eur:        snap.totalRevenueEur,
            revenue_per_delivery_eur: snap.revenuePerDeliveryEur,
            active_drivers:           snap.activeDrivers,
          }, { onConflict: 'location_id,analytics_date' });
        if (error) { errors++; } else { snapshots++; }
      } catch { errors++; }
    }),
  );

  return { locations: locs.length, snapshots, errors };
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

export async function pruneOldSnapshots(daysToKeep = 90): Promise<{ pruned: number }> {
  const svc = createServiceClient();
  const { data, error } = await svc.rpc('prune_delivery_analytics', { days_old: daysToKeep });
  if (error) return { pruned: 0 };
  return { pruned: (data as number) ?? 0 };
}
