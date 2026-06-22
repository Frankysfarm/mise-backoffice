/**
 * lib/delivery/schicht-prognose-analyse.ts — Phase 401
 *
 * Schicht-Prognose-Genauigkeits-Analyse
 *
 * Schließt den Feedback-Loop für den Schicht-Ziel-Optimierer (Phase 400):
 * Vergleicht genehmigte Ziel-Vorschläge (schicht_ziel_vorschlaege) mit den
 * tatsächlichen Tages-Ergebnissen (schicht_roi_daily) und persistiert
 * Genauigkeitsmetriken in schicht_prognose_genauigkeit.
 *
 * Metriken:
 *  - MAPE (Mean Absolute Percentage Error) für Umsatz und Lieferungen
 *  - Richtungsfehler (over/under/on_target)
 *  - Kombinierter MAPE (Mittel beider Dimensionen)
 *  - Trend der Prognosequalität über Wochen
 *
 * Public API:
 *  analyzeWeek(locationId, weekStart?)           — Analyse für eine Woche
 *  analyzeWeekAllLocations(weekStart?)           — Cron-Batch alle Standorte
 *  getPrognoseGenauigkeit(locationId, weeksBack) — Wöchentliche Genauigkeitshistorie
 *  getDayAccuracy(locationId)                    — Genauigkeit je Wochentag (0–6)
 *  getAccuracySummary(locationId)                — Zusammenfassung + Empfehlung
 *  pruneOldAnalyses(daysToKeep)                  — Cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export interface WeekAnalysisResult {
  locationId:   string;
  weekStart:    string;
  analyzed:     number;   // Tage mit Vorschlag + Ist-Daten
  skipped:      number;   // Tage ohne Vorschlag oder ohne Ist-Daten
  avgMape:      number | null;
}

export interface AllLocationsAnalysisResult {
  locations: number;
  analyzed:  number;
  errors:    number;
}

export interface PrognoseGenauigkeitRow {
  id:                        string;
  locationId:                string;
  dayOfWeek:                 number;
  dayName:                   string;
  weekStart:                 string;
  vorgeschlagenerUmsatz:     number;
  tatsaechlicherUmsatz:      number;
  umsatzAbweichungEur:       number;
  umsatzMapePct:             number;
  vorgeschlageneLieferungen: number;
  tatsaechlicheLieferungen:  number;
  lieferAbweichung:          number;
  lieferMapePct:             number;
  combinedMapePct:           number;
  confidenceScore:           number;
  wasApproved:               boolean;
  overUnder:                 'over' | 'under' | 'on_target' | null;
  snapshotDate:              string;
  analysisDate:              string;
  createdAt:                 string;
}

export interface DayAccuracy {
  dayOfWeek:     number;
  dayName:       string;
  avgMapePct:    number | null;
  avgUmsatzMape: number | null;
  avgLieferMape: number | null;
  sampleCount:   number;
  biasTendency:  'over' | 'under' | 'balanced' | null;
}

export interface AccuracySummary {
  locationId:          string;
  overallMape:         number | null;  // Durchschnitt aller kombinierten MAPEs
  umsatzMape:          number | null;
  lieferMape:          number | null;
  totalDaysAnalyzed:   number;
  weeksWithData:       number;
  bestDay:             { dayName: string; mapePct: number } | null;
  worstDay:            { dayName: string; mapePct: number } | null;
  biasTendency:        'over' | 'under' | 'balanced';
  qualityGrade:        'A' | 'B' | 'C' | 'D';  // A=<10% MAPE, B=<20%, C=<35%, D=≥35%
  qualityLabel:        string;
  recommendation:      string;
  trend:               'improving' | 'stable' | 'worsening' | 'insufficient_data';
}

export interface WeeklyAccuracyPoint {
  weekStart:       string;
  avgMapePct:      number;
  avgUmsatzMape:   number;
  avgLieferMape:   number;
  daysAnalyzed:    number;
  daysOver:        number;
  daysUnder:       number;
  daysOnTarget:    number;
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function mondayOfWeek(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr + 'T00:00:00Z') : new Date();
  // Go back to previous Monday
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(d.getTime() + diffToMon * 86_400_000);
  return mon.toISOString().slice(0, 10);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function mape(actual: number, forecast: number): number {
  if (Math.abs(actual) < 0.01) return forecast === 0 ? 0 : 100;
  return Math.abs((actual - forecast) / actual) * 100;
}

function overUnder(actual: number, forecast: number): 'over' | 'under' | 'on_target' {
  if (forecast === 0 && actual === 0) return 'on_target';
  const errPct = forecast === 0 ? 100 : Math.abs((actual - forecast) / forecast) * 100;
  if (errPct < 5) return 'on_target';
  return actual < forecast ? 'over' : 'under';
}

function gradeFromMape(mapePct: number | null): 'A' | 'B' | 'C' | 'D' {
  if (mapePct === null) return 'D';
  if (mapePct < 10)  return 'A';
  if (mapePct < 20)  return 'B';
  if (mapePct < 35)  return 'C';
  return 'D';
}

function gradeLabel(grade: 'A' | 'B' | 'C' | 'D'): string {
  const labels: Record<string, string> = {
    A: 'Sehr genau (< 10 % MAPE)',
    B: 'Gut (< 20 % MAPE)',
    C: 'Verbesserungsbedarf (< 35 % MAPE)',
    D: 'Ungenau (≥ 35 % MAPE)',
  };
  return labels[grade] ?? 'Unbekannt';
}

function buildRecommendation(summary: {
  overallMape: number | null;
  biasTendency: 'over' | 'under' | 'balanced';
  trend: string;
}): string {
  const { overallMape, biasTendency, trend } = summary;
  const parts: string[] = [];

  if (overallMape === null || overallMape === 0) {
    return 'Noch keine Genauigkeitsdaten vorhanden. Führe mindestens 2 genehmigte Wochen durch.';
  }

  if (overallMape < 10) {
    parts.push('Exzellente Prognosequalität — keine Anpassungen erforderlich.');
  } else if (overallMape < 20) {
    parts.push('Gute Prognosequalität.');
  } else if (overallMape < 35) {
    parts.push('Prognosequalität ist ausbaufähig.');
  } else {
    parts.push('Prognosequalität ist unbefriedigend — manuelle Ziele prüfen.');
  }

  if (biasTendency === 'over') {
    parts.push('Ziele werden systematisch zu hoch angesetzt — eher P60 statt P75 verwenden.');
  } else if (biasTendency === 'under') {
    parts.push('Ziele werden zu konservativ angesetzt — mehr Wochen als Basis nutzen.');
  }

  if (trend === 'improving') {
    parts.push('Prognosequalität verbessert sich.');
  } else if (trend === 'worsening') {
    parts.push('Prognosequalität nimmt ab — Ziel-Vorschläge neu generieren.');
  }

  return parts.join(' ');
}

// ── Kern-Analyse ───────────────────────────────────────────────────────────────

/**
 * Analysiert eine Woche (Mon–So) und speichert Genauigkeitswerte je Wochentag.
 * Analysiert nur Wochentage, für die genehmigte Vorschläge existieren.
 */
