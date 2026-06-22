/**
 * lib/delivery/management-report.ts — Phase 424
 *
 * Management-Report-Engine: Automatischer Wochenbericht je Standort.
 *
 * Aggregiert aus customer_orders + driver_score_daily_snapshots:
 *   - Umsatz, Lieferungen, Pünktlichkeit, Stornorate, Ø Lieferzeit
 *   - Top-Fahrer (höchster Ø-Composite-Score in der Berichtswoche)
 *   - Top-Zone / Schlechteste-Zone (nach Bestellvolumen / On-Time-Rate)
 *   - Vorwochenvergleich Umsatz (%)
 *
 * Public API:
 *   computeManagementReport(locationId, weekOffset?)      — Woche berechnen + UPSERT
 *   computeManagementReportAllLocations(weekOffset?)      — Cron-Batch alle Standorte
 *   getManagementReports(locationId, limit?)              — Letzte N Wochenberichte
 *   getLatestManagementReport(locationId)                 — Aktuellster Bericht
 *   pruneOldManagementReports(weeksToKeep?)               — Cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export interface ManagementReport {
  id:                   string;
  locationId:           string;
  wocheVon:             string;        // YYYY-MM-DD (Monday)
  wocheBis:             string;        // YYYY-MM-DD (Sunday)
  umsatzEur:            number;
  lieferungen:          number;
  puenktlichkeitPct:    number;        // 0–100
  topFahrerId:          string | null;
  topFahrerName:        string | null;
  topZone:              string | null;
  schlechtesteZone:     string | null;
  cancellationRate:     number;        // 0.0–1.0
  avgDeliveryMin:       number | null;
  vergleichVorwochePct: number | null; // % delta vs. previous week revenue
  generiertAm:          string;
}

export interface ComputeReportResult {
  locationId:  string;
  wocheVon:    string;
  lieferungen: number;
  umsatzEur:   number;
  durationMs:  number;
}

export interface AllLocationsResult {
  locations: number;
  computed:  number;
  errors:    number;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

/**
 * weekOffset=1 → previous week (Mon–Sun), weekOffset=2 → week before that, etc.
 * Montag = day 1, Sonntag = day 0 (UTC).
 */
function weekBounds(weekOffset: number): { wocheVon: string; wocheBis: string } {
  const now = new Date();
  const dayOfWeek      = now.getUTCDay();                       // 0=So,1=Mo,…,6=Sa
  const daysToMonday   = dayOfWeek === 0 ? 6 : dayOfWeek - 1;  // days since last Monday
  const monday         = new Date(now);
  monday.setUTCDate(now.getUTCDate() - daysToMonday - weekOffset * 7);
  monday.setUTCHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  return {
    wocheVon: monday.toISOString().slice(0, 10),
    wocheBis: sunday.toISOString().slice(0, 10),
  };
}

// ── Kern-Algorithmus ──────────────────────────────────────────────────────────

