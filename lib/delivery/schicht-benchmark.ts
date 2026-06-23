/**
 * lib/delivery/schicht-benchmark.ts — Phase 463
 *
 * Schicht-Leistungs-Benchmark: Vergleicht die heutige Schicht mit dem
 * Durchschnitt derselben Wochentag-Schichten der letzten 4 Wochen.
 *
 * Metriken:
 *   bestellungen       — Anzahl abgeschlossener Bestellungen
 *   umsatz_eur         — Bruttoeinnahmen der Schicht
 *   puenktlichkeit_pct — Ø Pünktlichkeitsquote (On-Time-Rate) %
 *   composite_score    — Ø Fahrer-Composite-Score (0–100)
 *   avg_delivery_min   — Ø Lieferzeit in Minuten
 *
 * Datenquellen:
 *   schicht_abschluss_berichte — Tages-Zusammenfassungen je Fahrer
 *   customer_orders            — Umsatz & Bestellzahl heute
 *
 * Public API:
 *   computeBenchmarks(locationId, datum?)        — Berechnet + speichert alle 5 Metriken
 *   computeBenchmarksAllLocations(datum?)        — Cron-Batch
 *   getBenchmarks(locationId, datum?)            — Liest gespeicherte Benchmarks
 *   getBenchmarkLive(locationId)                 — Berechnet Live ohne Speichern (für API)
 *   pruneOldBenchmarks(daysOld?)                 — Cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export type BenchmarkTyp =
  | 'bestellungen'
  | 'umsatz_eur'
  | 'puenktlichkeit_pct'
  | 'composite_score'
  | 'avg_delivery_min';

export interface SchichtBenchmarkRow {
  id:               string;
  locationId:       string;
  schichtDatum:     string;
  benchmarkTyp:     BenchmarkTyp;
  istWert:          number | null;
  benchmarkWert:    number | null;
  abweichungPct:    number | null;
  wochenReferenz:   number;
  berechnetAm:      string;
}

export interface SchichtBenchmarkSummary {
  locationId:       string;
  schichtDatum:     string;
  bestellungen:     MetrikBenchmark;
  umsatzEur:        MetrikBenchmark;
  puenktlichkeitPct: MetrikBenchmark;
  compositeScore:   MetrikBenchmark;
  avgDeliveryMin:   MetrikBenchmark;
  gesamtTrend:      'stark' | 'besser' | 'neutral' | 'schwaecher' | 'schwach';
  berechnetAm:      string;
}

export interface MetrikBenchmark {
  istWert:       number | null;
  benchmarkWert: number | null;
  abweichungPct: number | null;
  trend:         'stark_besser' | 'besser' | 'neutral' | 'schlechter' | 'stark_schlechter';
}

export interface ComputeResult {
  locationId:   string;
  schichtDatum: string;
  upserted:     number;
  skipped:      boolean;
  reason?:      string;
}

export interface ComputeAllResult {
  locations: number;
  computed:  number;
  errors:    number;
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

function calcAbweichung(ist: number | null, bench: number | null): number | null {
  if (ist === null || bench === null || bench === 0) return null;
  return Math.round(((ist - bench) / bench) * 10000) / 100;
}

function toTrend(
  abwPct: number | null,
  invertiert = false, // true = niedriger ist besser (z.B. delivery_min)
): MetrikBenchmark['trend'] {
  if (abwPct === null) return 'neutral';
  const pct = invertiert ? -abwPct : abwPct;
  if (pct >= 15)  return 'stark_besser';
  if (pct >= 5)   return 'besser';
  if (pct <= -15) return 'stark_schlechter';
  if (pct <= -5)  return 'schlechter';
  return 'neutral';
}

function gesamtTrend(summary: Omit<SchichtBenchmarkSummary, 'gesamtTrend' | 'berechnetAm' | 'locationId' | 'schichtDatum'>): SchichtBenchmarkSummary['gesamtTrend'] {
  const scores: Record<MetrikBenchmark['trend'], number> = {
    stark_besser: 2, besser: 1, neutral: 0, schlechter: -1, stark_schlechter: -2,
  };
  const metriken = [summary.bestellungen, summary.umsatzEur, summary.puenktlichkeitPct, summary.compositeScore, summary.avgDeliveryMin];
  const validTrends = metriken.filter(m => m.abweichungPct !== null).map(m => scores[m.trend]);
  if (validTrends.length === 0) return 'neutral';
  const avg = validTrends.reduce((a, b) => a + b, 0) / validTrends.length;
  if (avg >= 1.5)  return 'stark';
  if (avg >= 0.5)  return 'besser';
  if (avg <= -1.5) return 'schwach';
  if (avg <= -0.5) return 'schwaecher';
  return 'neutral';
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function sameWeekdayDates(refDate: Date, weeksBack: number): string[] {
  const dates: string[] = [];
  for (let i = 1; i <= weeksBack; i++) {
    const d = new Date(refDate);
    d.setDate(d.getDate() - i * 7);
    dates.push(isoDate(d));
  }
  return dates;
}

// ── Haupt-Engine ───────────────────────────────────────────────────────────────

export async function computeBenchmarks(
  locationId: string,
  datum?: string,
  weeksBack = 4,
): Promise<ComputeResult> {
  const supabase = createServiceClient();
  const today = datum ?? isoDate(new Date());
  const refDate = new Date(today + 'T12:00:00Z');
  const vergleichsDaten = sameWeekdayDates(refDate, weeksBack);

  // ── 1. Heutige Ist-Werte aus customer_orders ──────────────────────────────

  const { data: heuteOrders } = await supabase
    .from('customer_orders')
    .select('total_price, status, created_at')
    .eq('location_id', locationId)
    .gte('created_at', today + 'T00:00:00Z')
    .lt('created_at', today + 'T23:59:59Z');

  const heuteBestellungen = (heuteOrders ?? []).filter(
    (o) => !['cancelled', 'storniert'].includes(o.status ?? ''),
  ).length;

  const heuteUmsatz = (heuteOrders ?? [])
    .filter((o) => !['cancelled', 'storniert'].includes(o.status ?? ''))
    .reduce((s, o) => s + (Number(o.total_price) || 0), 0);

  // ── 2. Heutige Schicht-KPIs aus schicht_abschluss_berichte ────────────────

  const { data: heuteSchichten } = await supabase
    .from('schicht_abschluss_berichte')
    .select('puenktlichkeits_pct, composite_score, avg_delivery_min')
    .eq('location_id', locationId)
    .eq('schicht_datum', today);

  const validPuenkt = (heuteSchichten ?? []).filter((s) => s.puenktlichkeits_pct !== null);
  const validScore  = (heuteSchichten ?? []).filter((s) => s.composite_score !== null);
  const validDeliv  = (heuteSchichten ?? []).filter((s) => s.avg_delivery_min !== null);

  const heutePuenktlichkeit = validPuenkt.length > 0
    ? validPuenkt.reduce((s, r) => s + Number(r.puenktlichkeits_pct), 0) / validPuenkt.length
    : null;
  const heuteScore = validScore.length > 0
    ? validScore.reduce((s, r) => s + Number(r.composite_score), 0) / validScore.length
    : null;
  const heuteDelivMin = validDeliv.length > 0
    ? validDeliv.reduce((s, r) => s + Number(r.avg_delivery_min), 0) / validDeliv.length
    : null;

  // ── 3. Historische Benchmark-Werte (gleicher Wochentag, letzte 4 Wochen) ──

  const { data: histOrders } = await supabase
    .from('customer_orders')
    .select('created_at, total_price, status')
    .eq('location_id', locationId)
    .in('created_at', vergleichsDaten.flatMap((d) => [
      { gte: d + 'T00:00:00Z', lt: d + 'T23:59:59Z' },
    ]))
    // Use OR filter approach: date range over 4 separate days
    .gte('created_at', vergleichsDaten[vergleichsDaten.length - 1] + 'T00:00:00Z')
    .lte('created_at', vergleichsDaten[0] + 'T23:59:59Z');

  // Group by day and filter for matching weekday dates
  const histByDay: Record<string, { bestellungen: number; umsatz: number }> = {};
  for (const datum of vergleichsDaten) {
    histByDay[datum] = { bestellungen: 0, umsatz: 0 };
  }
  for (const o of histOrders ?? []) {
    if (!o.created_at || ['cancelled', 'storniert'].includes(o.status ?? '')) continue;
    const d = o.created_at.slice(0, 10);
    if (histByDay[d]) {
      histByDay[d].bestellungen++;
      histByDay[d].umsatz += Number(o.total_price) || 0;
    }
  }
  const histDayValues = Object.values(histByDay).filter((v) => v.bestellungen > 0);
  const benchBestellungen = histDayValues.length > 0
    ? histDayValues.reduce((s, v) => s + v.bestellungen, 0) / histDayValues.length
    : null;
  const benchUmsatz = histDayValues.length > 0
    ? histDayValues.reduce((s, v) => s + v.umsatz, 0) / histDayValues.length
    : null;

  const { data: histSchichten } = await supabase
    .from('schicht_abschluss_berichte')
    .select('schicht_datum, puenktlichkeits_pct, composite_score, avg_delivery_min')
    .eq('location_id', locationId)
    .in('schicht_datum', vergleichsDaten);

  const histByDatumP: number[] = [];
  const histByDatumS: number[] = [];
  const histByDatumD: number[] = [];
  for (const s of histSchichten ?? []) {
    if (s.puenktlichkeits_pct !== null) histByDatumP.push(Number(s.puenktlichkeits_pct));
    if (s.composite_score !== null)     histByDatumS.push(Number(s.composite_score));
    if (s.avg_delivery_min !== null)    histByDatumD.push(Number(s.avg_delivery_min));
  }
  const benchPuenktlichkeit = histByDatumP.length > 0
    ? histByDatumP.reduce((a, b) => a + b, 0) / histByDatumP.length : null;
  const benchScore = histByDatumS.length > 0
    ? histByDatumS.reduce((a, b) => a + b, 0) / histByDatumS.length : null;
  const benchDelivMin = histByDatumD.length > 0
    ? histByDatumD.reduce((a, b) => a + b, 0) / histByDatumD.length : null;

  // ── 4. Abweichungen berechnen + upserten ──────────────────────────────────

  type BenchmarkEntry = {
    location_id:    string;
    schicht_datum:  string;
    benchmark_typ:  BenchmarkTyp;
    ist_wert:       number | null;
    benchmark_wert: number | null;
    abweichung_pct: number | null;
    wochen_referenz: number;
    berechnet_am:   string;
  };

  const now = new Date().toISOString();
  const rows: BenchmarkEntry[] = [
    {
      location_id:    locationId,
      schicht_datum:  today,
      benchmark_typ:  'bestellungen',
      ist_wert:       heuteBestellungen,
      benchmark_wert: benchBestellungen,
      abweichung_pct: calcAbweichung(heuteBestellungen, benchBestellungen),
      wochen_referenz: weeksBack,
      berechnet_am:   now,
    },
    {
      location_id:    locationId,
      schicht_datum:  today,
      benchmark_typ:  'umsatz_eur',
      ist_wert:       Math.round(heuteUmsatz * 100) / 100,
      benchmark_wert: benchUmsatz !== null ? Math.round(benchUmsatz * 100) / 100 : null,
      abweichung_pct: calcAbweichung(heuteUmsatz, benchUmsatz),
      wochen_referenz: weeksBack,
      berechnet_am:   now,
    },
    {
      location_id:    locationId,
      schicht_datum:  today,
      benchmark_typ:  'puenktlichkeit_pct',
      ist_wert:       heutePuenktlichkeit !== null ? Math.round(heutePuenktlichkeit * 100) / 100 : null,
      benchmark_wert: benchPuenktlichkeit !== null ? Math.round(benchPuenktlichkeit * 100) / 100 : null,
      abweichung_pct: calcAbweichung(heutePuenktlichkeit, benchPuenktlichkeit),
      wochen_referenz: weeksBack,
      berechnet_am:   now,
    },
    {
      location_id:    locationId,
      schicht_datum:  today,
      benchmark_typ:  'composite_score',
      ist_wert:       heuteScore !== null ? Math.round(heuteScore * 100) / 100 : null,
      benchmark_wert: benchScore !== null ? Math.round(benchScore * 100) / 100 : null,
      abweichung_pct: calcAbweichung(heuteScore, benchScore),
      wochen_referenz: weeksBack,
      berechnet_am:   now,
    },
    {
      location_id:    locationId,
      schicht_datum:  today,
      benchmark_typ:  'avg_delivery_min',
      ist_wert:       heuteDelivMin !== null ? Math.round(heuteDelivMin * 100) / 100 : null,
      benchmark_wert: benchDelivMin !== null ? Math.round(benchDelivMin * 100) / 100 : null,
      abweichung_pct: calcAbweichung(heuteDelivMin, benchDelivMin),
      wochen_referenz: weeksBack,
      berechnet_am:   now,
    },
  ];

  const { error } = await supabase
    .from('schicht_benchmarks')
    .upsert(rows, { onConflict: 'location_id,schicht_datum,benchmark_typ' });

  if (error) {
    return { locationId, schichtDatum: today, upserted: 0, skipped: false, reason: error.message };
  }

  return { locationId, schichtDatum: today, upserted: rows.length, skipped: false };
}

export async function computeBenchmarksAllLocations(datum?: string): Promise<ComputeAllResult> {
  const supabase = createServiceClient();
  const { data: locations } = await supabase
    .from('locations')
    .select('id')
    .eq('active', true);

  if (!locations?.length) return { locations: 0, computed: 0, errors: 0 };

  const results = await Promise.allSettled(
    locations.map((l) => computeBenchmarks(l.id, datum)),
  );

  let computed = 0;
  let errors = 0;
  for (const r of results) {
    if (r.status === 'fulfilled' && !r.value.skipped) computed++;
    else if (r.status === 'rejected') errors++;
  }
  return { locations: locations.length, computed, errors };
}

export async function getBenchmarks(
  locationId: string,
  datum?: string,
): Promise<SchichtBenchmarkSummary | null> {
  const supabase = createServiceClient();
  const today = datum ?? isoDate(new Date());

  const { data: rows } = await supabase
    .from('schicht_benchmarks')
    .select('*')
    .eq('location_id', locationId)
    .eq('schicht_datum', today);

  if (!rows?.length) return null;

  function findMetrik(typ: BenchmarkTyp, invertiert = false): MetrikBenchmark {
    const row = rows!.find((r) => r.benchmark_typ === typ);
    const istWert = row?.ist_wert !== null ? Number(row?.ist_wert) : null;
    const benchmarkWert = row?.benchmark_wert !== null ? Number(row?.benchmark_wert) : null;
    const abweichungPct = row?.abweichung_pct !== null ? Number(row?.abweichung_pct) : null;
    return {
      istWert,
      benchmarkWert,
      abweichungPct,
      trend: toTrend(abweichungPct, invertiert),
    };
  }

  const summary: Omit<SchichtBenchmarkSummary, 'gesamtTrend' | 'berechnetAm' | 'locationId' | 'schichtDatum'> = {
    bestellungen:     findMetrik('bestellungen'),
    umsatzEur:        findMetrik('umsatz_eur'),
    puenktlichkeitPct: findMetrik('puenktlichkeit_pct'),
    compositeScore:   findMetrik('composite_score'),
    avgDeliveryMin:   findMetrik('avg_delivery_min', true), // niedriger = besser
  };

  return {
    locationId,
    schichtDatum: today,
    ...summary,
    gesamtTrend: gesamtTrend(summary),
    berechnetAm: rows[0]?.berechnet_am ?? new Date().toISOString(),
  };
}

export async function pruneOldBenchmarks(daysOld = 60): Promise<{ pruned: number }> {
  const supabase = createServiceClient();
  const { data } = await supabase.rpc('prune_schicht_benchmarks', { days_old: daysOld });
  return { pruned: (data as number) ?? 0 };
}

// ── Phase 465: Benchmark-Verlauf ───────────────────────────────────────────────

export interface BenchmarkVerlaufTag {
  datum:         string;
  bestellungen:  number | null;
  umsatzEur:     number | null;
  puenktlichkeit: number | null;
  compositeScore: number | null;
  avgDeliveryMin: number | null;
}

export async function getBenchmarkHistory(
  locationId: string,
  daysBack = 28,
): Promise<BenchmarkVerlaufTag[]> {
  const supabase = createServiceClient();
  const since = isoDate(new Date(Date.now() - daysBack * 86_400_000));

  const { data: rows } = await supabase
    .from('schicht_benchmarks')
    .select('schicht_datum, benchmark_typ, ist_wert')
    .eq('location_id', locationId)
    .gte('schicht_datum', since)
    .order('schicht_datum', { ascending: true });

  if (!rows?.length) return [];

  const byDate = new Map<string, BenchmarkVerlaufTag>();
  for (const r of rows) {
    const d = r.schicht_datum as string;
    if (!byDate.has(d)) {
      byDate.set(d, { datum: d, bestellungen: null, umsatzEur: null, puenktlichkeit: null, compositeScore: null, avgDeliveryMin: null });
    }
    const entry = byDate.get(d)!;
    const val = r.ist_wert !== null ? Number(r.ist_wert) : null;
    if (r.benchmark_typ === 'bestellungen')      entry.bestellungen   = val;
    if (r.benchmark_typ === 'umsatz_eur')        entry.umsatzEur      = val;
    if (r.benchmark_typ === 'puenktlichkeit_pct') entry.puenktlichkeit = val;
    if (r.benchmark_typ === 'composite_score')   entry.compositeScore  = val;
    if (r.benchmark_typ === 'avg_delivery_min')  entry.avgDeliveryMin  = val;
  }

  return Array.from(byDate.values());
}
