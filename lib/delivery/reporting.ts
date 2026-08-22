/**
 * lib/delivery/reporting.ts
 *
 * Business Intelligence + Export Engine — Phase 26
 *
 * Erstellt Perioden-Reports und CSV-Exporte für Franchise-Operatoren.
 * Nutzt DB-Views (v_daily_location_kpis, v_driver_period_stats) und
 * cached Reports in delivery_report_snapshots.
 *
 * Funktionen:
 *  getDailyKpis()             — Tages-KPIs aus v_daily_location_kpis
 *  getPeriodReport()          — Aggregierter Report für Zeitraum
 *  getMultiLocationSummary()  — Standort-Vergleich für Franchise (max 20 Locations)
 *  generateOrdersCSV()        — CSV-Export Bestellungen (RFC 4180, max 10 000 Zeilen)
 *  generateDriversCSV()       — CSV-Export Fahrer-Performance
 *  cacheReportSnapshot()      — Report-Cache schreiben / aktualisieren
 *  runDailyReportCache()      — Cron-Helfer: alle aktiven Locations täglich cachen
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ============================================================
// Typen
// ============================================================

export interface DailyKpis {
  date: string;           // YYYY-MM-DD (Berliner Kalender-Tag)
  locationId: string;
  orders: {
    total: number;
    delivery: number;
    pickup: number;
    completed: number;
    cancelled: number;
  };
  revenue: {
    total: number | null;
    delivery: number | null;
    pickup: number | null;
    cash: number | null;
    card: number | null;
  };
  activeDrivers: number;
}

export interface DriverPeriodStat {
  driverId: string;
  driverName: string | null;
  driverVehicle: string | null;
  deliveries: number;
  avgEtaDeviationMin: number | null;
  onTimeCount: number;
  lateCount: number;
  onTimePct: number | null;
}

export interface PeriodReport {
  locationId: string;
  periodType: 'daily' | 'weekly' | 'monthly' | 'custom';
  periodStart: string;
  periodEnd: string;
  summary: {
    totalOrders: number;
    totalDeliveries: number;
    totalPickups: number;
    completedOrders: number;
    cancelledOrders: number;
    totalRevenue: number | null;
    deliveryRevenue: number | null;
    avgDailyOrders: number;
    onTimePct: number | null;
    avgEtaDeviationMin: number | null;
    activeDriversUnique: number;
    driverDeliveries: number;
    daysIncluded: number;
  };
  dailyBreakdown: DailyKpis[];
  topDrivers: DriverPeriodStat[];
}

export interface MultiLocationEntry {
  locationId: string;
  locationName: string;
  orders: number;
  deliveries: number;
  completed: number;
  revenue: number | null;
  onTimePct: number | null;
  avgEtaDeviationMin: number | null;
  activeDrivers: number;
}

export interface MultiLocationSummary {
  period: { from: string; to: string };
  locations: MultiLocationEntry[];
  totals: {
    orders: number;
    delivered: number;
    revenue: number | null;
  };
}

// ============================================================
// Interne Helfer
// ============================================================

function rowToDailyKpis(r: Record<string, unknown>, locationId: string): DailyKpis {
  return {
    date:       String(r.report_date ?? ''),
    locationId,
    orders: {
      total:     Number(r.total_orders     ?? 0),
      delivery:  Number(r.delivery_orders  ?? 0),
      pickup:    Number(r.pickup_orders    ?? 0),
      completed: Number(r.completed_orders ?? 0),
      cancelled: Number(r.cancelled_orders ?? 0),
    },
    revenue: {
      total:    r.total_revenue    != null ? Number(r.total_revenue)    : null,
      delivery: r.delivery_revenue != null ? Number(r.delivery_revenue) : null,
      pickup:   r.pickup_revenue   != null ? Number(r.pickup_revenue)   : null,
      cash:     r.cash_revenue     != null ? Number(r.cash_revenue)     : null,
      card:     r.card_revenue     != null ? Number(r.card_revenue)     : null,
    },
    activeDrivers: Number(r.active_drivers ?? 0),
  };
}

function csvEscape(f: string | number | null | undefined): string {
  if (f == null) return '';
  const s = String(f);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function csvRow(fields: (string | number | null | undefined)[]): string {
  return fields.map(csvEscape).join(',');
}

// ============================================================
// getDailyKpis
// ============================================================

/** Tages-KPIs für eine Location. date: YYYY-MM-DD (Berliner Kalender-Tag). */
export async function getDailyKpis(
  locationId: string,
  date: string,
): Promise<DailyKpis | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('v_daily_location_kpis')
    .select('report_date, total_orders, delivery_orders, pickup_orders, completed_orders, cancelled_orders, total_revenue, delivery_revenue, pickup_revenue, cash_revenue, card_revenue, active_drivers')
    .eq('location_id', locationId)
    .eq('report_date', date)
    .maybeSingle();

  if (error) {
    // Graceful: View existiert noch nicht (Migration noch nicht ausgeführt)
    if (error.message.includes('does not exist') || error.message.includes('relation')) {
      return null;
    }
    throw new Error(`[reporting] getDailyKpis: ${error.message}`);
  }
  if (!data) return null;
  return rowToDailyKpis(data as Record<string, unknown>, locationId);
}