export async function computeManagementReport(
  locationId: string,
  weekOffset  = 1,
): Promise<ComputeReportResult> {
  const t0  = Date.now();
  const svc = createServiceClient();
  const { wocheVon, wocheBis } = weekBounds(weekOffset);
  const fromTs = wocheVon + 'T00:00:00.000Z';
  const toTs   = wocheBis + 'T23:59:59.999Z';

  // ── 1. Alle Lieferbestellungen der Woche ─────────────────────────────────
  const { data: orders } = await svc
    .from('customer_orders')
    .select('gesamtbetrag, status, delivered_at, estimated_delivery_at, delivery_duration_min, zone')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .gte('bestellt_am', fromTs)
    .lte('bestellt_am', toTs);

  type OrderRow = {
    gesamtbetrag:          number | null;
    status:                string;
    delivered_at:          string | null;
    estimated_delivery_at: string | null;
    delivery_duration_min: number | null;
    zone:                  string | null;
  };

  const allOrders  = (orders ?? []) as OrderRow[];
  const delivered  = allOrders.filter(o => o.status === 'geliefert' || o.status === 'abgeschlossen');
  const storniert  = allOrders.filter(o => o.status === 'storniert');

  const umsatzEur        = delivered.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);
  const lieferungen      = delivered.length;
  const cancellationRate = allOrders.length > 0 ? storniert.length / allOrders.length : 0;

  // Pünktlichkeitsrate (delivered_at ≤ estimated_delivery_at)
  const withTimes       = delivered.filter(o => o.delivered_at && o.estimated_delivery_at);
  const onTimeCount     = withTimes.filter(o => new Date(o.delivered_at!) <= new Date(o.estimated_delivery_at!)).length;
  const puenktlichkeitPct = withTimes.length > 0 ? (onTimeCount / withTimes.length) * 100 : 0;

  // Ø Lieferzeit
  const withDuration = delivered.filter(o => o.delivery_duration_min != null);
  const avgDeliveryMin = withDuration.length > 0
    ? withDuration.reduce((s, o) => s + Number(o.delivery_duration_min), 0) / withDuration.length
    : null;

  // ── 2. Zonen-Analyse (A/B/C/D) ───────────────────────────────────────────
  const VALID_ZONES = new Set(['A', 'B', 'C', 'D']);
  type ZoneAcc = { orders: number; onTimeCount: number; timedCount: number };
  const zoneMap = new Map<string, ZoneAcc>();

  for (const o of delivered) {
    const z = o.zone ?? '';
    if (!VALID_ZONES.has(z)) continue;
    if (!zoneMap.has(z)) zoneMap.set(z, { orders: 0, onTimeCount: 0, timedCount: 0 });
    const e = zoneMap.get(z)!;
    e.orders++;
    if (o.delivered_at && o.estimated_delivery_at) {
      e.timedCount++;
      if (new Date(o.delivered_at) <= new Date(o.estimated_delivery_at)) e.onTimeCount++;
    }
  }

  const zoneStats = [...zoneMap.entries()].map(([zone, s]) => ({
    zone,
    orders:    s.orders,
    onTimePct: s.timedCount > 0 ? s.onTimeCount / s.timedCount : 0.5,
  }));

  const topZone = zoneStats.length > 0
    ? [...zoneStats].sort((a, b) => b.orders - a.orders)[0]!.zone
    : null;

  const schlechtesteZone = zoneStats.length > 1
    ? [...zoneStats].sort((a, b) => a.onTimePct - b.onTimePct)[0]!.zone
    : null;

  // ── 3. Top-Fahrer (höchster Ø composite_score in der Berichtswoche) ──────
  const { data: driverSnaps } = await svc
    .from('driver_score_daily_snapshots')
    .select('driver_id, composite_score, mise_drivers(name)')
    .eq('location_id', locationId)
    .gte('snapshot_date', wocheVon)
    .lte('snapshot_date', wocheBis);

  type DriverSnap = {
    driver_id:       string;
    composite_score: number | null;
    mise_drivers:    { name?: string | null } | { name?: string | null }[] | null;
  };

  const snapRows = (driverSnaps ?? []) as DriverSnap[];
  const driverAcc = new Map<string, { sum: number; count: number; name: string | null }>();

  for (const s of snapRows) {
    const acc = driverAcc.get(s.driver_id) ?? { sum: 0, count: 0, name: null };
    acc.sum   += Number(s.composite_score ?? 0);
    acc.count += 1;
    if (!acc.name) {
      const drv = Array.isArray(s.mise_drivers) ? s.mise_drivers[0] : s.mise_drivers;
      acc.name = (drv as { name?: string | null } | null)?.name ?? null;
    }
    driverAcc.set(s.driver_id, acc);
  }

  let topFahrerId:   string | null = null;
  let topFahrerName: string | null = null;
  let bestAvg = -1;
  for (const [id, { sum, count, name }] of driverAcc) {
    const avg = count > 0 ? sum / count : 0;
    if (avg > bestAvg) { bestAvg = avg; topFahrerId = id; topFahrerName = name; }
  }

  // ── 4. Vorwochenvergleich (Umsatz) ───────────────────────────────────────
  const prev = weekBounds(weekOffset + 1);
  const { data: vwRows } = await svc
    .from('customer_orders')
    .select('gesamtbetrag')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .in('status', ['geliefert', 'abgeschlossen'])
    .gte('bestellt_am', prev.wocheVon + 'T00:00:00.000Z')
    .lte('bestellt_am', prev.wocheBis + 'T23:59:59.999Z');

  const vwUmsatz = ((vwRows ?? []) as { gesamtbetrag: number | null }[])
    .reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);

  const vergleichVorwochePct = vwUmsatz > 0
    ? Math.round(((umsatzEur - vwUmsatz) / vwUmsatz) * 1000) / 10
    : null;

  // ── 5. UPSERT ─────────────────────────────────────────────────────────────
  await svc.from('management_reports').upsert({
    location_id:            locationId,
    woche_von:              wocheVon,
    woche_bis:              wocheBis,
    umsatz_eur:             Math.round(umsatzEur * 100) / 100,
    lieferungen,
    puenktlichkeit_pct:     Math.round(puenktlichkeitPct * 10) / 10,
    top_fahrer_id:          topFahrerId,
    top_fahrer_name:        topFahrerName,
    top_zone:               topZone,
    schlechteste_zone:      schlechtesteZone,
    cancellation_rate:      Math.round(cancellationRate * 1000) / 1000,
    avg_delivery_min:       avgDeliveryMin !== null ? Math.round(avgDeliveryMin * 10) / 10 : null,
    vergleich_vorwoche_pct: vergleichVorwochePct,
    generiert_am:           new Date().toISOString(),
  } as Record<string, unknown>, { onConflict: 'location_id,woche_von' });

  return { locationId, wocheVon, lieferungen, umsatzEur, durationMs: Date.now() - t0 };
}

