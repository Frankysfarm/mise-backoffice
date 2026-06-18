/**
 * lib/delivery/shift-handover.ts
 *
 * Phase 234: Smart Delivery Shift Handover Engine
 *
 * Generiert automatisch strukturierte Schicht-Übergabe-Berichte mit:
 *   - Bestellungs-KPIs der letzten N Stunden (Standard 8h)
 *   - SLA-Pünktlichkeitsrate + Durchschnittslieferzeit
 *   - Umsatz + Liefergebühren
 *   - Fahrer-Aktivität + Top-Performer
 *   - Offene Bestellungen und Alarme am Schichtende
 *   - Incident-Zusammenfassung
 *
 * Public API:
 *   generateHandoverReport(locationId, periodHours?)  — Bericht erstellen + speichern
 *   getLatestHandover(locationId)                    — letzter Bericht
 *   getHandoverHistory(locationId, limit?)            — Verlauf
 *   acknowledgeHandover(reportId, employeeId)         — als gelesen markieren
 *   generateAllLocations()                            — Cron-Batch
 *   pruneOldReports(daysToKeep?)                     — Cleanup
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ─────────────────────────────────────────────────────────────────────

export interface OpenOrderSummary {
  id: string;
  bestellnummer: string;
  status: string;
  zone: string | null;
  waitMin: number;
  gesamtbetrag: number;
}

export interface ActiveAlertSummary {
  id: string;
  alert_type: string;
  severity: string;
  message: string;
  createdMin: number;
}

export interface TopDriverSummary {
  driverId: string;
  name: string;
  toursCompleted: number;
  deliveries: number;
  onTimeRate: number;
}

export interface HandoverReport {
  id: string;
  location_id: string;
  generated_at: string;
  generated_by: string;
  period_start: string;
  period_end: string;
  shift_period_hours: number;

  orders_total: number;
  orders_delivered: number;
  orders_cancelled: number;
  orders_failed: number;
  orders_pending_end: number;

  sla_on_time: number;
  sla_late: number;
  on_time_rate_pct: number;
  avg_delivery_min: number | null;

  revenue_eur: number;
  delivery_fees_eur: number;
  avg_order_value_eur: number | null;

  drivers_active: number;
  drivers_shifts_completed: number;
  tours_completed: number;

  avg_prep_min: number | null;
  orders_waited_gt_15min: number;

  incidents_created: number;
  incidents_open_end: number;

  open_orders_json: OpenOrderSummary[];
  active_alerts_json: ActiveAlertSummary[];
  top_drivers_json: TopDriverSummary[];

  notes: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

export interface HandoverDashboard {
  latest: HandoverReport | null;
  history: HandoverReport[];
  totalReports: number;
  avgOnTimeRatePct7d: number;
  avgRevenueEur7d: number;
  generatedAt: string;
}

export interface GenerateResult {
  locationId: string;
  reportId: string;
  periodHours: number;
  ordersTotal: number;
}

export interface BatchResult {
  locations: number;
  reports: number;
  errors: number;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function minutesAgo(isoDate: string, now: Date): number {
  return Math.round((now.getTime() - new Date(isoDate).getTime()) / 60000);
}

// ── generateHandoverReport ────────────────────────────────────────────────────

export async function generateHandoverReport(
  locationId: string,
  periodHours = 8,
  generatedBy = 'auto',
): Promise<GenerateResult> {
  const sb = createServiceClient();
  const now = new Date();
  const periodStart = new Date(now.getTime() - periodHours * 3600 * 1000);

  // ── Bestellungs-Queries (parallel) ────────────────────────────────────────
  const [
    ordersRes,
    toursRes,
    driversRes,
    incidentsRes,
    alertsRes,
    openOrdersRes,
  ] = await Promise.all([
    // Alle Lieferbestellungen im Zeitraum
    sb
      .from('customer_orders')
      .select('id, bestellnummer, status, gesamtbetrag, zahlungsart, delivery_fee_eur, created_at, fertig_am, eta_earliest, eta_latest, delivery_zone, fahrer_id')
      .eq('location_id', locationId)
      .eq('typ', 'lieferung')
      .gte('created_at', periodStart.toISOString())
      .lt('created_at', now.toISOString()),

    // Abgeschlossene Touren
    sb
      .from('mise_delivery_batches')
      .select('id, driver_id, state, completed_at, total_distance_km, stop_count')
      .eq('location_id', locationId)
      .eq('state', 'completed')
      .gte('completed_at', periodStart.toISOString())
      .lt('completed_at', now.toISOString()),

    // Aktive Fahrer im Zeitraum
    sb
      .from('driver_shifts')
      .select('id, driver_id, actual_start, actual_end, status')
      .eq('location_id', locationId)
      .gte('actual_start', periodStart.toISOString())
      .lt('actual_start', now.toISOString()),

    // Incidents im Zeitraum
    sb
      .from('delivery_incidents')
      .select('id, status, severity, type, created_at')
      .eq('location_id', locationId)
      .gte('created_at', periodStart.toISOString()),

    // Offene Alarme
    sb
      .from('delivery_alerts')
      .select('id, alert_type, severity, message, created_at')
      .eq('location_id', locationId)
      .in('status', ['open', 'investigating'])
      .order('created_at', { ascending: false })
      .limit(10),

    // Noch offene Bestellungen
    sb
      .from('customer_orders')
      .select('id, bestellnummer, status, delivery_zone, created_at, gesamtbetrag')
      .eq('location_id', locationId)
      .eq('typ', 'lieferung')
      .not('status', 'in', '("geliefert","abgeholt","storniert","abgelehnt")')
      .order('created_at', { ascending: true })
      .limit(20),
  ]);

  const orders = ordersRes.data ?? [];
  const tours = toursRes.data ?? [];
  const driverShifts = driversRes.data ?? [];
  const incidents = incidentsRes.data ?? [];
  const alerts = alertsRes.data ?? [];
  const openOrders = openOrdersRes.data ?? [];

  // ── Bestellungs-KPIs ──────────────────────────────────────────────────────
  const delivered = orders.filter(o => o.status === 'geliefert' || o.status === 'abgeholt');
  const cancelled = orders.filter(o => o.status === 'storniert' || o.status === 'abgelehnt');
  const failed = orders.filter(o => o.status === 'fehlgeschlagen');

  // SLA: Lieferung pünktlich wenn fertig_am <= eta_latest
  let onTime = 0;
  let late = 0;
  let totalDeliveryMin = 0;
  let deliveryCount = 0;

  for (const o of delivered) {
    if (o.fertig_am && o.created_at) {
      const dMin = (new Date(o.fertig_am).getTime() - new Date(o.created_at).getTime()) / 60000;
      if (dMin > 0 && dMin < 240) {
        totalDeliveryMin += dMin;
        deliveryCount++;
      }
      if (o.eta_latest && o.fertig_am) {
        if (new Date(o.fertig_am) <= new Date(o.eta_latest)) onTime++;
        else late++;
      }
    }
  }

  const onTimeRatePct = (onTime + late) > 0
    ? Math.round((onTime / (onTime + late)) * 10000) / 100
    : 0;
  const avgDeliveryMin = deliveryCount > 0
    ? Math.round((totalDeliveryMin / deliveryCount) * 100) / 100
    : null;

  // ── Umsatz ────────────────────────────────────────────────────────────────
  const revenueEur = orders.reduce((s, o) => s + (Number(o.gesamtbetrag) || 0), 0);
  const deliveryFeesEur = orders.reduce((s, o) => s + (Number(o.delivery_fee_eur) || 0), 0);
  const avgOrderValueEur = orders.length > 0
    ? Math.round((revenueEur / orders.length) * 100) / 100
    : null;

  // ── Fahrer-KPIs ───────────────────────────────────────────────────────────
  const uniqueDriverIds = new Set<string>();
  for (const t of tours) {
    if (t.driver_id) uniqueDriverIds.add(t.driver_id as string);
  }
  for (const s of driverShifts) {
    if (s.driver_id) uniqueDriverIds.add(s.driver_id as string);
  }

  const driversActive = uniqueDriverIds.size;
  const shiftsCompleted = driverShifts.filter(s => s.status === 'completed').length;

  // Top-Fahrer: Touren + Lieferungen berechnen
  const driverTourMap = new Map<string, { tours: number; deliveries: number; onTime: number; total: number }>();
  for (const t of tours) {
    if (!t.driver_id) continue;
    const id = t.driver_id as string;
    const entry = driverTourMap.get(id) ?? { tours: 0, deliveries: 0, onTime: 0, total: 0 };
    entry.tours++;
    entry.deliveries += Number(t.stop_count) || 0;
    driverTourMap.set(id, entry);
  }
  // SLA pro Fahrer
  for (const o of delivered) {
    if (!o.fahrer_id) continue;
    const id = o.fahrer_id as string;
    const entry = driverTourMap.get(id) ?? { tours: 0, deliveries: 0, onTime: 0, total: 0 };
    entry.total++;
    if (o.fertig_am && o.eta_latest && new Date(o.fertig_am) <= new Date(o.eta_latest)) {
      entry.onTime++;
    }
    driverTourMap.set(id, entry);
  }

  // Top-5 Fahrer nach Touren laden
  const topDriverEntries = [...driverTourMap.entries()]
    .sort((a, b) => b[1].tours - a[1].tours)
    .slice(0, 5);

  let topDriversJson: TopDriverSummary[] = [];
  if (topDriverEntries.length > 0) {
    const driverIds = topDriverEntries.map(([id]) => id);
    const { data: driverRows } = await sb
      .from('mise_drivers')
      .select('id, name')
      .in('id', driverIds);

    const nameMap = new Map((driverRows ?? []).map(d => [d.id as string, d.name as string]));
    topDriversJson = topDriverEntries.map(([id, stats]) => ({
      driverId: id,
      name: nameMap.get(id) ?? 'Unbekannt',
      toursCompleted: stats.tours,
      deliveries: stats.deliveries,
      onTimeRate: stats.total > 0
        ? Math.round((stats.onTime / stats.total) * 100)
        : 0,
    }));
  }

  // ── Küche: Wartezeit fertig → abgeholt ────────────────────────────────────
  // (Proxy: fertig_am - kitchen_start_at wenn vorhanden, sonst überspringen)
  let totalPrepMin = 0;
  let prepCount = 0;
  let waitedGt15 = 0;

  for (const o of delivered) {
    if (o.fertig_am && o.created_at) {
      const waitMin = (new Date(o.fertig_am).getTime() - new Date(o.created_at).getTime()) / 60000;
      if (waitMin > 0 && waitMin < 120) {
        totalPrepMin += waitMin;
        prepCount++;
        if (waitMin > 15) waitedGt15++;
      }
    }
  }
  const avgPrepMin = prepCount > 0 ? Math.round((totalPrepMin / prepCount) * 100) / 100 : null;

  // ── Incidents ────────────────────────────────────────────────────────────
  const incidentsCreated = incidents.length;
  const incidentsOpenEnd = incidents.filter(i => i.status === 'open' || i.status === 'investigating').length;

  // ── Offene Bestellungen ───────────────────────────────────────────────────
  const openOrdersJson: OpenOrderSummary[] = openOrders.map(o => ({
    id: o.id as string,
    bestellnummer: o.bestellnummer as string,
    status: o.status as string,
    zone: (o.delivery_zone as string) ?? null,
    waitMin: minutesAgo(o.created_at as string, now),
    gesamtbetrag: Number(o.gesamtbetrag) || 0,
  }));

  // ── Alarme ────────────────────────────────────────────────────────────────
  const activeAlertsJson: ActiveAlertSummary[] = alerts.map(a => ({
    id: a.id as string,
    alert_type: a.alert_type as string,
    severity: a.severity as string,
    message: a.message as string,
    createdMin: minutesAgo(a.created_at as string, now),
  }));

  // ── Report speichern ──────────────────────────────────────────────────────
  const { data: report, error } = await sb
    .from('shift_handover_reports')
    .insert({
      location_id: locationId,
      generated_by: generatedBy,
      period_start: periodStart.toISOString(),
      period_end: now.toISOString(),
      shift_period_hours: periodHours,

      orders_total: orders.length,
      orders_delivered: delivered.length,
      orders_cancelled: cancelled.length,
      orders_failed: failed.length,
      orders_pending_end: openOrders.length,

      sla_on_time: onTime,
      sla_late: late,
      on_time_rate_pct: onTimeRatePct,
      avg_delivery_min: avgDeliveryMin,

      revenue_eur: Math.round(revenueEur * 100) / 100,
      delivery_fees_eur: Math.round(deliveryFeesEur * 100) / 100,
      avg_order_value_eur: avgOrderValueEur,

      drivers_active: driversActive,
      drivers_shifts_completed: shiftsCompleted,
      tours_completed: tours.length,

      avg_prep_min: avgPrepMin,
      orders_waited_gt_15min: waitedGt15,

      incidents_created: incidentsCreated,
      incidents_open_end: incidentsOpenEnd,

      open_orders_json: openOrdersJson,
      active_alerts_json: activeAlertsJson,
      top_drivers_json: topDriversJson,
    })
    .select('id')
    .single();

  if (error || !report) {
    throw new Error(`Handover report save failed: ${error?.message ?? 'unknown'}`);
  }

  return {
    locationId,
    reportId: report.id as string,
    periodHours,
    ordersTotal: orders.length,
  };
}

// ── getLatestHandover ─────────────────────────────────────────────────────────

export async function getLatestHandover(locationId: string): Promise<HandoverReport | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('shift_handover_reports')
    .select('*')
    .eq('location_id', locationId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return mapRow(data);
}

// ── getHandoverHistory ────────────────────────────────────────────────────────

export async function getHandoverHistory(
  locationId: string,
  limit = 20,
): Promise<HandoverReport[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('shift_handover_reports')
    .select('*')
    .eq('location_id', locationId)
    .order('generated_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map(mapRow);
}

// ── acknowledgeHandover ───────────────────────────────────────────────────────

export async function acknowledgeHandover(
  reportId: string,
  employeeId: string,
): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from('shift_handover_reports')
    .update({
      acknowledged_by: employeeId,
      acknowledged_at: new Date().toISOString(),
    })
    .eq('id', reportId);
}

// ── addHandoverNote ───────────────────────────────────────────────────────────

export async function addHandoverNote(reportId: string, notes: string): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from('shift_handover_reports')
    .update({ notes })
    .eq('id', reportId);
}

// ── getHandoverDashboard ──────────────────────────────────────────────────────

export async function getHandoverDashboard(locationId: string): Promise<HandoverDashboard> {
  const sb = createServiceClient();

  const [latestRes, historyRes] = await Promise.all([
    getLatestHandover(locationId),
    getHandoverHistory(locationId, 14),
  ]);

  // 7-Tage Durchschnitt
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const { data: statsRes } = await sb
    .from('shift_handover_reports')
    .select('on_time_rate_pct, revenue_eur')
    .eq('location_id', locationId)
    .gte('generated_at', sevenDaysAgo.toISOString())
    .order('generated_at', { ascending: false });

  const stats = statsRes ?? [];
  const avgOnTimeRatePct7d = stats.length > 0
    ? Math.round(stats.reduce((s, r) => s + Number(r.on_time_rate_pct), 0) / stats.length * 100) / 100
    : 0;
  const avgRevenueEur7d = stats.length > 0
    ? Math.round(stats.reduce((s, r) => s + Number(r.revenue_eur), 0) / stats.length * 100) / 100
    : 0;

  const { count } = await sb
    .from('shift_handover_reports')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId);

  return {
    latest: latestRes,
    history: historyRes,
    totalReports: count ?? 0,
    avgOnTimeRatePct7d,
    avgRevenueEur7d,
    generatedAt: new Date().toISOString(),
  };
}

// ── generateAllLocations ──────────────────────────────────────────────────────

export async function generateHandoverAllLocations(periodHours = 8): Promise<BatchResult> {
  const sb = createServiceClient();
  const { data: locations } = await sb
    .from('locations')
    .select('id')
    .eq('active', true);

  let reports = 0;
  let errors = 0;

  await Promise.all(
    (locations ?? []).map(async (loc) => {
      try {
        await generateHandoverReport(loc.id as string, periodHours, 'auto');
        reports++;
      } catch {
        errors++;
      }
    }),
  );

  return { locations: (locations ?? []).length, reports, errors };
}

// ── pruneOldReports ───────────────────────────────────────────────────────────

export async function pruneOldHandoverReports(daysToKeep = 90): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_old_handover_reports', { days_to_keep: daysToKeep });
  return { pruned: Number(data) || 0 };
}

// ── Row Mapper ────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): HandoverReport {
  return {
    id: row.id as string,
    location_id: row.location_id as string,
    generated_at: row.generated_at as string,
    generated_by: row.generated_by as string,
    period_start: row.period_start as string,
    period_end: row.period_end as string,
    shift_period_hours: Number(row.shift_period_hours),

    orders_total: Number(row.orders_total),
    orders_delivered: Number(row.orders_delivered),
    orders_cancelled: Number(row.orders_cancelled),
    orders_failed: Number(row.orders_failed),
    orders_pending_end: Number(row.orders_pending_end),

    sla_on_time: Number(row.sla_on_time),
    sla_late: Number(row.sla_late),
    on_time_rate_pct: Number(row.on_time_rate_pct),
    avg_delivery_min: row.avg_delivery_min != null ? Number(row.avg_delivery_min) : null,

    revenue_eur: Number(row.revenue_eur),
    delivery_fees_eur: Number(row.delivery_fees_eur),
    avg_order_value_eur: row.avg_order_value_eur != null ? Number(row.avg_order_value_eur) : null,

    drivers_active: Number(row.drivers_active),
    drivers_shifts_completed: Number(row.drivers_shifts_completed),
    tours_completed: Number(row.tours_completed),

    avg_prep_min: row.avg_prep_min != null ? Number(row.avg_prep_min) : null,
    orders_waited_gt_15min: Number(row.orders_waited_gt_15min),

    incidents_created: Number(row.incidents_created),
    incidents_open_end: Number(row.incidents_open_end),

    open_orders_json: (row.open_orders_json as OpenOrderSummary[]) ?? [],
    active_alerts_json: (row.active_alerts_json as ActiveAlertSummary[]) ?? [],
    top_drivers_json: (row.top_drivers_json as TopDriverSummary[]) ?? [],

    notes: (row.notes as string) ?? null,
    acknowledged_by: (row.acknowledged_by as string) ?? null,
    acknowledged_at: (row.acknowledged_at as string) ?? null,
    created_at: row.created_at as string,
  };
}