// ============================================================
// getPeriodReport
// ============================================================

/**
 * Aggregierter Report für einen Zeitraum.
 * periodStart / periodEnd: YYYY-MM-DD (inklusive, Berliner Kalender-Tag).
 */
export async function getPeriodReport(
  locationId: string,
  periodType: PeriodReport['periodType'],
  periodStart: string,
  periodEnd: string,
): Promise<PeriodReport> {
  const sb = createServiceClient();

  const [kpiRes, driverRes] = await Promise.all([
    sb
      .from('v_daily_location_kpis')
      .select('report_date, total_orders, delivery_orders, pickup_orders, completed_orders, cancelled_orders, total_revenue, delivery_revenue, pickup_revenue, cash_revenue, card_revenue, active_drivers')
      .eq('location_id', locationId)
      .gte('report_date', periodStart)
      .lte('report_date', periodEnd)
      .order('report_date', { ascending: true }),
    sb
      .from('v_driver_period_stats')
      .select('driver_id, driver_name, driver_vehicle, deliveries, avg_eta_deviation_min, on_time_count, late_count, on_time_pct')
      .eq('location_id', locationId)
      .gte('report_date', periodStart)
      .lte('report_date', periodEnd),
  ]);

  if (kpiRes.error) {
    if (kpiRes.error.message.includes('does not exist') || kpiRes.error.message.includes('relation')) {
      return emptyPeriodReport(locationId, periodType, periodStart, periodEnd);
    }
    throw new Error(`[reporting] getPeriodReport kpis: ${kpiRes.error.message}`);
  }

  const dailyBreakdown = (kpiRes.data ?? []).map(
    (r) => rowToDailyKpis(r as Record<string, unknown>, locationId),
  );

  // Fahrer-Stats über alle Tage aggregieren
  const driverMap = new Map<string, {
    driverName: string | null;
    driverVehicle: string | null;
    deliveries: number;
    onTimeCount: number;
    lateCount: number;
    devValues: number[];
  }>();

  for (const dr of driverRes.data ?? []) {
    const dId = String(dr.driver_id);
    const existing = driverMap.get(dId);
    if (existing) {
      existing.deliveries  += Number(dr.deliveries     ?? 0);
      existing.onTimeCount += Number(dr.on_time_count  ?? 0);
      existing.lateCount   += Number(dr.late_count     ?? 0);
      if (dr.avg_eta_deviation_min != null) existing.devValues.push(Number(dr.avg_eta_deviation_min));
    } else {
      driverMap.set(dId, {
        driverName:    dr.driver_name    as string | null,
        driverVehicle: dr.driver_vehicle as string | null,
        deliveries:    Number(dr.deliveries     ?? 0),
        onTimeCount:   Number(dr.on_time_count  ?? 0),
        lateCount:     Number(dr.late_count     ?? 0),
        devValues:     dr.avg_eta_deviation_min != null ? [Number(dr.avg_eta_deviation_min)] : [],
      });
    }
  }

  const topDrivers: DriverPeriodStat[] = Array.from(driverMap.entries())
    .map(([driverId, d]) => {
      const tracked = d.onTimeCount + d.lateCount;
      const onTimePct = tracked > 0 ? Math.round((d.onTimeCount / tracked) * 1000) / 10 : null;
      const avgDev = d.devValues.length > 0
        ? Math.round((d.devValues.reduce((a, b) => a + b, 0) / d.devValues.length) * 10) / 10
        : null;
      return { driverId, driverName: d.driverName, driverVehicle: d.driverVehicle, deliveries: d.deliveries, avgEtaDeviationMin: avgDev, onTimeCount: d.onTimeCount, lateCount: d.lateCount, onTimePct };
    })
    .sort((a, b) => b.deliveries - a.deliveries)
    .slice(0, 10);

  // Summen
  const sumOrders     = dailyBreakdown.reduce((s, d) => s + d.orders.total,     0);
  const sumDeliveries = dailyBreakdown.reduce((s, d) => s + d.orders.delivery,  0);
  const sumPickups    = dailyBreakdown.reduce((s, d) => s + d.orders.pickup,    0);
  const sumCompleted  = dailyBreakdown.reduce((s, d) => s + d.orders.completed, 0);
  const sumCancelled  = dailyBreakdown.reduce((s, d) => s + d.orders.cancelled, 0);

  const revVals = dailyBreakdown.map((d) => d.revenue.total).filter((v): v is number => v !== null);
  const totalRevenue  = revVals.length > 0 ? round2(revVals.reduce((a, b) => a + b, 0)) : null;
  const delRevVals = dailyBreakdown.map((d) => d.revenue.delivery).filter((v): v is number => v !== null);
  const deliveryRevenue = delRevVals.length > 0 ? round2(delRevVals.reduce((a, b) => a + b, 0)) : null;

  const daysIncluded   = dailyBreakdown.length;
  const avgDailyOrders = daysIncluded > 0 ? Math.round((sumOrders / daysIncluded) * 10) / 10 : 0;

  const allOnTime = topDrivers.reduce((s, d) => s + d.onTimeCount, 0);
  const allTotal  = topDrivers.reduce((s, d) => s + d.onTimeCount + d.lateCount, 0);
  const onTimePct = allTotal > 0 ? Math.round((allOnTime / allTotal) * 1000) / 10 : null;

  const devAll = topDrivers.map((d) => d.avgEtaDeviationMin).filter((v): v is number => v !== null);
  const avgEtaDeviationMin = devAll.length > 0
    ? Math.round((devAll.reduce((a, b) => a + b, 0) / devAll.length) * 10) / 10
    : null;

  return {
    locationId,
    periodType,
    periodStart,
    periodEnd,
    summary: {
      totalOrders: sumOrders, totalDeliveries: sumDeliveries, totalPickups: sumPickups,
      completedOrders: sumCompleted, cancelledOrders: sumCancelled,
      totalRevenue, deliveryRevenue, avgDailyOrders, onTimePct, avgEtaDeviationMin,
      activeDriversUnique: driverMap.size,
      driverDeliveries: topDrivers.reduce((s, d) => s + d.deliveries, 0),
      daysIncluded,
    },
    dailyBreakdown,
    topDrivers,
  };
}

