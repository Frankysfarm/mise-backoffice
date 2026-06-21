/**
 * lib/delivery/executive-dashboard.ts — Phase 396 Backend
 *
 * Executive KPI Aggregator: fasst alle relevanten KPI-Streams zu einem
 * Gesamtbild je Standort zusammen.
 *
 * Live-Quellen (für /api/delivery/admin/executive-dashboard?action=live):
 *   - customer_orders        → Umsatz, Bestellzahl, Stornoquote
 *   - delivery_performance   → Ø Lieferzeit, On-Time-Rate
 *   - mise_drivers           → Fahrer online / aktiv
 *   - ops_health_snapshots   → letzter Ops-Health-Score
 *   - schicht_roi_daily      → Nettomarge (letzter Snapshot)
 *   - driver_score_daily     → Ø Fahrerscore (letzter Snapshot)
 *   - driver_capacity_snapshots → Kapazitätsstatus
 *
 * Snapshot-Quellen (für Tages-Snapshots in executive_kpi_snapshots):
 *   Dieselben Tabellen, aber für einen abgeschlossenen Tag aggregiert.
 *
 * Public API:
 *   getExecutiveDashboard(locationId)          — Live-KPIs + letzter Snapshot
 *   snapshotExecutiveKpi(locationId, date?)    — Tages-Snapshot berechnen + speichern
 *   snapshotExecutiveKpiAllLocations(date?)    — Cron-Batch alle Standorte
 *   getExecutiveKpiHistory(locationId, days)   — Trend-Daten für LineCharts
 *   pruneExecutiveKpiSnapshots(daysToKeep)     — Cleanup alter Snapshots
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export interface ExecutiveLiveKpi {
  locationId:          string;
  asOf:                string;

  // Umsatz & Volumen (heute)
  revenueEur:          number;
  deliveryCount:       number;
  avgOrderValueEur:    number | null;

  // Lieferperformance (rollend 24 h)
  avgDeliveryMin:      number | null;
  onTimePct:           number | null;
  cancelledCount:      number;
  cancellationRatePct: number | null;

  // Fahrer
  driversOnline:       number;
  driversActive:       number;
  ordersPerDriver:     number | null;

  // Ops-Health (letzter Snapshot)
  opsHealthScore:      number | null;
  opsHealthLevel:      'critical' | 'warning' | 'ok' | 'unknown';

  // Schicht-ROI (letzter Daily-Snapshot)
  netMarginEur:        number | null;
  netMarginPct:        number | null;
  costPerDeliveryEur:  number | null;
  revenuePerDriverH:   number | null;

  // Fahrer-Score (letzter Daily-Snapshot)
  avgDriverScore:      number | null;
  driversGradeAPct:    number | null;

  // Kapazität
  capacityStatus:      string | null;
  capacityLoadPct:     number | null;
}

export interface ExecutiveKpiSnapshot {
  locationId:          string;
  snapshotDate:        string;
  revenueEur:          number;
  deliveryCount:       number;
  avgOrderValueEur:    number | null;
  avgDeliveryMin:      number | null;
  onTimePct:           number | null;
  cancelledCount:      number;
  cancellationRatePct: number | null;
  activeDriverCount:   number;
  onlineDriverCount:   number;
  ordersPerDriver:     number | null;
  avgOpsHealthScore:   number | null;
  minOpsHealthScore:   number | null;
  netMarginEur:        number | null;
  netMarginPct:        number | null;
  costPerDeliveryEur:  number | null;
  revenuePerDriverH:   number | null;
  avgDriverScore:      number | null;
  driversGradeAPct:    number | null;
  capacityStatus:      string | null;
}

export interface SnapshotResult {
  locationId:   string;
  snapshotDate: string;
  saved:        boolean;
  revenueEur:   number;
  deliveryCount: number;
}

export interface AllLocationsResult {
  locations: number;
  saved:     number;
  errors:    number;
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

function toLocalDate(utcDate: Date, offsetH = 2): string {
  const local = new Date(utcDate.getTime() + offsetH * 3_600_000);
  return local.toISOString().slice(0, 10);
}

function dateRangeUtc(berlinDate: string): { from: string; to: string } {
  const from = new Date(`${berlinDate}T00:00:00+01:00`);
  const to   = new Date(`${berlinDate}T23:59:59+02:00`);
  return { from: from.toISOString(), to: to.toISOString() };
}

function opsHealthLevel(score: number | null): 'critical' | 'warning' | 'ok' | 'unknown' {
  if (score === null) return 'unknown';
  if (score < 40)    return 'critical';
  if (score < 65)    return 'warning';
  return 'ok';
}

// ── Live-KPIs ─────────────────────────────────────────────────────────────────

export async function getExecutiveDashboard(locationId: string): Promise<ExecutiveLiveKpi> {
  const svc = createServiceClient();
  const now = new Date();
  const todayStr = toLocalDate(now);
  const { from: dayFrom, to: dayTo } = dateRangeUtc(todayStr);

  // Alle Queries parallel
  const [
    ordersRes,
    cancelledRes,
    perfRes,
    driversRes,
    opsRes,
    roiRes,
    scoreRes,
    capacityRes,
  ] = await Promise.all([
    // Heute abgeschlossene Lieferbestellungen
    svc.from('customer_orders')
      .select('gesamtbetrag, liefergebuehr')
      .eq('location_id', locationId)
      .eq('bestellart', 'lieferung')
      .in('status', ['geliefert', 'abgeschlossen'])
      .gte('bestellt_am', dayFrom)
      .lte('bestellt_am', dayTo),

    // Heute stornierte Bestellungen
    svc.from('customer_orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('bestellart', 'lieferung')
      .in('status', ['storniert', 'abgebrochen'])
      .gte('bestellt_am', dayFrom)
      .lte('bestellt_am', dayTo),

    // Delivery Performance (letzter Eintrag)
    svc.from('delivery_performance')
      .select('avg_delivery_min, on_time_pct')
      .eq('location_id', locationId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Fahrer online / aktiv
    svc.from('mise_drivers')
      .select('is_online, is_available')
      .eq('location_id', locationId),

    // Ops-Health letzter Snapshot
    svc.from('ops_health_snapshots')
      .select('health_score')
      .eq('location_id', locationId)
      .order('snapped_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Schicht-ROI letzter Tages-Snapshot
    svc.from('schicht_roi_daily')
      .select('net_margin_eur, net_margin_pct, cost_per_delivery, revenue_per_driver_hour')
      .eq('location_id', locationId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Fahrer-Score letzter Tages-Snapshot (avg + Grade-A-Anteil)
    svc.from('driver_score_daily')
      .select('composite_score, grade')
      .eq('location_id', locationId)
      .eq('snapshot_date', todayStr),

    // Kapazitäts-Snapshot
    svc.from('driver_capacity_snapshots')
      .select('capacity_status, load_pct')
      .eq('location_id', locationId)
      .maybeSingle(),
  ]);

  type OrderRow  = { gesamtbetrag: number | null };
  type DriverRow = { is_online: boolean | null; is_available: boolean | null };
  type ScoreRow  = { composite_score: number | null; grade: string | null };

  const orders      = (ordersRes.data     ?? []) as OrderRow[];
  const drivers     = (driversRes.data    ?? []) as DriverRow[];
  const scoreRows   = (scoreRes.data      ?? []) as ScoreRow[];
  const cancelledCt = cancelledRes.count  ?? 0;

  const revenueEur    = orders.reduce((s, o) => s + Number(o.gesamtbetrag ?? 0), 0);
  const deliveryCount = orders.length;
  const totalOrders   = deliveryCount + cancelledCt;

  const driversOnline = drivers.filter(d => d.is_online).length;
  const driversActive = drivers.filter(d => d.is_online && !d.is_available).length;

  const avgScore = scoreRows.length > 0
    ? scoreRows.reduce((s, r) => s + Number(r.composite_score ?? 0), 0) / scoreRows.length
    : null;
  const gradeAPct = scoreRows.length > 0
    ? (scoreRows.filter(r => r.grade === 'A' || r.grade === 'A+').length / scoreRows.length) * 100
    : null;

  const roi = roiRes.data;
  const ops = opsRes.data;
  const cap = capacityRes.data;

  return {
    locationId,
    asOf: now.toISOString(),
    revenueEur:          Math.round(revenueEur * 100) / 100,
    deliveryCount,
    avgOrderValueEur:    deliveryCount > 0 ? Math.round((revenueEur / deliveryCount) * 100) / 100 : null,
    avgDeliveryMin:      perfRes.data?.avg_delivery_min ?? null,
    onTimePct:           perfRes.data?.on_time_pct     ?? null,
    cancelledCount:      cancelledCt,
    cancellationRatePct: totalOrders > 0 ? Math.round((cancelledCt / totalOrders) * 1000) / 10 : null,
    driversOnline,
    driversActive,
    ordersPerDriver:     driversOnline > 0 ? Math.round((deliveryCount / driversOnline) * 10) / 10 : null,
    opsHealthScore:      ops?.health_score ?? null,
    opsHealthLevel:      opsHealthLevel(ops?.health_score ?? null),
    netMarginEur:        roi?.net_margin_eur       ?? null,
    netMarginPct:        roi?.net_margin_pct       ?? null,
    costPerDeliveryEur:  roi?.cost_per_delivery    ?? null,
    revenuePerDriverH:   roi?.revenue_per_driver_hour ?? null,
    avgDriverScore:      avgScore !== null ? Math.round(avgScore * 10) / 10 : null,
    driversGradeAPct:    gradeAPct !== null ? Math.round(gradeAPct * 10) / 10 : null,
    capacityStatus:      cap?.capacity_status ?? null,
    capacityLoadPct:     cap?.load_pct        ?? null,
  };
}

// ── Tages-Snapshot ────────────────────────────────────────────────────────────

export async function snapshotExecutiveKpi(
  locationId: string,
  date?: string,
): Promise<SnapshotResult> {
  const svc = createServiceClient();
  const snapshotDate = date ?? toLocalDate(new Date());
  const { from, to } = dateRangeUtc(snapshotDate);

  const [
    ordersRes,
    cancelledRes,
    shiftsRes,
    opsAvgRes,
    roiRes,
    scoreRes,
    capRes,
    perfRes,
  ] = await Promise.all([
    svc.from('customer_orders')
      .select('gesamtbetrag')
      .eq('location_id', locationId)
      .eq('bestellart', 'lieferung')
      .in('status', ['geliefert', 'abgeschlossen'])
      .gte('bestellt_am', from)
      .lte('bestellt_am', to),

    svc.from('customer_orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('bestellart', 'lieferung')
      .in('status', ['storniert', 'abgebrochen'])
      .gte('bestellt_am', from)
      .lte('bestellt_am', to),

    // Fahrer-Schichten des Tages
    svc.from('driver_shifts')
      .select('driver_id')
      .eq('location_id', locationId)
      .gte('planned_start', from)
      .lte('planned_start', to),

    // Ops-Health: Ø + Min für den Tag
    svc.from('ops_health_snapshots')
      .select('health_score')
      .eq('location_id', locationId)
      .gte('snapped_at', from)
      .lte('snapped_at', to),

    // Schicht-ROI dieses Tages
    svc.from('schicht_roi_daily')
      .select('net_margin_eur, net_margin_pct, cost_per_delivery, revenue_per_driver_hour')
      .eq('location_id', locationId)
      .eq('snapshot_date', snapshotDate)
      .maybeSingle(),

    // Fahrer-Score des Tages
    svc.from('driver_score_daily')
      .select('composite_score, grade')
      .eq('location_id', locationId)
      .eq('snapshot_date', snapshotDate),

    // Kapazitäts-Status: letzter des Tages
    svc.from('driver_capacity_snapshots')
      .select('capacity_status')
      .eq('location_id', locationId)
      .maybeSingle(),

    // Delivery Performance
    svc.from('delivery_performance')
      .select('avg_delivery_min, on_time_pct')
      .eq('location_id', locationId)
      .gte('recorded_at', from)
      .lte('recorded_at', to)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  type OrderRow = { gesamtbetrag: number | null };
  type ScoreRow = { composite_score: number | null; grade: string | null };
  type OpsRow   = { health_score:    number | null };

  const orders      = (ordersRes.data  ?? []) as OrderRow[];
  const cancelledCt = cancelledRes.count ?? 0;
  const scoreRows   = (scoreRes.data   ?? []) as ScoreRow[];
  const opsRows     = (opsAvgRes.data  ?? []) as OpsRow[];

  const revenueEur    = orders.reduce((s, o) => s + Number(o.gesamtbetrag ?? 0), 0);
  const deliveryCount = orders.length;
  const totalOrders   = deliveryCount + cancelledCt;

  const activeDriverCount = new Set((shiftsRes.data ?? []).map((s: { driver_id: string }) => s.driver_id)).size;

  const opsScores     = opsRows.map(r => Number(r.health_score ?? 0)).filter(s => s > 0);
  const avgOpsHealth  = opsScores.length > 0 ? opsScores.reduce((a, b) => a + b, 0) / opsScores.length : null;
  const minOpsHealth  = opsScores.length > 0 ? Math.min(...opsScores) : null;

  const avgScore = scoreRows.length > 0
    ? scoreRows.reduce((s, r) => s + Number(r.composite_score ?? 0), 0) / scoreRows.length
    : null;
  const gradeAPct = scoreRows.length > 0
    ? (scoreRows.filter(r => r.grade === 'A' || r.grade === 'A+').length / scoreRows.length) * 100
    : null;

  const roi = roiRes.data;

  const row = {
    location_id:            locationId,
    snapshot_date:          snapshotDate,
    revenue_eur:            Math.round(revenueEur * 100) / 100,
    delivery_count:         deliveryCount,
    avg_order_value_eur:    deliveryCount > 0 ? Math.round((revenueEur / deliveryCount) * 100) / 100 : null,
    avg_delivery_min:       perfRes.data?.avg_delivery_min ?? null,
    on_time_pct:            perfRes.data?.on_time_pct      ?? null,
    cancelled_count:        cancelledCt,
    cancellation_rate_pct:  totalOrders > 0 ? Math.round((cancelledCt / totalOrders) * 1000) / 10 : null,
    active_driver_count:    activeDriverCount,
    online_driver_count:    activeDriverCount,
    orders_per_driver:      activeDriverCount > 0 ? Math.round((deliveryCount / activeDriverCount) * 10) / 10 : null,
    avg_ops_health_score:   avgOpsHealth !== null ? Math.round(avgOpsHealth * 10) / 10 : null,
    min_ops_health_score:   minOpsHealth !== null ? Math.round(minOpsHealth * 10) / 10 : null,
    net_margin_eur:         roi?.net_margin_eur          ?? null,
    net_margin_pct:         roi?.net_margin_pct          ?? null,
    cost_per_delivery_eur:  roi?.cost_per_delivery       ?? null,
    revenue_per_driver_h:   roi?.revenue_per_driver_hour ?? null,
    avg_driver_score:       avgScore    !== null ? Math.round(avgScore * 10) / 10    : null,
    drivers_grade_a_pct:    gradeAPct   !== null ? Math.round(gradeAPct * 10) / 10  : null,
    capacity_status:        capRes.data?.capacity_status ?? null,
  };

  const { error } = await svc
    .from('executive_kpi_snapshots')
    .upsert(row, { onConflict: 'location_id,snapshot_date' });

  return {
    locationId,
    snapshotDate,
    saved:         !error,
    revenueEur:    row.revenue_eur,
    deliveryCount: row.delivery_count,
  };
}

export async function snapshotExecutiveKpiAllLocations(
  date?: string,
): Promise<AllLocationsResult> {
  const svc = createServiceClient();
  const { data: locs } = await svc
    .from('mise_locations')
    .select('id')
    .eq('is_active', true);

  if (!locs?.length) return { locations: 0, saved: 0, errors: 0 };

  const results = await Promise.allSettled(
    locs.map(l => snapshotExecutiveKpi(l.id, date)),
  );

  const saved  = results.filter(r => r.status === 'fulfilled' && r.value.saved).length;
  const errors = results.filter(r => r.status === 'rejected').length;
  return { locations: locs.length, saved, errors };
}

// ── History / Trend-Daten ─────────────────────────────────────────────────────

export async function getExecutiveKpiHistory(
  locationId: string,
  days = 30,
): Promise<ExecutiveKpiSnapshot[]> {
  const svc = createServiceClient();
  const cappedDays = Math.min(90, Math.max(7, days));
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - cappedDays);

  const { data } = await svc
    .from('executive_kpi_snapshots')
    .select('*')
    .eq('location_id', locationId)
    .gte('snapshot_date', since.toISOString().slice(0, 10))
    .order('snapshot_date', { ascending: false });

  return (data ?? []).map(r => ({
    locationId:          r.location_id,
    snapshotDate:        r.snapshot_date,
    revenueEur:          Number(r.revenue_eur),
    deliveryCount:       Number(r.delivery_count),
    avgOrderValueEur:    r.avg_order_value_eur  != null ? Number(r.avg_order_value_eur)  : null,
    avgDeliveryMin:      r.avg_delivery_min     != null ? Number(r.avg_delivery_min)      : null,
    onTimePct:           r.on_time_pct          != null ? Number(r.on_time_pct)           : null,
    cancelledCount:      Number(r.cancelled_count),
    cancellationRatePct: r.cancellation_rate_pct != null ? Number(r.cancellation_rate_pct) : null,
    activeDriverCount:   Number(r.active_driver_count),
    onlineDriverCount:   Number(r.online_driver_count),
    ordersPerDriver:     r.orders_per_driver    != null ? Number(r.orders_per_driver)     : null,
    avgOpsHealthScore:   r.avg_ops_health_score != null ? Number(r.avg_ops_health_score)  : null,
    minOpsHealthScore:   r.min_ops_health_score != null ? Number(r.min_ops_health_score)  : null,
    netMarginEur:        r.net_margin_eur       != null ? Number(r.net_margin_eur)        : null,
    netMarginPct:        r.net_margin_pct       != null ? Number(r.net_margin_pct)        : null,
    costPerDeliveryEur:  r.cost_per_delivery_eur != null ? Number(r.cost_per_delivery_eur) : null,
    revenuePerDriverH:   r.revenue_per_driver_h  != null ? Number(r.revenue_per_driver_h)  : null,
    avgDriverScore:      r.avg_driver_score     != null ? Number(r.avg_driver_score)      : null,
    driversGradeAPct:    r.drivers_grade_a_pct  != null ? Number(r.drivers_grade_a_pct)   : null,
    capacityStatus:      r.capacity_status      ?? null,
  }));
}

// ── Prune ─────────────────────────────────────────────────────────────────────

export async function pruneExecutiveKpiSnapshots(
  daysToKeep = 365,
): Promise<{ pruned: number }> {
  const svc = createServiceClient();
  const { data } = await svc.rpc('prune_executive_kpi_snapshots', { days_to_keep: daysToKeep });
  return { pruned: Number(data ?? 0) };
}