export async function analyzeWeek(
  locationId: string,
  weekStartDate?: string,
): Promise<WeekAnalysisResult> {
  const svc = createServiceClient();

  // Immer letzten abgeschlossenen Montag nehmen, damit alle 7 Tage Ist-Daten haben
  const defaultWeek = addDays(mondayOfWeek(), -7);
  const weekStart = weekStartDate ?? defaultWeek;
  const weekEnd   = addDays(weekStart, 6);  // Sonntag

  // 1. Genehmigte Vorschläge für diesen Standort laden
  const { data: vorschlaege } = await svc
    .from('schicht_ziel_vorschlaege')
    .select('day_of_week, suggested_umsatz, suggested_lieferungen, confidence_score, status')
    .eq('location_id', locationId)
    .eq('status', 'approved');

  if (!vorschlaege || vorschlaege.length === 0) {
    return { locationId, weekStart, analyzed: 0, skipped: 7, avgMape: null };
  }

  type VorschlagRow = {
    day_of_week: number;
    suggested_umsatz: number;
    suggested_lieferungen: number;
    confidence_score: number;
    status: string;
  };
  const vMap = new Map<number, VorschlagRow>();
  for (const v of vorschlaege as VorschlagRow[]) {
    vMap.set(Number(v.day_of_week), v);
  }

  // 2. Schicht-ROI-Ist-Daten für die Woche laden
  const { data: roiRows } = await svc
    .from('schicht_roi_daily')
    .select('snapshot_date, revenue_eur, delivery_count')
    .eq('location_id', locationId)
    .gte('snapshot_date', weekStart)
    .lte('snapshot_date', weekEnd);

  type RoiRow = { snapshot_date: string; revenue_eur: number; delivery_count: number };
  const roiMap = new Map<string, RoiRow>();
  for (const r of (roiRows ?? []) as RoiRow[]) {
    roiMap.set(r.snapshot_date as string, r);
  }

  // 3. Für jeden Wochentag vergleichen
  const upsertRows: Record<string, unknown>[] = [];
  let analyzed = 0;
  let skipped  = 0;
  const mapeValues: number[] = [];

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date    = addDays(weekStart, dayOffset);
    const dateObj = new Date(date + 'T00:00:00Z');
    const dow     = dateObj.getUTCDay(); // 0=Sun, 1=Mon, …, 6=Sat

    const v = vMap.get(dow);
    if (!v) { skipped++; continue; }

    const roi = roiMap.get(date);
    if (!roi) { skipped++; continue; }

    const vorgeschlagenerUmsatz     = Number(v.suggested_umsatz ?? 0);
    const tatsaechlicherUmsatz      = Number(roi.revenue_eur ?? 0);
    const vorgeschlageneLieferungen = Number(v.suggested_lieferungen ?? 0);
    const tatsaechlicheLieferungen  = Number(roi.delivery_count ?? 0);

    const umsatzMape  = mape(tatsaechlicherUmsatz, vorgeschlagenerUmsatz);
    const lieferMape  = mape(tatsaechlicheLieferungen, vorgeschlageneLieferungen);
    const combinedMape = (umsatzMape + lieferMape) / 2;
    const ou = overUnder(tatsaechlicherUmsatz, vorgeschlagenerUmsatz);

    mapeValues.push(combinedMape);
    analyzed++;

    upsertRows.push({
      location_id:                locationId,
      day_of_week:                dow,
      week_start:                 weekStart,
      vorgeschlagener_umsatz:     vorgeschlagenerUmsatz,
      tatsaechlicher_umsatz:      tatsaechlicherUmsatz,
      umsatz_abweichung_eur:      Math.round((tatsaechlicherUmsatz - vorgeschlagenerUmsatz) * 100) / 100,
      umsatz_mape_pct:            Math.round(umsatzMape * 100) / 100,
      vorgeschlagene_lieferungen: vorgeschlageneLieferungen,
      tatsaechliche_lieferungen:  tatsaechlicheLieferungen,
      liefer_abweichung:          tatsaechlicheLieferungen - vorgeschlageneLieferungen,
      liefer_mape_pct:            Math.round(lieferMape * 100) / 100,
      combined_mape_pct:          Math.round(combinedMape * 100) / 100,
      confidence_score:           Number(v.confidence_score ?? 0),
      was_approved:               true,
      over_under:                 ou,
      snapshot_date:              date,
      analysis_date:              new Date().toISOString().slice(0, 10),
    });
  }

  if (upsertRows.length > 0) {
    await svc
      .from('schicht_prognose_genauigkeit')
      .upsert(upsertRows, { onConflict: 'location_id,day_of_week,week_start' });
  }

  const avgMape = mapeValues.length > 0
    ? mapeValues.reduce((s, v) => s + v, 0) / mapeValues.length
    : null;

  return { locationId, weekStart, analyzed, skipped, avgMape };
}