function emptyPeriodReport(locationId: string, periodType: PeriodReport['periodType'], periodStart: string, periodEnd: string): PeriodReport {
  return {
    locationId, periodType, periodStart, periodEnd,
    summary: { totalOrders: 0, totalDeliveries: 0, totalPickups: 0, completedOrders: 0, cancelledOrders: 0, totalRevenue: null, deliveryRevenue: null, avgDailyOrders: 0, onTimePct: null, avgEtaDeviationMin: null, activeDriversUnique: 0, driverDeliveries: 0, daysIncluded: 0 },
    dailyBreakdown: [],
    topDrivers: [],
  };
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

// ============================================================
// getMultiLocationSummary
// ============================================================

/**
 * Vergleich mehrerer Locations für Franchise-Betreiber.
 * locationIds: max 20. from / to: YYYY-MM-DD (Berliner Kalender-Tag).
 */
export async function getMultiLocationSummary(
  locationIds: string[],
  from: string,
  to: string,
): Promise<MultiLocationSummary> {
  const ids = locationIds.slice(0, 20);
  const sb  = createServiceClient();

  const [kpiRes, locRes, perfRes] = await Promise.all([
    sb
      .from('v_daily_location_kpis')
      .select('location_id, total_orders, delivery_orders, completed_orders, total_revenue, active_drivers')
      .in('location_id', ids)
      .gte('report_date', from)
      .lte('report_date', to),
    sb
      .from('locations')
      .select('id, name')
      .in('id', ids),
    sb
      .from('v_driver_period_stats')
      .select('location_id, on_time_count, late_count, avg_eta_deviation_min')
      .in('location_id', ids)
      .gte('report_date', from)
      .lte('report_date', to),
  ]);

  const locationNames = new Map<string, string>(
    (locRes.data ?? []).map((l) => [String(l.id), String(l.name)]),
  );

  type LocAccum = {
    orders: number; deliveries: number; completed: number;
    revenue: number | null; maxDrivers: number;
    onTimeCount: number; lateCount: number; devValues: number[];
  };

  const locMap = new Map<string, LocAccum>();

  for (const r of kpiRes.data ?? []) {
    const lid = String(r.location_id);
    const rev = r.total_revenue != null ? Number(r.total_revenue) : null;
    const existing = locMap.get(lid);
    if (existing) {
      existing.orders     += Number(r.total_orders     ?? 0);
      existing.deliveries += Number(r.delivery_orders  ?? 0);
      existing.completed  += Number(r.completed_orders ?? 0);
      if (rev !== null) existing.revenue = (existing.revenue ?? 0) + rev;
      const drivers = Number(r.active_drivers ?? 0);
      if (drivers > existing.maxDrivers) existing.maxDrivers = drivers;
    } else {
      locMap.set(lid, {
        orders:     Number(r.total_orders     ?? 0),
        deliveries: Number(r.delivery_orders  ?? 0),
        completed:  Number(r.completed_orders ?? 0),
        revenue:    rev,
        maxDrivers: Number(r.active_drivers   ?? 0),
        onTimeCount: 0, lateCount: 0, devValues: [],
      });
    }
  }

  for (const p of perfRes.data ?? []) {
    const lid = String(p.location_id);
    const entry = locMap.get(lid);
    if (!entry) continue;
    entry.onTimeCount += Number(p.on_time_count ?? 0);
    entry.lateCount   += Number(p.late_count    ?? 0);
    if (p.avg_eta_deviation_min != null) entry.devValues.push(Number(p.avg_eta_deviation_min));
  }

  const locations: MultiLocationEntry[] = ids.map((lid) => {
    const e = locMap.get(lid);
    if (!e) return { locationId: lid, locationName: locationNames.get(lid) ?? lid, orders: 0, deliveries: 0, completed: 0, revenue: null, onTimePct: null, avgEtaDeviationMin: null, activeDrivers: 0 };
    const tot = e.onTimeCount + e.lateCount;
    const onTimePct = tot > 0 ? Math.round((e.onTimeCount / tot) * 1000) / 10 : null;
    const avgDev = e.devValues.length > 0
      ? Math.round((e.devValues.reduce((a, b) => a + b, 0) / e.devValues.length) * 10) / 10
      : null;
    return { locationId: lid, locationName: locationNames.get(lid) ?? lid, orders: e.orders, deliveries: e.deliveries, completed: e.completed, revenue: e.revenue, onTimePct, avgEtaDeviationMin: avgDev, activeDrivers: e.maxDrivers };
  });

  const totOrders    = locations.reduce((s, l) => s + l.orders,     0);
  const totDelivered = locations.reduce((s, l) => s + l.deliveries, 0);
  const revVals      = locations.map((l) => l.revenue).filter((v): v is number => v !== null);
  const totRevenue   = revVals.length > 0 ? round2(revVals.reduce((a, b) => a + b, 0)) : null;

  return {
    period: { from, to },
    locations,
    totals: { orders: totOrders, delivered: totDelivered, revenue: totRevenue },
  };
}

// ============================================================
// CSV-Export
// ============================================================

/**
 * CSV-Export aller Lieferbestellungen im ISO-Zeitraum.
 * from / to: ISO-8601 UTC-Timestamps. Max. 10 000 Zeilen.
 */
export async function generateOrdersCSV(
  locationId: string,
  from: string,
  to: string,
): Promise<string> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('customer_orders')
    .select('bestellnummer, typ, status, gesamtbetrag, zahlungsart, bezahlt, delivery_zone, dispatch_score, eta_earliest, eta_latest, mise_driver_id, created_at')
    .eq('location_id', locationId)
    .gte('created_at', from)
    .lte('created_at', to)
    .order('created_at', { ascending: true })
    .limit(10_000);

  if (error) throw new Error(`[reporting] generateOrdersCSV: ${error.message}`);

  const header = csvRow([
    'bestellnummer', 'typ', 'status', 'gesamtbetrag_eur', 'zahlungsart', 'bezahlt',
    'zone', 'dispatch_score', 'eta_earliest', 'eta_latest', 'fahrer_id', 'erstellt_am',
  ]);

  const lines = (data ?? []).map((r) => csvRow([
    r.bestellnummer as string,
    r.typ           as string,
    r.status        as string,
    r.gesamtbetrag  != null ? Number(r.gesamtbetrag).toFixed(2)  : null,
    r.zahlungsart   as string | null,
    r.bezahlt       != null ? (r.bezahlt ? 'ja' : 'nein')        : null,
    r.delivery_zone as string | null,
    r.dispatch_score != null ? Number(r.dispatch_score).toFixed(1) : null,
    r.eta_earliest  as string | null,
    r.eta_latest    as string | null,
    r.mise_driver_id as string | null,
    r.created_at    as string,
  ]));

  return [header, ...lines].join('\r\n');
}

