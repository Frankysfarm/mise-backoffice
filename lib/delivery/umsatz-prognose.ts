/**
 * lib/delivery/umsatz-prognose.ts — Phase 420
 *
 * Umsatz-Prognose-Engine: ML-ähnliche Vorhersage des Tages-/Wochenumsatzes.
 *
 * Algorithmus:
 *   1. Lade schicht_roi_daily der letzten N Tage für die Location
 *   2. Gruppiere nach Wochentag (0–6)
 *   3. Gewichteter Mittelwert mit Exponential-Decay (ältere Tage weniger gewichtet)
 *   4. Konfidenz: Datenpunkte-Anzahl / 52 (max. ein Jahr Wochentage), capped 0–1
 *   5. 80%-Konfidenzband: Median-Absolute-Deviation (MAD) × 1.28
 *   6. Trend: Ø letzte 2 Wochen vs. vorherige 2 Wochen (>5% = up, <-5% = down)
 *
 * Public API:
 *   computeUmsatzPrognose(locationId, daysBack?)         — Heute + nächste 6 Tage berechnen + UPSERT
 *   computeUmsatzPrognoseAllLocations(daysBack?)         — Cron-Batch alle aktiven Standorte
 *   getUmsatzPrognose(locationId)                        — Gespeicherte Prognosen laden (7 Tage)
 *   getUmsatzPrognoseHistory(locationId, days?)          — Historische schicht_roi_daily-Daten
 *   pruneOldUmsatzPrognosen(daysOld?)                    — Alte Prognosen löschen
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export type TrendRichtung = 'up' | 'stable' | 'down';

export interface TagesPrognose {
  prognoseDatum:        string;    // YYYY-MM-DD
  wochentag:            number;    // 0=So … 6=Sa
  wochentagLabel:       string;
  erwarteterUmsatzEur:  number;
  konfidenz:            number;    // 0.0 – 1.0
  rangeLowEur:          number;
  rangeHighEur:         number;
  basisSnapshots:       number;
  trendRichtung:        TrendRichtung;
  avgUmsatzLetzterMonat: number | null;
}

export interface UmsatzPrognoseResult {
  locationId:  string;
  berechnungen: TagesPrognose[];
  berechnungen7TageEur: number;    // Summe der 7-Tage-Prognose
  trendRichtung: TrendRichtung;    // Gesamt-Trend der Location
  letzteAktualisierung: string;
}

export interface SchichtRoiHistorieRow {
  snapshotDate:     string;
  revenueEur:       number;
  deliveryCount:    number;
  netMarginEur:     number | null;
  netMarginPct:     number | null;
  avgOrderValueEur: number | null;
}

export interface ComputeResult {
  locationId: string;
  tage:       number;
  upserted:   number;
  fehler:     number;
  durationMs: number;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

const WOCHENTAG_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function isoDateOffset(baseDate: Date, offsetDays: number): string {
  const d = new Date(baseDate.getTime() + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function tagesDatum(isoDate: string): number {
  return new Date(isoDate + 'T12:00:00Z').getDay();
}

/** Exponential-Decay-Gewicht: ältere Snapshots erhalten weniger Gewicht */
function decayWeight(ageInDays: number, halfLifeDays = 21): number {
  return Math.pow(0.5, ageInDays / halfLifeDays);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Weighted mean */
function weightedMean(values: number[], weights: number[]): number {
  const sumW = weights.reduce((s, w) => s + w, 0);
  if (sumW === 0) return 0;
  return values.reduce((s, v, i) => s + v * weights[i]!, 0) / sumW;
}

/** Median Absolute Deviation for simple interval */
function mad(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)]!;
  const deviations = sorted.map(v => Math.abs(v - med));
  deviations.sort((a, b) => a - b);
  return deviations[Math.floor(deviations.length / 2)]!;
}

function trendRichtungFromDelta(pct: number): TrendRichtung {
  if (pct > 5)  return 'up';
  if (pct < -5) return 'down';
  return 'stable';
}

