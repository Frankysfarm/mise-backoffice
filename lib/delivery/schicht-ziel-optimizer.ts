/**
 * lib/delivery/schicht-ziel-optimizer.ts — Phase 400
 *
 * Schicht-Ziel-Optimierer: Analysiert schicht_roi_daily-Verlauf je Wochentag
 * und berechnet statistisch fundierte Ziel-Vorschläge (P75-Ansatz).
 *
 * Logik je Wochentag (0=So … 6=Sa):
 *  - Sammle bis zu `weeksBack` historische Tages-Snapshots
 *  - Berechne Median + P75 für Umsatz und Lieferungen
 *  - Vorschlag = P75 (ambitioniert aber erreichbar, da 75 % der Tage darunter lagen)
 *  - Trend: Vergleich erste Hälfte vs. zweite Hälfte der Datenpunkte (Zeitreihe)
 *  - Konfidenz: linear mit Datenpunkten skaliert (0 Datenpunkte = 0, ≥8 = 1.0)
 *
 * Public API:
 *  generateZielVorschlaege(locationId, weeksBack?)  — Berechnen + in DB schreiben
 *  getZielVorschlaege(locationId)                   — Aus DB lesen
 *  approveVorschlag(locationId, dayOfWeek)          — Status → approved + schicht_targets updaten
 *  declineVorschlag(locationId, dayOfWeek)          — Status → declined
 *  applyAllApproved(locationId)                     — Alle approved → schicht_targets
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export interface ZielVorschlag {
  locationId:          string;
  dayOfWeek:           number;      // 0=So … 6=Sa
  dayName:             string;
  suggestedUmsatz:     number;
  suggestedLieferungen: number;
  confidenceScore:     number;      // 0.0–1.0
  basedOnWeeks:        number;
  reasoning:           string;
  medianUmsatz:        number | null;
  p75Umsatz:           number | null;
  medianLieferungen:   number | null;
  p75Lieferungen:      number | null;
  trendDirection:      'steigend' | 'stabil' | 'sinkend';
  status:              'pending' | 'approved' | 'declined';
  generatedAt:         string;
}

export interface GenerateResult {
  locationId:   string;
  generated:    number;
  weeksAnalyzed: number;
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo  = Math.floor(idx);
  const hi  = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function median(sorted: number[]): number {
  return percentile(sorted, 50);
}

function trendDirection(values: number[]): 'steigend' | 'stabil' | 'sinkend' {
  if (values.length < 4) return 'stabil';
  const half     = Math.floor(values.length / 2);
  const firstAvg = values.slice(0, half).reduce((s, v) => s + v, 0) / half;
  const lastAvg  = values.slice(-half).reduce((s, v) => s + v, 0) / half;
  if (firstAvg === 0) return 'stabil';
  const delta = (lastAvg - firstAvg) / firstAvg;
  if (delta >  0.05) return 'steigend';
  if (delta < -0.05) return 'sinkend';
  return 'stabil';
}

function confidence(dataPoints: number): number {
  return Math.min(1.0, dataPoints / 8);
}

function buildReasoning(
  dow: number,
  dataPoints: number,
  medUmsatz: number,
  p75Umsatz: number,
  trend: 'steigend' | 'stabil' | 'sinkend',
): string {
  if (dataPoints === 0) {
    return `Keine historischen Daten für ${DAY_NAMES[dow]}. Standardziel empfohlen.`;
  }
  const trendText =
    trend === 'steigend' ? 'steigender Trend erkannt' :
    trend === 'sinkend'  ? 'sinkender Trend erkannt' :
    'stabiler Verlauf';
  return (
    `Basis: ${dataPoints} ${DAY_NAMES[dow]}e der letzten Wochen. ` +
    `Median-Umsatz ${medUmsatz.toFixed(0)} €, P75 ${p75Umsatz.toFixed(0)} €. ` +
    `${trendText}. Vorschlag = P75 (75 % der Tage lagen darunter).`
  );
}

// ── generateZielVorschlaege ───────────────────────────────────────────────────

export async function generateZielVorschlaege(
  locationId: string,
  weeksBack: number = 8,
): Promise<GenerateResult> {
  const svc = createServiceClient();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - weeksBack * 7);

  // Historische Snapshots laden
  const { data: rows } = await svc
    .from('schicht_roi_daily')
    .select('snapshot_date, revenue_eur, delivery_count')
    .eq('location_id', locationId)
    .gte('snapshot_date', cutoffDate.toISOString().slice(0, 10))
    .order('snapshot_date', { ascending: true });

  type SnapshotRow = { snapshot_date: string; revenue_eur: number; delivery_count: number };
  const snapshots = (rows ?? []) as SnapshotRow[];

  // Gruppiere nach Wochentag (ISO weekday aus snapshot_date)
  const byDow = new Map<number, { umsatz: number[]; deliveries: number[] }>();
  for (let d = 0; d <= 6; d++) byDow.set(d, { umsatz: [], deliveries: [] });

  for (const row of snapshots) {
    const date = new Date(row.snapshot_date + 'T12:00:00Z');
    const dow  = date.getUTCDay();
    const group = byDow.get(dow)!;
    group.umsatz.push(Number(row.revenue_eur));
    group.deliveries.push(Number(row.delivery_count));
  }

  const now   = new Date().toISOString();
  let generated = 0;

  for (const [dow, group] of byDow.entries()) {
    const sortedUmsatz      = [...group.umsatz].sort((a, b) => a - b);
    const sortedDeliveries  = [...group.deliveries].sort((a, b) => a - b);
    const dataPoints        = sortedUmsatz.length;

    const medUmsatz      = dataPoints > 0 ? median(sortedUmsatz)           : 0;
    const p75Umsatz      = dataPoints > 0 ? percentile(sortedUmsatz, 75)   : 0;
    const medLieferungen = dataPoints > 0 ? median(sortedDeliveries)       : 0;
    const p75Lieferungen = dataPoints > 0 ? percentile(sortedDeliveries, 75) : 0;

    const trend = trendDirection(group.umsatz);
    const conf  = confidence(dataPoints);

    const suggestedUmsatz      = dataPoints > 0 ? Math.round(p75Umsatz)      : 800;
    const suggestedLieferungen = dataPoints > 0 ? Math.round(p75Lieferungen) : 40;

    const reasoning = buildReasoning(dow, dataPoints, medUmsatz, p75Umsatz, trend);

    await svc
      .from('schicht_ziel_vorschlaege')
      .upsert({
        location_id:           locationId,
        day_of_week:           dow,
        suggested_umsatz:      suggestedUmsatz,
        suggested_lieferungen: suggestedLieferungen,
        confidence_score:      conf,
        based_on_weeks:        dataPoints,
        reasoning,
        median_umsatz:         dataPoints > 0 ? Math.round(medUmsatz * 100) / 100 : null,
        p75_umsatz:            dataPoints > 0 ? Math.round(p75Umsatz * 100) / 100 : null,
        median_lieferungen:    dataPoints > 0 ? Math.round(medLieferungen * 100) / 100 : null,
        p75_lieferungen:       dataPoints > 0 ? Math.round(p75Lieferungen * 100) / 100 : null,
        trend_direction:       trend,
        status:                'pending',
        generated_at:          now,
      }, { onConflict: 'location_id,day_of_week' });

    generated++;
  }

  return { locationId, generated, weeksAnalyzed: weeksBack };
}

// ── getZielVorschlaege ────────────────────────────────────────────────────────

export async function getZielVorschlaege(locationId: string): Promise<ZielVorschlag[]> {
  const svc = createServiceClient();

  const { data } = await svc
    .from('schicht_ziel_vorschlaege')
    .select('*')
    .eq('location_id', locationId)
    .order('day_of_week', { ascending: true });

  type Row = {
    location_id:          string;
    day_of_week:          number;
    suggested_umsatz:     number;
    suggested_lieferungen: number;
    confidence_score:     number;
    based_on_weeks:       number;
    reasoning:            string;
    median_umsatz:        number | null;
    p75_umsatz:           number | null;
    median_lieferungen:   number | null;
    p75_lieferungen:      number | null;
    trend_direction:      'steigend' | 'stabil' | 'sinkend';
    status:               'pending' | 'approved' | 'declined';
    generated_at:         string;
  };

  return ((data ?? []) as Row[]).map(r => ({
    locationId:           r.location_id,
    dayOfWeek:            r.day_of_week,
    dayName:              DAY_NAMES[r.day_of_week] ?? `Tag ${r.day_of_week}`,
    suggestedUmsatz:      Number(r.suggested_umsatz),
    suggestedLieferungen: Number(r.suggested_lieferungen),
    confidenceScore:      Number(r.confidence_score),
    basedOnWeeks:         r.based_on_weeks,
    reasoning:            r.reasoning,
    medianUmsatz:         r.median_umsatz !== null ? Number(r.median_umsatz) : null,
    p75Umsatz:            r.p75_umsatz    !== null ? Number(r.p75_umsatz)    : null,
    medianLieferungen:    r.median_lieferungen !== null ? Number(r.median_lieferungen) : null,
    p75Lieferungen:       r.p75_lieferungen    !== null ? Number(r.p75_lieferungen)    : null,
    trendDirection:       r.trend_direction,
    status:               r.status,
    generatedAt:          r.generated_at,
  }));
}

// ── approveVorschlag ──────────────────────────────────────────────────────────

export async function approveVorschlag(
  locationId: string,
  dayOfWeek:  number,
  reviewedBy?: string,
): Promise<{ ok: boolean; message: string }> {
  const svc = createServiceClient();

  // Vorschlag lesen
  const { data: row } = await svc
    .from('schicht_ziel_vorschlaege')
    .select('suggested_umsatz, suggested_lieferungen')
    .eq('location_id', locationId)
    .eq('day_of_week', dayOfWeek)
    .maybeSingle();

  if (!row) return { ok: false, message: 'Vorschlag nicht gefunden' };

  type SuggRow = { suggested_umsatz: number; suggested_lieferungen: number };
  const suggestion = row as SuggRow;

  // Status aktualisieren
  await svc
    .from('schicht_ziel_vorschlaege')
    .update({ status: 'approved', reviewed_by: reviewedBy ?? null, reviewed_at: new Date().toISOString() })
    .eq('location_id', locationId)
    .eq('day_of_week', dayOfWeek);

  // schicht_targets updaten (upsert)
  await svc
    .from('schicht_targets')
    .upsert({
      location_id:      locationId,
      day_of_week:      dayOfWeek,
      umsatz_ziel:      suggestion.suggested_umsatz,
      lieferungen_ziel: suggestion.suggested_lieferungen,
    }, { onConflict: 'location_id,day_of_week' });

  return { ok: true, message: `${DAY_NAMES[dayOfWeek]}: Ziel auf ${suggestion.suggested_umsatz} € / ${suggestion.suggested_lieferungen} Lieferungen gesetzt.` };
}

// ── declineVorschlag ──────────────────────────────────────────────────────────

export async function declineVorschlag(
  locationId: string,
  dayOfWeek:  number,
  reviewedBy?: string,
): Promise<{ ok: boolean }> {
  const svc = createServiceClient();
  await svc
    .from('schicht_ziel_vorschlaege')
    .update({ status: 'declined', reviewed_by: reviewedBy ?? null, reviewed_at: new Date().toISOString() })
    .eq('location_id', locationId)
    .eq('day_of_week', dayOfWeek);
  return { ok: true };
}

// ── applyAllApproved ──────────────────────────────────────────────────────────

export async function applyAllApproved(
  locationId: string,
): Promise<{ applied: number }> {
  const svc = createServiceClient();

  const { data } = await svc
    .from('schicht_ziel_vorschlaege')
    .select('day_of_week, suggested_umsatz, suggested_lieferungen')
    .eq('location_id', locationId)
    .eq('status', 'approved');

  type Row = { day_of_week: number; suggested_umsatz: number; suggested_lieferungen: number };
  const rows = (data ?? []) as Row[];

  for (const r of rows) {
    await svc
      .from('schicht_targets')
      .upsert({
        location_id:      locationId,
        day_of_week:      r.day_of_week,
        umsatz_ziel:      r.suggested_umsatz,
        lieferungen_ziel: r.suggested_lieferungen,
      }, { onConflict: 'location_id,day_of_week' });
  }

  return { applied: rows.length };
}