/**
 * CSV-Export der Fahrer-Performance im Datumsbereich.
 * from / to: YYYY-MM-DD (Berliner Kalender-Tag).
 */
export async function generateDriversCSV(
  locationId: string,
  from: string,
  to: string,
): Promise<string> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('v_driver_period_stats')
    .select('driver_id, driver_name, driver_vehicle, report_date, deliveries, avg_eta_deviation_min, on_time_count, late_count, on_time_pct')
    .eq('location_id', locationId)
    .gte('report_date', from)
    .lte('report_date', to)
    .order('report_date',  { ascending: true })
    .order('deliveries',   { ascending: false });

  if (error) throw new Error(`[reporting] generateDriversCSV: ${error.message}`);

  const header = csvRow([
    'datum', 'fahrer_name', 'fahrzeug', 'lieferungen', 'puenktlich',
    'spaet', 'puenktlich_pct', 'avg_abweichung_min',
  ]);

  const lines = (data ?? []).map((r) => csvRow([
    r.report_date       as string,
    r.driver_name       as string | null,
    r.driver_vehicle    as string | null,
    Number(r.deliveries   ?? 0),
    Number(r.on_time_count ?? 0),
    Number(r.late_count    ?? 0),
    r.on_time_pct != null ? `${Number(r.on_time_pct).toFixed(1)}%` : null,
    r.avg_eta_deviation_min != null ? Number(r.avg_eta_deviation_min).toFixed(1) : null,
  ]));

  return [header, ...lines].join('\r\n');
}