// ── Kern-Algorithmus ──────────────────────────────────────────────────────────

interface HistoryRow {
  snapshot_date:      string;
  revenue_eur:        number;
  delivery_count:     number;
  net_margin_eur:     number | null;
  avg_order_value_eur: number | null;
}

function computePrognoseForDay(
  targetDate: string,          // YYYY-MM-DD
  targetWochentag: number,     // 0–6
  history: HistoryRow[],
  today: Date,
): TagesPrognose {
  // Alle historischen Snapshots für denselben Wochentag
  const sameDayRows = history.filter(r => tagesDatum(r.snapshot_date) === targetWochentag);

  if (sameDayRows.length === 0) {
    // Fallback: alle Tage nehmen (sehr unsichere Prognose)
    const allRevenues = history.map(r => r.revenue_eur);
    const avg = allRevenues.length > 0
      ? allRevenues.reduce((s, v) => s + v, 0) / allRevenues.length
      : 0;
    return {
      prognoseDatum:        targetDate,
      wochentag:            targetWochentag,
      wochentagLabel:       WOCHENTAG_LABELS[targetWochentag]!,
      erwarteterUmsatzEur:  Math.round(avg * 100) / 100,
      konfidenz:            0.05,
      rangeLowEur:          Math.max(0, Math.round(avg * 0.5 * 100) / 100),
      rangeHighEur:         Math.round(avg * 1.5 * 100) / 100,
      basisSnapshots:       allRevenues.length,
      trendRichtung:        'stable',
      avgUmsatzLetzterMonat: null,
    };
  }

  // Gewichteter Mittelwert mit Exponential-Decay
  const revenues  = sameDayRows.map(r => r.revenue_eur);
  const ages      = sameDayRows.map(r => {
    const diffMs = today.getTime() - new Date(r.snapshot_date + 'T12:00:00Z').getTime();
    return Math.max(0, Math.round(diffMs / 86_400_000));
  });
  const weights   = ages.map(a => decayWeight(a));

  const erwarteterUmsatz = weightedMean(revenues, weights);
  const dispersion       = mad(revenues) * 1.28; // 80%-Band ≈ MAD × 1.28

  // Konfidenz: Anzahl Datenpunkte / 52 Wochen, capped
  const konfidenz = clamp01(sameDayRows.length / 52);

  // Trend: Ø letzte 14 Tage vs. vorherige 14 Tage (nur gleicher Wochentag)
  const cutoffRecent = new Date(today.getTime() - 14 * 86_400_000);
  const cutoffPrior  = new Date(today.getTime() - 28 * 86_400_000);
  const recentRevs   = sameDayRows
    .filter(r => new Date(r.snapshot_date + 'T12:00:00Z') >= cutoffRecent)
    .map(r => r.revenue_eur);
  const priorRevs    = sameDayRows
    .filter(r => {
      const d = new Date(r.snapshot_date + 'T12:00:00Z');
      return d >= cutoffPrior && d < cutoffRecent;
    })
    .map(r => r.revenue_eur);

  let trendRichtung: TrendRichtung = 'stable';
  if (recentRevs.length > 0 && priorRevs.length > 0) {
    const avgRecent = recentRevs.reduce((s, v) => s + v, 0) / recentRevs.length;
    const avgPrior  = priorRevs.reduce((s, v) => s + v, 0) / priorRevs.length;
    const deltaPct  = avgPrior > 0 ? ((avgRecent - avgPrior) / avgPrior) * 100 : 0;
    trendRichtung   = trendRichtungFromDelta(deltaPct);
  }

  // Letzter-Monat-Schnitt (Referenzwert)
  const cutoff30 = new Date(today.getTime() - 30 * 86_400_000);
  const last30   = sameDayRows
    .filter(r => new Date(r.snapshot_date + 'T12:00:00Z') >= cutoff30)
    .map(r => r.revenue_eur);
  const avgLetzterMonat = last30.length > 0
    ? last30.reduce((s, v) => s + v, 0) / last30.length
    : null;

  return {
    prognoseDatum:        targetDate,
    wochentag:            targetWochentag,
    wochentagLabel:       WOCHENTAG_LABELS[targetWochentag]!,
    erwarteterUmsatzEur:  Math.round(erwarteterUmsatz * 100) / 100,
    konfidenz:            Math.round(konfidenz * 1000) / 1000,
    rangeLowEur:          Math.max(0, Math.round((erwarteterUmsatz - dispersion) * 100) / 100),
    rangeHighEur:         Math.round((erwarteterUmsatz + dispersion) * 100) / 100,
    basisSnapshots:       sameDayRows.length,
    trendRichtung,
    avgUmsatzLetzterMonat: avgLetzterMonat != null
      ? Math.round(avgLetzterMonat * 100) / 100
      : null,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Berechnet Umsatzprognosen für heute + nächste 6 Tage und speichert sie. */
export async function computeUmsatzPrognose(
  locationId: string,
  daysBack    = 90,
): Promise<ComputeResult> {
  const svc   = createServiceClient();
  const start = Date.now();
  const today = new Date();
  today.setUTCHours(12, 0, 0, 0); // Mittag UTC → stabile Wochentag-Zuweisung

  const cutoffDate = isoDateOffset(today, -daysBack);
  const { data: rawHistory } = await svc
    .from('schicht_roi_daily')
    .select('snapshot_date, revenue_eur, delivery_count, net_margin_eur, avg_order_value_eur')
    .eq('location_id', locationId)
    .gte('snapshot_date', cutoffDate)
    .order('snapshot_date', { ascending: false });

  const history: HistoryRow[] = (rawHistory ?? []).map(r => ({
    snapshot_date:      String(r.snapshot_date),
    revenue_eur:        Number(r.revenue_eur ?? 0),
    delivery_count:     Number(r.delivery_count ?? 0),
    net_margin_eur:     r.net_margin_eur != null ? Number(r.net_margin_eur) : null,
    avg_order_value_eur: r.avg_order_value_eur != null ? Number(r.avg_order_value_eur) : null,
  }));

  // Prognosen für heute bis +6 Tage
  const prognosen: TagesPrognose[] = [];
  for (let offset = 0; offset < 7; offset++) {
    const targetDate     = isoDateOffset(today, offset);
    const targetWochentag = tagesDatum(targetDate);
    prognosen.push(computePrognoseForDay(targetDate, targetWochentag, history, today));
  }

  // UPSERT
  let upserted = 0;
  let fehler   = 0;
  for (const p of prognosen) {
    const { error } = await svc.from('umsatz_prognose_snapshots').upsert({
      location_id:               locationId,
      prognose_datum:            p.prognoseDatum,
      prognose_typ:              'tag',
      erwarteter_umsatz_eur:     p.erwarteterUmsatzEur,
      konfidenz:                 p.konfidenz,
      range_low_eur:             p.rangeLowEur,
      range_high_eur:            p.rangeHighEur,
      basis_snapshots:           p.basisSnapshots,
      trend_richtung:            p.trendRichtung,
      wochentag:                 p.wochentag,
      avg_umsatz_letzter_monat:  p.avgUmsatzLetzterMonat,
      berechnet_am:              new Date().toISOString(),
    }, { onConflict: 'location_id,prognose_datum,prognose_typ' });

    if (error) fehler++;
    else        upserted++;
  }

  return { locationId, tage: prognosen.length, upserted, fehler, durationMs: Date.now() - start };
}

/** Cron-Batch: alle aktiven Standorte. */
export async function computeUmsatzPrognoseAllLocations(daysBack = 90): Promise<{
  locations: number;
  upserted:  number;
  errors:    number;
}> {
  const svc = createServiceClient();
  const { data: locs } = await svc
    .from('locations')
    .select('id')
    .eq('aktiv', true);

  const results = await Promise.allSettled(
    (locs ?? []).map(l => computeUmsatzPrognose(String(l.id), daysBack)),
  );

  let upserted = 0;
  let errors   = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') upserted += r.value.upserted;
    else                          errors++;
  }
  return { locations: (locs ?? []).length, upserted, errors };
}

/** Lädt die gespeicherten 7-Tages-Prognosen. */
export async function getUmsatzPrognose(locationId: string): Promise<UmsatzPrognoseResult> {
  const svc   = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const end   = isoDateOffset(new Date(), 6);

  const { data } = await svc
    .from('umsatz_prognose_snapshots')
    .select('*')
    .eq('location_id', locationId)
    .eq('prognose_typ', 'tag')
    .gte('prognose_datum', today)
    .lte('prognose_datum', end)
    .order('prognose_datum', { ascending: true });

  const rows = data ?? [];

  const berechnungen: TagesPrognose[] = rows.map(r => ({
    prognoseDatum:        String(r.prognose_datum),
    wochentag:            r.wochentag ?? tagesDatum(String(r.prognose_datum)),
    wochentagLabel:       WOCHENTAG_LABELS[r.wochentag ?? tagesDatum(String(r.prognose_datum))]!,
    erwarteterUmsatzEur:  Number(r.erwarteter_umsatz_eur ?? 0),
    konfidenz:            Number(r.konfidenz ?? 0),
    rangeLowEur:          Number(r.range_low_eur ?? 0),
    rangeHighEur:         Number(r.range_high_eur ?? 0),
    basisSnapshots:       Number(r.basis_snapshots ?? 0),
    trendRichtung:        (r.trend_richtung as TrendRichtung) ?? 'stable',
    avgUmsatzLetzterMonat: r.avg_umsatz_letzter_monat != null
      ? Number(r.avg_umsatz_letzter_monat)
      : null,
  }));

  const gesamt7Tage = berechnungen.reduce((s, b) => s + b.erwarteterUmsatzEur, 0);

  // Gesamt-Trend: Mehrheitsentscheid
  const trendCounts = { up: 0, stable: 0, down: 0 };
  for (const b of berechnungen) trendCounts[b.trendRichtung]++;
  const gesamtTrend: TrendRichtung =
    trendCounts.up > trendCounts.down
      ? 'up'
      : trendCounts.down > trendCounts.up
        ? 'down'
        : 'stable';

  return {
    locationId,
    berechnungen,
    berechnungen7TageEur:  Math.round(gesamt7Tage * 100) / 100,
    trendRichtung:          gesamtTrend,
    letzteAktualisierung:  rows[0]?.berechnet_am
      ? String(rows[0].berechnet_am)
      : new Date().toISOString(),
  };
}

/** Historische schicht_roi_daily-Daten für das Chart. */
export async function getUmsatzPrognoseHistory(
  locationId: string,
  days = 30,
): Promise<SchichtRoiHistorieRow[]> {
  const svc      = createServiceClient();
  const cutoff   = isoDateOffset(new Date(), -days);

  const { data } = await svc
    .from('schicht_roi_daily')
    .select('snapshot_date, revenue_eur, delivery_count, net_margin_eur, avg_order_value_eur')
    .eq('location_id', locationId)
    .gte('snapshot_date', cutoff)
    .order('snapshot_date', { ascending: true });

  return (data ?? []).map(r => ({
    snapshotDate:     String(r.snapshot_date),
    revenueEur:       Number(r.revenue_eur ?? 0),
    deliveryCount:    Number(r.delivery_count ?? 0),
    netMarginEur:     r.net_margin_eur != null ? Number(r.net_margin_eur) : null,
    netMarginPct:     null,
    avgOrderValueEur: r.avg_order_value_eur != null ? Number(r.avg_order_value_eur) : null,
  }));
}

/** Cleanup alter Prognose-Einträge (abgelaufene Daten). */
export async function pruneOldUmsatzPrognosen(daysOld = 60): Promise<number> {
  const svc = createServiceClient();
  const { error } = await svc.rpc('prune_umsatz_prognose_snapshots', { days_old: daysOld });
  if (error) console.error('[umsatz-prognose] prune error:', error);
  return 0;
}