/**
 * Cron-Batch: analysiert alle aktiven Standorte für die letzte Woche.
 * Laufen täglich Mo 03:00 UTC (nach schicht_roi_daily-Snapshot).
 */
export async function analyzeWeekAllLocations(
  weekStartDate?: string,
): Promise<AllLocationsAnalysisResult> {
  const svc = createServiceClient();

  const { data: locations } = await svc
    .from('locations')
    .select('id')
    .eq('is_active', true);

  if (!locations || locations.length === 0) {
    return { locations: 0, analyzed: 0, errors: 0 };
  }

  const results = await Promise.allSettled(
    (locations as { id: string }[]).map((l) => analyzeWeek(l.id, weekStartDate)),
  );

  let analyzed = 0;
  let errors   = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') analyzed++;
    else errors++;
  }

  return { locations: locations.length, analyzed, errors };
}

// ── Lesefunktionen ─────────────────────────────────────────────────────────────

/**
 * Wöchentliche Genauigkeitshistorie für ein Location (Chart-Daten).
 */
export async function getPrognoseGenauigkeit(
  locationId: string,
  weeksBack = 12,
): Promise<WeeklyAccuracyPoint[]> {
  const svc = createServiceClient();
  const since = addDays(mondayOfWeek(), -weeksBack * 7);

  const { data } = await svc
    .from('schicht_prognose_genauigkeit')
    .select('week_start, combined_mape_pct, umsatz_mape_pct, liefer_mape_pct, over_under')
    .eq('location_id', locationId)
    .gte('week_start', since)
    .order('week_start', { ascending: false });

  if (!data || data.length === 0) return [];

  type Row = {
    week_start: string;
    combined_mape_pct: number;
    umsatz_mape_pct: number;
    liefer_mape_pct: number;
    over_under: string | null;
  };

  const byWeek = new Map<string, Row[]>();
  for (const r of data as Row[]) {
    const key = r.week_start as string;
    if (!byWeek.has(key)) byWeek.set(key, []);
    byWeek.get(key)!.push(r);
  }

  const result: WeeklyAccuracyPoint[] = [];
  for (const [weekStart, rows] of byWeek) {
    const n = rows.length;
    result.push({
      weekStart,
      avgMapePct:    Math.round((rows.reduce((s, r) => s + Number(r.combined_mape_pct), 0) / n) * 10) / 10,
      avgUmsatzMape: Math.round((rows.reduce((s, r) => s + Number(r.umsatz_mape_pct), 0) / n) * 10) / 10,
      avgLieferMape: Math.round((rows.reduce((s, r) => s + Number(r.liefer_mape_pct), 0) / n) * 10) / 10,
      daysAnalyzed:  n,
      daysOver:      rows.filter((r) => r.over_under === 'over').length,
      daysUnder:     rows.filter((r) => r.over_under === 'under').length,
      daysOnTarget:  rows.filter((r) => r.over_under === 'on_target').length,
    });
  }

  return result.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

/**
 * Genauigkeit aggregiert je Wochentag (für Balken-Chart).
 */
export async function getDayAccuracy(locationId: string): Promise<DayAccuracy[]> {
  const svc = createServiceClient();
  const since = addDays(mondayOfWeek(), -90); // 90 Tage zurück

  const { data } = await svc
    .from('schicht_prognose_genauigkeit')
    .select('day_of_week, combined_mape_pct, umsatz_mape_pct, liefer_mape_pct, over_under')
    .eq('location_id', locationId)
    .gte('week_start', since);

  type Row = {
    day_of_week: number;
    combined_mape_pct: number;
    umsatz_mape_pct: number;
    liefer_mape_pct: number;
    over_under: string | null;
  };

  const byDow = new Map<number, Row[]>();
  for (const r of (data ?? []) as Row[]) {
    const dow = Number(r.day_of_week);
    if (!byDow.has(dow)) byDow.set(dow, []);
    byDow.get(dow)!.push(r);
  }

  return Array.from({ length: 7 }, (_, dow) => {
    const rows = byDow.get(dow) ?? [];
    const n = rows.length;

    if (n === 0) {
      return {
        dayOfWeek: dow,
        dayName: DAY_NAMES[dow],
        avgMapePct: null,
        avgUmsatzMape: null,
        avgLieferMape: null,
        sampleCount: 0,
        biasTendency: null,
      };
    }

    const overCount  = rows.filter((r) => r.over_under === 'over').length;
    const underCount = rows.filter((r) => r.over_under === 'under').length;
    let biasTendency: 'over' | 'under' | 'balanced';
    if (overCount > underCount * 2)  biasTendency = 'over';
    else if (underCount > overCount * 2) biasTendency = 'under';
    else biasTendency = 'balanced';

    return {
      dayOfWeek: dow,
      dayName: DAY_NAMES[dow],
      avgMapePct:    Math.round((rows.reduce((s, r) => s + Number(r.combined_mape_pct), 0) / n) * 10) / 10,
      avgUmsatzMape: Math.round((rows.reduce((s, r) => s + Number(r.umsatz_mape_pct), 0) / n) * 10) / 10,
      avgLieferMape: Math.round((rows.reduce((s, r) => s + Number(r.liefer_mape_pct), 0) / n) * 10) / 10,
      sampleCount:   n,
      biasTendency,
    };
  });
}

/**
 * Zusammenfassung mit Gesamtbewertung und Handlungsempfehlung.
 */
export async function getAccuracySummary(locationId: string): Promise<AccuracySummary> {
  const svc = createServiceClient();
  const since = addDays(mondayOfWeek(), -90);

  const { data } = await svc
    .from('schicht_prognose_genauigkeit')
    .select('week_start, combined_mape_pct, umsatz_mape_pct, liefer_mape_pct, over_under, day_of_week')
    .eq('location_id', locationId)
    .gte('week_start', since)
    .order('week_start', { ascending: true });

  type Row = {
    week_start: string;
    combined_mape_pct: number;
    umsatz_mape_pct: number;
    liefer_mape_pct: number;
    over_under: string | null;
    day_of_week: number;
  };

  const rows = (data ?? []) as Row[];

  if (rows.length === 0) {
    const summary: AccuracySummary = {
      locationId,
      overallMape: null,
      umsatzMape: null,
      lieferMape: null,
      totalDaysAnalyzed: 0,
      weeksWithData: 0,
      bestDay: null,
      worstDay: null,
      biasTendency: 'balanced',
      qualityGrade: 'D',
      qualityLabel: gradeLabel('D'),
      recommendation: 'Noch keine Genauigkeitsdaten vorhanden. Führe mindestens 2 genehmigte Wochen durch.',
      trend: 'insufficient_data',
    };
    return summary;
  }

  const n = rows.length;
  const overallMape  = rows.reduce((s, r) => s + Number(r.combined_mape_pct), 0) / n;
  const umsatzMape   = rows.reduce((s, r) => s + Number(r.umsatz_mape_pct), 0) / n;
  const lieferMape   = rows.reduce((s, r) => s + Number(r.liefer_mape_pct), 0) / n;

  const weeks = new Set(rows.map((r) => r.week_start)).size;

  // Bias
  const overCount  = rows.filter((r) => r.over_under === 'over').length;
  const underCount = rows.filter((r) => r.over_under === 'under').length;
  let biasTendency: 'over' | 'under' | 'balanced';
  if (overCount > underCount * 1.5) biasTendency = 'over';
  else if (underCount > overCount * 1.5) biasTendency = 'under';
  else biasTendency = 'balanced';

  // Best / Worst day
  const dowMape: Record<number, number[]> = {};
  for (const r of rows) {
    const dow = Number(r.day_of_week);
    if (!dowMape[dow]) dowMape[dow] = [];
    dowMape[dow].push(Number(r.combined_mape_pct));
  }
  const dowAvg: { dow: number; avg: number }[] = Object.entries(dowMape)
    .filter(([, v]) => v.length >= 2)
    .map(([dow, vals]) => ({
      dow: Number(dow),
      avg: vals.reduce((s, v) => s + v, 0) / vals.length,
    }))
    .sort((a, b) => a.avg - b.avg);

  const bestDay  = dowAvg.length > 0 ? { dayName: DAY_NAMES[dowAvg[0].dow], mapePct: Math.round(dowAvg[0].avg * 10) / 10 } : null;
  const worstDay = dowAvg.length > 0 ? { dayName: DAY_NAMES[dowAvg[dowAvg.length - 1].dow], mapePct: Math.round(dowAvg[dowAvg.length - 1].avg * 10) / 10 } : null;

  // Trend: compare first half vs second half of weeks (by week_start order)
  const uniqueWeeks = [...new Set(rows.map((r) => r.week_start))].sort();
  let trend: AccuracySummary['trend'] = 'insufficient_data';
  if (uniqueWeeks.length >= 4) {
    const half = Math.floor(uniqueWeeks.length / 2);
    const firstWeeks = new Set(uniqueWeeks.slice(0, half));
    const lastWeeks  = new Set(uniqueWeeks.slice(-half));
    const firstMapes = rows.filter((r) => firstWeeks.has(r.week_start)).map((r) => Number(r.combined_mape_pct));
    const lastMapes  = rows.filter((r) => lastWeeks.has(r.week_start)).map((r) => Number(r.combined_mape_pct));
    const firstAvg = firstMapes.reduce((s, v) => s + v, 0) / (firstMapes.length || 1);
    const lastAvg  = lastMapes.reduce((s, v) => s + v, 0) / (lastMapes.length || 1);
    if (firstAvg === 0) {
      trend = 'stable';
    } else {
      const delta = (lastAvg - firstAvg) / firstAvg;
      if (delta < -0.10) trend = 'improving';
      else if (delta > 0.10) trend = 'worsening';
      else trend = 'stable';
    }
  }

  const grade = gradeFromMape(Math.round(overallMape * 10) / 10);

  const summary: AccuracySummary = {
    locationId,
    overallMape:       Math.round(overallMape * 10) / 10,
    umsatzMape:        Math.round(umsatzMape * 10) / 10,
    lieferMape:        Math.round(lieferMape * 10) / 10,
    totalDaysAnalyzed: n,
    weeksWithData:     weeks,
    bestDay,
    worstDay,
    biasTendency,
    qualityGrade:      grade,
    qualityLabel:      gradeLabel(grade),
    recommendation:    buildRecommendation({ overallMape, biasTendency, trend }),
    trend,
  };

  return summary;
}

/**
 * Cleanup: entfernt alte Analyse-Zeilen.
 */
export async function pruneOldAnalyses(daysToKeep = 365): Promise<{ pruned: number }> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .rpc('prune_schicht_prognose_genauigkeit', { days_to_keep: daysToKeep });
  if (error) throw error;
  return { pruned: Number(data ?? 0) };
}
