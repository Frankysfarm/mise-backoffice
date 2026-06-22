/**
 * lib/delivery/schicht-vergleich.ts — Phase 411
 *
 * Schicht-Vergleichs-Engine: aktuellen Schichtverlauf mit rollenden
 * 6-Wochen-Baselines desselben Wochentags vergleichen.
 *
 * Datenquellen:
 *  - schicht_roi_daily          → Umsatz, Lieferungen, Kosten (Vergangenheit + heute)
 *  - delivery_performance       → Ø Lieferzeit, On-Time-Rate (Vergangenheit)
 *  - customer_orders            → Live-Daten für heute
 *  - mise_drivers               → aktive Fahrer für heute
 *
 * Public API:
 *  computeSchichtBaseline(locationId, dayOfWeek, weeksBack?)  — Baseline-Berechnung für 1 DOW
 *  computeAllBaselines(locationId, weeksBack?)                — alle 7 Wochentage
 *  computeAllBaselinesAllLocations(weeksBack?)                — Cron-Batch
 *  getSchichtVergleich(locationId)                           — aktueller Vergleich
 *  getSchichtVergleichHistory(locationId, dayOfWeek, weeks?) — historischer Verlauf
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export interface SchichtVergleichBaseline {
  locationId:              string;
  dayOfWeek:               number;
  avgUmsatzEur:            number | null;
  p25UmsatzEur:            number | null;
  p75UmsatzEur:            number | null;
  avgLieferungen:          number | null;
  p25Lieferungen:          number | null;
  p75Lieferungen:          number | null;
  avgDeliveryMin:          number | null;
  p25DeliveryMin:          number | null;
  p75DeliveryMin:          number | null;
  avgOnTimePct:            number | null;
  avgDriverHours:          number | null;
  avgCostPerDeliveryEur:   number | null;
  avgNetMarginPct:         number | null;
  weeksUsed:               number;
  lastComputedAt:          string;
}

export interface SchichtTodayData {
  dayOfWeek:         number;
  date:              string;
  umsatzEur:         number;
  lieferungen:       number;
  bestellungen:      number;
  stornos:           number;
  aktiveFahrer:      number;
  avgBestellwertEur: number | null;
  // on-time kommt aus delivery_performance (heute)
  onTimePct:         number | null;
  avgDeliveryMin:    number | null;
}

export interface SchichtDelta {
  umsatzPct:       number | null;   // % vs. baseline avg
  lieferungenPct:  number | null;
  deliveryMinPct:  number | null;   // negativ = schneller = besser
  onTimePtsDiff:   number | null;   // Prozentpunkte-Differenz (absolut)
}

export type SchichtScoreLabel = 'exzellent' | 'gut' | 'okay' | 'schwach';

export interface SchichtVergleich {
  locationId:         string;
  today:              SchichtTodayData;
  baseline:           SchichtVergleichBaseline | null;
  delta:              SchichtDelta;
  shiftScore:         number;       // 0–100 Komposit-Score
  scoreLabel:         SchichtScoreLabel;
  isOnTrack:          boolean;
  recommendation:     string | null;
  computedAt:         string;
}

export interface SchichtVergleichHistoryPoint {
  snapshotDate:       string;
  revenueEur:         number;
  deliveryCount:      number;
  avgDeliveryMin:     number | null;
  onTimePct:          number | null;
  netMarginPct:       number | null;
  driverHours:        number | null;
}

export interface ComputeBaselineResult {
  locationId: string;
  dayOfWeek:  number;
  weeksUsed:  number;
  saved:      boolean;
}

export interface AllLocationsBaselineResult {
  locations: number;
  computed:  number;
  errors:    number;
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

function todayBerlin(): { date: string; dayOfWeek: number } {
  const offsetH = 2;
  const berlinNow = new Date(Date.now() + offsetH * 3_600_000);
  const date = berlinNow.toISOString().slice(0, 10);
  const dayOfWeek = berlinNow.getUTCDay(); // 0=So, 1=Mo, ..., 6=Sa
  return { date, dayOfWeek };
}

function todayRangeUtc(): { from: string; to: string } {
  const { date } = todayBerlin();
  const offsetH = 2;
  const from = new Date(new Date(`${date}T00:00:00Z`).getTime() - offsetH * 3_600_000);
  const to   = new Date(from.getTime() + 24 * 3_600_000);
  return { from: from.toISOString(), to: to.toISOString() };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo  = Math.floor(idx);
  const hi  = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function deltaPct(current: number | null, baseline: number | null): number | null {
  if (current === null || baseline === null || baseline === 0) return null;
  return ((current - baseline) / baseline) * 100;
}

function computeShiftScore(
  today: SchichtTodayData,
  baseline: SchichtVergleichBaseline | null,
  delta: SchichtDelta,
): number {
  let score = 50; // Basiswert ohne Vergleichsdaten

  if (!baseline || baseline.weeksUsed === 0) {
    // Fallback auf absolute Werte
    if (today.onTimePct !== null) {
      score = Math.min(100, Math.max(0, today.onTimePct));
    }
    return Math.round(score);
  }

  // Umsatz-Komponente (0–35 Pkt.)
  if (delta.umsatzPct !== null) {
    const umsatzScore = Math.min(35, Math.max(0, 17.5 + delta.umsatzPct * 0.5));
    score = umsatzScore;
  } else {
    score = 17.5;
  }

  // Liefer-Komponente (0–25 Pkt.)
  if (delta.lieferungenPct !== null) {
    const lieferScore = Math.min(25, Math.max(0, 12.5 + delta.lieferungenPct * 0.4));
    score += lieferScore;
  } else {
    score += 12.5;
  }

  // Pünktlichkeits-Komponente (0–25 Pkt.)
  if (today.onTimePct !== null) {
    const onTimeScore = (today.onTimePct / 100) * 25;
    score += onTimeScore;
  } else if (delta.onTimePtsDiff !== null) {
    score += Math.min(25, Math.max(0, 17.5 + delta.onTimePtsDiff * 0.3));
  } else {
    score += 12.5;
  }

  // Geschwindigkeits-Komponente (0–15 Pkt.)
  if (delta.deliveryMinPct !== null) {
    // negatives Delta = schneller = besser
    const speedScore = Math.min(15, Math.max(0, 7.5 - delta.deliveryMinPct * 0.2));
    score += speedScore;
  } else {
    score += 7.5;
  }

  return Math.round(Math.min(100, Math.max(0, score)));
}

function scoreToLabel(score: number): SchichtScoreLabel {
  if (score >= 80) return 'exzellent';
  if (score >= 65) return 'gut';
  if (score >= 45) return 'okay';
  return 'schwach';
}

function buildRecommendation(
  today: SchichtTodayData,
  baseline: SchichtVergleichBaseline | null,
  delta: SchichtDelta,
  score: number,
): string | null {
  if (!baseline || baseline.weeksUsed === 0) return null;

  if (delta.umsatzPct !== null && delta.umsatzPct < -20) {
    return 'Umsatz deutlich unter Wochentags-Schnitt — Storefront-Promotion oder Push-Benachrichtigung prüfen.';
  }
  if (today.onTimePct !== null && today.onTimePct < 70) {
    return 'Pünktlichkeit kritisch — Zusatzfahrer aktivieren oder Küchenkapazität drosseln.';
  }
  if (delta.deliveryMinPct !== null && delta.deliveryMinPct > 25) {
    return 'Lieferzeit 25 %+ über Schnitt — Routenoptimierung oder Fahrzeugzuteilung überprüfen.';
  }
  if (delta.lieferungenPct !== null && delta.lieferungenPct < -15) {
    return 'Weniger Lieferungen als üblich — Nachfrageprognose und aktive Fahrer kontrollieren.';
  }
  if (score >= 80) {
    return 'Exzellente Schicht — alle Metriken über Wochentags-Schnitt. Weiter so!';
  }
  if (delta.umsatzPct !== null && delta.umsatzPct > 15) {
    return `Umsatz +${delta.umsatzPct.toFixed(1)} % über Schnitt — Kapazität sicherstellen, um Nachfrage zu halten.`;
  }
  return null;
}

// ── computeSchichtBaseline ────────────────────────────────────────────────────

export async function computeSchichtBaseline(
  locationId: string,
  dayOfWeek: number,
  weeksBack = 6,
): Promise<ComputeBaselineResult> {
  const svc = createServiceClient();

  // Letzten N Wochen-Snapshots für diesen Wochentag aus schicht_roi_daily
  // Wir nutzen DOW-Filter via pgSQL DOW-Extraktion
  const { data: roiRows } = await svc
    .from('schicht_roi_daily')
    .select('snapshot_date, revenue_eur, delivery_count, active_driver_hours, cost_per_delivery, net_margin_pct')
    .eq('location_id', locationId)
    .order('snapshot_date', { ascending: false })
    .limit(weeksBack * 8); // Safety-Buffer; DOW-Filter in JS

  type RoiRow = {
    snapshot_date: string;
    revenue_eur: number | null;
    delivery_count: number | null;
    active_driver_hours: number | null;
    cost_per_delivery: number | null;
    net_margin_pct: number | null;
  };

  const filtered = ((roiRows ?? []) as RoiRow[]).filter((r) => {
    const d = new Date(r.snapshot_date as string);
    return d.getUTCDay() === dayOfWeek;
  }).slice(0, weeksBack);

  if (filtered.length === 0) {
    return { locationId, dayOfWeek, weeksUsed: 0, saved: false };
  }

  const revenues     = filtered.map((r) => Number(r.revenue_eur ?? 0));
  const deliveries   = filtered.map((r) => Number(r.delivery_count ?? 0));
  const driverHours  = filtered.map((r) => Number(r.active_driver_hours ?? 0));
  const costPerDel   = filtered.filter((r) => r.cost_per_delivery != null).map((r) => Number(r.cost_per_delivery));
  const marginPcts   = filtered.filter((r) => r.net_margin_pct != null).map((r) => Number(r.net_margin_pct));

  revenues.sort((a, b) => a - b);
  deliveries.sort((a, b) => a - b);

  // delivery_performance: Ø Lieferzeit + On-Time für denselben Wochentag
  const dateFrom = new Date(filtered[filtered.length - 1].snapshot_date as string);
  const dateTo   = new Date(filtered[0].snapshot_date as string);
  dateTo.setDate(dateTo.getDate() + 1);

  const { data: perfRows } = await svc
    .from('delivery_performance')
    .select('snapshot_date, avg_delivery_min, on_time_rate')
    .eq('location_id', locationId)
    .gte('snapshot_date', dateFrom.toISOString().slice(0, 10))
    .lte('snapshot_date', dateTo.toISOString().slice(0, 10))
    .order('snapshot_date', { ascending: false })
    .limit(weeksBack * 4);

  type PerfRow = { snapshot_date: string; avg_delivery_min: number | null; on_time_rate: number | null };

  const perfFiltered = ((perfRows ?? []) as PerfRow[]).filter((r) => {
    const d = new Date(r.snapshot_date as string);
    return d.getUTCDay() === dayOfWeek;
  });

  const deliveryMins = perfFiltered.filter((r) => r.avg_delivery_min != null).map((r) => Number(r.avg_delivery_min));
  const onTimeRates  = perfFiltered.filter((r) => r.on_time_rate != null).map((r) => Number(r.on_time_rate) * 100);

  deliveryMins.sort((a, b) => a - b);

  const upsert = {
    location_id:               locationId,
    day_of_week:               dayOfWeek,
    avg_umsatz_eur:            avg(revenues),
    p25_umsatz_eur:            percentile(revenues, 25),
    p75_umsatz_eur:            percentile(revenues, 75),
    avg_lieferungen:           avg(deliveries),
    p25_lieferungen:           percentile(deliveries, 25),
    p75_lieferungen:           percentile(deliveries, 75),
    avg_delivery_min:          avg(deliveryMins),
    p25_delivery_min:          deliveryMins.length > 0 ? percentile(deliveryMins, 25) : null,
    p75_delivery_min:          deliveryMins.length > 0 ? percentile(deliveryMins, 75) : null,
    avg_on_time_pct:           avg(onTimeRates),
    avg_driver_hours:          avg(driverHours),
    avg_cost_per_delivery_eur: avg(costPerDel),
    avg_net_margin_pct:        avg(marginPcts),
    weeks_used:                filtered.length,
    last_computed_at:          new Date().toISOString(),
  };

  const { error } = await svc
    .from('schicht_vergleich_baselines')
    .upsert(upsert, { onConflict: 'location_id,day_of_week' });

  return { locationId, dayOfWeek, weeksUsed: filtered.length, saved: !error };
}

// ── computeAllBaselines ───────────────────────────────────────────────────────

export async function computeAllBaselines(
  locationId: string,
  weeksBack = 6,
): Promise<{ computed: number; errors: number }> {
  let computed = 0;
  let errors   = 0;
  for (let dow = 0; dow <= 6; dow++) {
    try {
      const r = await computeSchichtBaseline(locationId, dow, weeksBack);
      if (r.saved) computed++;
    } catch {
      errors++;
    }
  }
  return { computed, errors };
}

// ── computeAllBaselinesAllLocations ──────────────────────────────────────────

export async function computeAllBaselinesAllLocations(
  weeksBack = 6,
): Promise<AllLocationsBaselineResult> {
  const svc = createServiceClient();
  const { data: locs } = await svc
    .from('mise_locations')
    .select('id')
    .eq('is_active', true)
    .limit(50);

  const results = await Promise.allSettled(
    (locs ?? []).map((l) => computeAllBaselines((l as { id: string }).id, weeksBack)),
  );

  let computed = 0;
  let errors   = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') computed += r.value.computed;
    else errors++;
  }
  return { locations: (locs ?? []).length, computed, errors };
}

// ── getSchichtVergleich ───────────────────────────────────────────────────────

export async function getSchichtVergleich(locationId: string): Promise<SchichtVergleich> {
  const svc = createServiceClient();
  const { date, dayOfWeek } = todayBerlin();
  const { from, to }        = todayRangeUtc();

  // Parallele Abfragen: heute-Orders, aktive Fahrer, Baseline, heutige Perf
  const [ordersRes, driversRes, baselineRes, perfRes] = await Promise.all([
    svc
      .from('customer_orders')
      .select('gesamtbetrag, status, bestellart')
      .eq('location_id', locationId)
      .gte('bestellt_am', from)
      .lt('bestellt_am', to),
    svc
      .from('mise_drivers')
      .select('id')
      .eq('location_id', locationId)
      .eq('is_online', true),
    svc
      .from('schicht_vergleich_baselines')
      .select('*')
      .eq('location_id', locationId)
      .eq('day_of_week', dayOfWeek)
      .maybeSingle(),
    svc
      .from('delivery_performance')
      .select('avg_delivery_min, on_time_rate')
      .eq('location_id', locationId)
      .eq('snapshot_date', date)
      .maybeSingle(),
  ]);

  type OrderRow = { gesamtbetrag: number | null; status: string | null; bestellart: string | null };
  const orders = (ordersRes.data ?? []) as OrderRow[];

  const delivered = orders.filter((o) =>
    ['geliefert', 'abgeschlossen'].includes(o.status ?? '') &&
    (o.bestellart ?? '') === 'lieferung',
  );
  const cancelled = orders.filter((o) => o.status === 'storniert');
  const active    = orders.filter((o) => !['storniert'].includes(o.status ?? ''));

  const umsatzEur   = active.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);
  const lieferungen = delivered.length;
  const bestellungen= active.length;
  const stornos     = cancelled.length;
  const aktiveFahrer= (driversRes.data ?? []).length;

  type BaselineRow = {
    location_id: string; day_of_week: number;
    avg_umsatz_eur: number | null; p25_umsatz_eur: number | null; p75_umsatz_eur: number | null;
    avg_lieferungen: number | null; p25_lieferungen: number | null; p75_lieferungen: number | null;
    avg_delivery_min: number | null; p25_delivery_min: number | null; p75_delivery_min: number | null;
    avg_on_time_pct: number | null; avg_driver_hours: number | null;
    avg_cost_per_delivery_eur: number | null; avg_net_margin_pct: number | null;
    weeks_used: number; last_computed_at: string;
  };

  const bl = baselineRes.data as BaselineRow | null;
  const baseline: SchichtVergleichBaseline | null = bl
    ? {
        locationId:            bl.location_id,
        dayOfWeek:             bl.day_of_week,
        avgUmsatzEur:          bl.avg_umsatz_eur !== null ? Number(bl.avg_umsatz_eur) : null,
        p25UmsatzEur:          bl.p25_umsatz_eur !== null ? Number(bl.p25_umsatz_eur) : null,
        p75UmsatzEur:          bl.p75_umsatz_eur !== null ? Number(bl.p75_umsatz_eur) : null,
        avgLieferungen:        bl.avg_lieferungen !== null ? Number(bl.avg_lieferungen) : null,
        p25Lieferungen:        bl.p25_lieferungen !== null ? Number(bl.p25_lieferungen) : null,
        p75Lieferungen:        bl.p75_lieferungen !== null ? Number(bl.p75_lieferungen) : null,
        avgDeliveryMin:        bl.avg_delivery_min !== null ? Number(bl.avg_delivery_min) : null,
        p25DeliveryMin:        bl.p25_delivery_min !== null ? Number(bl.p25_delivery_min) : null,
        p75DeliveryMin:        bl.p75_delivery_min !== null ? Number(bl.p75_delivery_min) : null,
        avgOnTimePct:          bl.avg_on_time_pct !== null ? Number(bl.avg_on_time_pct) : null,
        avgDriverHours:        bl.avg_driver_hours !== null ? Number(bl.avg_driver_hours) : null,
        avgCostPerDeliveryEur: bl.avg_cost_per_delivery_eur !== null ? Number(bl.avg_cost_per_delivery_eur) : null,
        avgNetMarginPct:       bl.avg_net_margin_pct !== null ? Number(bl.avg_net_margin_pct) : null,
        weeksUsed:             bl.weeks_used,
        lastComputedAt:        bl.last_computed_at,
      }
    : null;

  type PerfRow = { avg_delivery_min: number | null; on_time_rate: number | null };
  const perf = perfRes.data as PerfRow | null;

  const today: SchichtTodayData = {
    dayOfWeek,
    date,
    umsatzEur,
    lieferungen,
    bestellungen,
    stornos,
    aktiveFahrer,
    avgBestellwertEur: bestellungen > 0 ? umsatzEur / bestellungen : null,
    onTimePct:         perf?.on_time_rate != null ? Number(perf.on_time_rate) * 100 : null,
    avgDeliveryMin:    perf?.avg_delivery_min != null ? Number(perf.avg_delivery_min) : null,
  };

  const delta: SchichtDelta = {
    umsatzPct:      deltaPct(umsatzEur, baseline?.avgUmsatzEur ?? null),
    lieferungenPct: deltaPct(lieferungen, baseline?.avgLieferungen ?? null),
    deliveryMinPct: deltaPct(today.avgDeliveryMin, baseline?.avgDeliveryMin ?? null),
    onTimePtsDiff:
      today.onTimePct !== null && baseline != null && baseline.avgOnTimePct !== null
        ? today.onTimePct - baseline.avgOnTimePct
        : null,
  };

  const shiftScore  = computeShiftScore(today, baseline, delta);
  const scoreLabel  = scoreToLabel(shiftScore);
  const isOnTrack   = shiftScore >= 50;
  const recommendation = buildRecommendation(today, baseline, delta, shiftScore);

  return {
    locationId,
    today,
    baseline,
    delta,
    shiftScore,
    scoreLabel,
    isOnTrack,
    recommendation,
    computedAt: new Date().toISOString(),
  };
}

// ── getSchichtVergleichHistory ────────────────────────────────────────────────

export async function getSchichtVergleichHistory(
  locationId: string,
  dayOfWeek: number,
  weeks = 8,
): Promise<SchichtVergleichHistoryPoint[]> {
  const svc = createServiceClient();

  const { data: roiRows } = await svc
    .from('schicht_roi_daily')
    .select('snapshot_date, revenue_eur, delivery_count, active_driver_hours, net_margin_pct')
    .eq('location_id', locationId)
    .order('snapshot_date', { ascending: false })
    .limit(weeks * 8);

  type RoiRow = {
    snapshot_date: string;
    revenue_eur: number | null;
    delivery_count: number | null;
    active_driver_hours: number | null;
    net_margin_pct: number | null;
  };

  const filtered = ((roiRows ?? []) as RoiRow[])
    .filter((r) => new Date(r.snapshot_date as string).getUTCDay() === dayOfWeek)
    .slice(0, weeks);

  if (filtered.length === 0) return [];

  const oldest = filtered[filtered.length - 1].snapshot_date as string;
  const newest = filtered[0].snapshot_date as string;
  const newestNext = new Date(newest);
  newestNext.setDate(newestNext.getDate() + 1);

  const { data: perfRows } = await svc
    .from('delivery_performance')
    .select('snapshot_date, avg_delivery_min, on_time_rate')
    .eq('location_id', locationId)
    .gte('snapshot_date', oldest)
    .lte('snapshot_date', newestNext.toISOString().slice(0, 10))
    .order('snapshot_date', { ascending: false })
    .limit(weeks * 3);

  type PerfRow = { snapshot_date: string; avg_delivery_min: number | null; on_time_rate: number | null };
  const perfMap = new Map<string, PerfRow>();
  for (const p of (perfRows ?? []) as PerfRow[]) {
    perfMap.set(p.snapshot_date as string, p);
  }

  return filtered.map((r) => {
    const perf = perfMap.get(r.snapshot_date as string);
    return {
      snapshotDate:  r.snapshot_date as string,
      revenueEur:    Number(r.revenue_eur ?? 0),
      deliveryCount: Number(r.delivery_count ?? 0),
      avgDeliveryMin: perf?.avg_delivery_min != null ? Number(perf.avg_delivery_min) : null,
      onTimePct:     perf?.on_time_rate != null ? Number(perf.on_time_rate) * 100 : null,
      netMarginPct:  r.net_margin_pct != null ? Number(r.net_margin_pct) : null,
      driverHours:   r.active_driver_hours != null ? Number(r.active_driver_hours) : null,
    };
  }).reverse(); // chronologisch
}