export async function computeManagementReportAllLocations(weekOffset = 1): Promise<AllLocationsResult> {
  const svc = createServiceClient();
  const { data: locs } = await svc.from('locations').select('id').eq('active', true);
  const ids = (locs ?? []).map(r => r.id as string);

  const results = await Promise.allSettled(ids.map(id => computeManagementReport(id, weekOffset)));

  return {
    locations: ids.length,
    computed:  results.filter(r => r.status === 'fulfilled').length,
    errors:    results.filter(r => r.status === 'rejected').length,
  };
}

export async function getManagementReports(
  locationId: string,
  limit       = 4,
): Promise<ManagementReport[]> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('management_reports')
    .select('*')
    .eq('location_id', locationId)
    .order('woche_von', { ascending: false })
    .limit(limit);

  return ((data ?? []) as Record<string, unknown>[]).map(r => ({
    id:                   r.id as string,
    locationId:           r.location_id as string,
    wocheVon:             r.woche_von as string,
    wocheBis:             r.woche_bis as string,
    umsatzEur:            Number(r.umsatz_eur ?? 0),
    lieferungen:          Number(r.lieferungen ?? 0),
    puenktlichkeitPct:    Number(r.puenktlichkeit_pct ?? 0),
    topFahrerId:          (r.top_fahrer_id as string | null) ?? null,
    topFahrerName:        (r.top_fahrer_name as string | null) ?? null,
    topZone:              (r.top_zone as string | null) ?? null,
    schlechtesteZone:     (r.schlechteste_zone as string | null) ?? null,
    cancellationRate:     Number(r.cancellation_rate ?? 0),
    avgDeliveryMin:       r.avg_delivery_min != null ? Number(r.avg_delivery_min) : null,
    vergleichVorwochePct: r.vergleich_vorwoche_pct != null ? Number(r.vergleich_vorwoche_pct) : null,
    generiertAm:          r.generiert_am as string,
  }));
}

export async function getLatestManagementReport(locationId: string): Promise<ManagementReport | null> {
  const reports = await getManagementReports(locationId, 1);
  return reports[0] ?? null;
}

export async function pruneOldManagementReports(weeksToKeep = 52): Promise<number> {
  const svc = createServiceClient();
  const { data } = await svc.rpc('prune_management_reports', { weeks_old: weeksToKeep });
  return Number(data ?? 0);
}