// ============================================================
// Report-Cache
// ============================================================

/**
 * Schreibt / aktualisiert einen Perioden-Snapshot in delivery_report_snapshots.
 * Idempotent via UPSERT (location_id + report_type + period_start).
 */
export async function cacheReportSnapshot(
  locationId: string,
  reportType: 'daily' | 'weekly' | 'monthly',
  periodStart: string,
  periodEnd: string,
): Promise<void> {
  const report = await getPeriodReport(locationId, reportType, periodStart, periodEnd);
  const sb     = createServiceClient();

  const { error } = await sb.from('delivery_report_snapshots').upsert(
    {
      location_id:     locationId,
      report_type:     reportType,
      period_start:    periodStart,
      payload:         report as unknown as Record<string, unknown>,
      orders_count:    report.summary.totalOrders,
      delivered_count: report.summary.completedOrders,
      revenue_eur:     report.summary.totalRevenue,
      on_time_pct:     report.summary.onTimePct,
      generated_at:    new Date().toISOString(),
    },
    { onConflict: 'location_id,report_type,period_start' },
  );

  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[reporting] cacheReportSnapshot:', error.message);
  }
}

/**
 * Cron-Helfer: cached Tages- + Wochen-Report für alle aktiven Locations.
 * Täglich um 02:00 UTC. Cached: gestern (daily) + laufende Woche (weekly).
 */
export async function runDailyReportCache(): Promise<{
  locations: number;
  snapshots: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('active', true)
    .limit(50);

  if (!locs || locs.length === 0) return { locations: 0, snapshots: 0, errors: 0 };

  const yesterday = new Date(Date.now() - 86_400_000);
  const yDate     = yesterday.toISOString().slice(0, 10);

  // Montag der laufenden Woche (ISO: Mo=0 nach Anpassung)
  const wMon = new Date(yesterday);
  wMon.setDate(wMon.getDate() - ((wMon.getDay() + 6) % 7));
  const wStart = wMon.toISOString().slice(0, 10);

  let snapshots = 0;
  let errors    = 0;

  for (const loc of locs) {
    const lid = String(loc.id);

    try { await cacheReportSnapshot(lid, 'daily', yDate, yDate);  snapshots++; }
    catch { errors++; }

    try { await cacheReportSnapshot(lid, 'weekly', wStart, yDate); snapshots++; }
    catch { errors++; }
  }

  return { locations: locs.length, snapshots, errors };
}
