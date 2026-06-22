/**
 * lib/delivery/fahrer-zeugnis.ts — Phase 432
 *
 * Fahrer-Leistungs-Zeugnis: Monatliches Leistungszeugnis je Fahrer.
 *
 * Algorithmus:
 *   1. Aggregiere schicht_abschluss_berichte des Vormonats je Fahrer
 *   2. Berechne KPIs: Schichten, Lieferungen, Pünktlichkeit, Score, Verdienst, Top-Zone
 *   3. Berechne Score-Trend vs. Vorvormonat
 *   4. Bestimme Grade (A+/A/B/C/D) aus Composite-Score + Pünktlichkeit
 *   5. Generiere textuelle Bewertung + Highlights
 *   6. UPSERT fahrer_zeugnisse
 *
 * Public API:
 *   generateZeugnis(driverId, locationId, monat?)             — Zeugnis für einen Fahrer
 *   generateZeugnisseForLocation(locationId, monat?)          — Alle Fahrer einer Location
 *   generateZeugnisseAllLocations(monat?)                     — Cron-Batch
 *   getZeugnisseForLocation(locationId, limit?)               — Admin-Lesen
 *   getZeugnisseForDriver(driverId, locationId, limit?)       — Fahrer-Lesen (eigene)
 *   pruneOldZeugnisse(monthsOld?)                             — Cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export type ScoreGrade = 'A+' | 'A' | 'B' | 'C' | 'D';

export interface ZeugnisData {
  schichtenAnzahl:      number;
  lieferungenGesamt:    number;
  puenktlichkeitsPct:   number | null;
  avgDeliveryMin:       number | null;
  compositeScore:       number | null;
  verdienstEur:         number | null;
  topZone:              string | null;
  scoreTrend:           number | null;       // delta vs. Vorvormonat
  scoreTrendPct:        number | null;       // % Veränderung
  stornoratesPct:       number | null;
  avgTouren:            number | null;       // Ø Touren pro Schicht
  highlights:           string[];
  bewertungstext:       string;
  erzielteBoni:         number;              // Anzahl erreichter Incentive-Ziele
  bonusSummeEur:        number | null;       // Summe der Boni
}

export interface FahrerZeugnis {
  id:          string;
  locationId:  string;
  driverId:    string;
  monat:       string;   // ISO date: 2026-06-01
  grade:       ScoreGrade;
  daten:       ZeugnisData;
  erstelltAm:  string;
}

export interface ZeugnisWithDriver extends FahrerZeugnis {
  driverName: string | null;
  vehicle:    string | null;
}

export interface GenerateResult {
  driverId: string;
  monat:    string;
  upserted: boolean;
  skipped:  boolean;
  reason?:  string;
}

export interface GenerateAllResult {
  locationId: string;
  drivers:    number;
  upserted:   number;
  skipped:    number;
  errors:     number;
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

function gradeFromMetrics(score: number | null, puenktlichkeit: number | null): ScoreGrade {
  const s = score ?? 0;
  const p = puenktlichkeit ?? 0;
  const combined = s * 0.6 + p * 0.4;
  if (combined >= 90) return 'A+';
  if (combined >= 78) return 'A';
  if (combined >= 64) return 'B';
  if (combined >= 50) return 'C';
  return 'D';
}

function firstOfMonth(d?: Date | string): string {
  const date = d ? new Date(d) : new Date();
  // default = Vormonat
  const prev = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
  return prev.toISOString().slice(0, 10);
}

function firstOfPrevPrevMonth(refFirst: string): string {
  const d = new Date(refFirst);
  const prev = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
  return prev.toISOString().slice(0, 10);
}

function lastDayOfMonth(firstOfMonth: string): string {
  const d = new Date(firstOfMonth);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return last.toISOString().slice(0, 10);
}

function buildHighlights(data: Omit<ZeugnisData, 'highlights' | 'bewertungstext'>): string[] {
  const h: string[] = [];
  const score = data.compositeScore ?? 0;
  const p = data.puenktlichkeitsPct ?? 0;

  if (score >= 90) h.push('Ausgezeichneter Composite-Score ≥ 90');
  else if (score >= 78) h.push('Sehr guter Composite-Score ≥ 78');
  else if (score < 50) h.push('Composite-Score unter 50 – Verbesserungspotenzial');

  if (p >= 95) h.push('Exzellente Pünktlichkeit ≥ 95 %');
  else if (p >= 85) h.push('Gute Pünktlichkeit ≥ 85 %');
  else if (p < 70) h.push('Pünktlichkeit unter 70 % – Optimierungsbedarf');

  if (data.lieferungenGesamt >= 200) h.push(`Hohe Liefermenge: ${data.lieferungenGesamt} Lieferungen im Monat`);
  if (data.topZone) h.push(`Top-Zone: ${data.topZone}`);

  if (data.scoreTrend !== null && data.scoreTrend > 3) h.push(`Score-Trend +${data.scoreTrend.toFixed(1)} Pkt. vs. Vorvormonat`);
  else if (data.scoreTrend !== null && data.scoreTrend < -3) h.push(`Score-Trend ${data.scoreTrend.toFixed(1)} Pkt. – rückläufig`);

  if (data.erzielteBoni > 0) h.push(`${data.erzielteBoni} Incentive-Ziel(e) erreicht – ${data.bonusSummeEur?.toFixed(2) ?? '0.00'} € Bonus`);

  return h.slice(0, 5);
}

function buildBewertungstext(grade: ScoreGrade, data: Omit<ZeugnisData, 'highlights' | 'bewertungstext'>): string {
  const scoreText = data.compositeScore != null ? `(Score: ${data.compositeScore.toFixed(1)})` : '';
  const pText = data.puenktlichkeitsPct != null ? `, Pünktlichkeit: ${data.puenktlichkeitsPct.toFixed(1)} %` : '';
  switch (grade) {
    case 'A+': return `Herausragende Leistung im Beurteilungszeitraum ${scoreText}${pText}. Der Fahrer übertrifft alle Erwartungen und setzt Maßstäbe im Team.`;
    case 'A':  return `Sehr gute Leistung im Beurteilungszeitraum ${scoreText}${pText}. Der Fahrer erfüllt alle Anforderungen mit großer Zuverlässigkeit.`;
    case 'B':  return `Gute Leistung im Beurteilungszeitraum ${scoreText}${pText}. Der Fahrer erfüllt die Anforderungen zufriedenstellend.`;
    case 'C':  return `Ausreichende Leistung im Beurteilungszeitraum ${scoreText}${pText}. Einzelne Bereiche zeigen Verbesserungsbedarf.`;
    case 'D':  return `Leistung im Beurteilungszeitraum liegt unterhalb der Erwartungen ${scoreText}${pText}. Gezielte Maßnahmen werden empfohlen.`;
  }
}

function mapRow(row: Record<string, unknown>): FahrerZeugnis {
  return {
    id:         row.id as string,
    locationId: row.location_id as string,
    driverId:   row.driver_id as string,
    monat:      row.monat as string,
    grade:      row.grade as ScoreGrade,
    daten:      row.daten as ZeugnisData,
    erstelltAm: row.erstellt_am as string,
  };
}

// ── Engine ─────────────────────────────────────────────────────────────────────

export async function generateZeugnis(
  driverId:   string,
  locationId: string,
  monat?:     string,
): Promise<GenerateResult> {
  const sb     = createServiceClient();
  const monatFirst = monat ?? firstOfMonth();
  const monatLast  = lastDayOfMonth(monatFirst);
  const prevFirst  = firstOfPrevPrevMonth(monatFirst);
  const prevLast   = lastDayOfMonth(prevFirst);

  // Abschluss-Berichte des Monats
  const { data: berichte, error } = await sb
    .from('schicht_abschluss_berichte')
    .select('*')
    .eq('location_id', locationId)
    .eq('driver_id', driverId)
    .gte('schicht_datum', monatFirst)
    .lte('schicht_datum', monatLast);

  if (error) throw new Error(`schicht_abschluss_berichte: ${error.message}`);

  if (!berichte || berichte.length === 0) {
    return { driverId, monat: monatFirst, upserted: false, skipped: true, reason: 'no_shifts' };
  }

  // Aggregation
  const schichtenAnzahl   = berichte.length;
  const lieferungenGesamt = berichte.reduce((s, b) => s + ((b.lieferungen_gesamt as number) ?? 0), 0);

  const puenktlichkeitVals = berichte
    .map(b => b.puenktlichkeits_pct as number | null)
    .filter((v): v is number => v !== null);
  const puenktlichkeitsPct = puenktlichkeitVals.length
    ? puenktlichkeitVals.reduce((a, b) => a + b, 0) / puenktlichkeitVals.length
    : null;

  const avgDeliveryVals = berichte
    .map(b => b.avg_delivery_min as number | null)
    .filter((v): v is number => v !== null);
  const avgDeliveryMin = avgDeliveryVals.length
    ? avgDeliveryVals.reduce((a, b) => a + b, 0) / avgDeliveryVals.length
    : null;

  const scoreVals = berichte
    .map(b => b.composite_score as number | null)
    .filter((v): v is number => v !== null);
  const compositeScore = scoreVals.length
    ? scoreVals.reduce((a, b) => a + b, 0) / scoreVals.length
    : null;

  const verdienstVals = berichte
    .map(b => b.verdienst_eur as number | null)
    .filter((v): v is number => v !== null);
  const verdienstEur = verdienstVals.length
    ? verdienstVals.reduce((a, b) => a + b, 0)
    : null;

  const stornorateVals = berichte
    .map(b => b.stornoraten_pct as number | null)
    .filter((v): v is number => v !== null);
  const stornoratesPct = stornorateVals.length
    ? stornorateVals.reduce((a, b) => a + b, 0) / stornorateVals.length
    : null;

  const tourenVals = berichte
    .map(b => b.touren_anzahl as number)
    .filter(v => v > 0);
  const avgTouren = tourenVals.length
    ? tourenVals.reduce((a, b) => a + b, 0) / tourenVals.length
    : null;

  // Top-Zone aus top_zone Feld (Modus)
  const zoneCounts: Record<string, number> = {};
  for (const b of berichte) {
    const z = b.top_zone as string | null;
    if (z) zoneCounts[z] = (zoneCounts[z] ?? 0) + 1;
  }
  const topZone = Object.keys(zoneCounts).sort((a, b) => zoneCounts[b] - zoneCounts[a])[0] ?? null;

  // Score-Trend: Vorvormonat Ø Score
  const { data: prevBerichte } = await sb
    .from('schicht_abschluss_berichte')
    .select('composite_score')
    .eq('location_id', locationId)
    .eq('driver_id', driverId)
    .gte('schicht_datum', prevFirst)
    .lte('schicht_datum', prevLast);

  const prevScoreVals = (prevBerichte ?? [])
    .map(b => b.composite_score as number | null)
    .filter((v): v is number => v !== null);
  const prevScore = prevScoreVals.length
    ? prevScoreVals.reduce((a, b) => a + b, 0) / prevScoreVals.length
    : null;

  const scoreTrend    = compositeScore !== null && prevScore !== null ? compositeScore - prevScore : null;
  const scoreTrendPct = scoreTrend !== null && prevScore !== null && prevScore > 0
    ? (scoreTrend / prevScore) * 100
    : null;

  // Incentive-Boni des Monats
  const { data: incentives } = await sb
    .from('fahrer_incentives')
    .select('bonus_eur, erreicht_am')
    .eq('location_id', locationId)
    .eq('driver_id', driverId)
    .gte('zeitraum_start', monatFirst)
    .lte('zeitraum_end', monatLast)
    .not('erreicht_am', 'is', null);

  const erzielteBoni  = (incentives ?? []).length;
  const bonusSummeEur = erzielteBoni > 0
    ? (incentives ?? []).reduce((s, i) => s + ((i.bonus_eur as number) ?? 0), 0)
    : null;

  // Zeugnis zusammenstellen
  const grade = gradeFromMetrics(compositeScore, puenktlichkeitsPct);

  const dataPartial: Omit<ZeugnisData, 'highlights' | 'bewertungstext'> = {
    schichtenAnzahl,
    lieferungenGesamt,
    puenktlichkeitsPct,
    avgDeliveryMin,
    compositeScore,
    verdienstEur,
    topZone,
    scoreTrend,
    scoreTrendPct,
    stornoratesPct,
    avgTouren,
    erzielteBoni,
    bonusSummeEur,
  };

  const highlights     = buildHighlights(dataPartial);
  const bewertungstext = buildBewertungstext(grade, dataPartial);

  const daten: ZeugnisData = { ...dataPartial, highlights, bewertungstext };

  const { error: upsertErr } = await sb
    .from('fahrer_zeugnisse')
    .upsert(
      {
        location_id: locationId,
        driver_id:   driverId,
        monat:       monatFirst,
        grade,
        daten,
        erstellt_am: new Date().toISOString(),
      },
      { onConflict: 'location_id,driver_id,monat' },
    );

  if (upsertErr) throw new Error(`upsert fahrer_zeugnisse: ${upsertErr.message}`);

  return { driverId, monat: monatFirst, upserted: true, skipped: false };
}

export async function generateZeugnisseForLocation(
  locationId: string,
  monat?:     string,
): Promise<{ locationId: string; drivers: number; upserted: number; skipped: number; errors: number }> {
  const sb = createServiceClient();

  const { data: drivers, error } = await sb
    .from('employees')
    .select('id')
    .eq('location_id', locationId)
    .eq('role', 'driver');

  if (error) throw new Error(`employees: ${error.message}`);
  if (!drivers?.length) return { locationId, drivers: 0, upserted: 0, skipped: 0, errors: 0 };

  let upserted = 0, skipped = 0, errors = 0;
  for (const d of drivers) {
    try {
      const result = await generateZeugnis(d.id as string, locationId, monat);
      if (result.upserted) upserted++;
      else skipped++;
    } catch {
      errors++;
    }
  }

  return { locationId, drivers: drivers.length, upserted, skipped, errors };
}

export async function generateZeugnisseAllLocations(monat?: string): Promise<GenerateAllResult[]> {
  const sb = createServiceClient();
  const { data: locs, error } = await sb.from('locations').select('id');
  if (error) throw new Error(`locations: ${error.message}`);

  const results: GenerateAllResult[] = [];
  for (const loc of (locs ?? [])) {
    try {
      const r = await generateZeugnisseForLocation(loc.id as string, monat);
      results.push(r);
    } catch {
      results.push({ locationId: loc.id as string, drivers: 0, upserted: 0, skipped: 0, errors: 1 });
    }
  }
  return results;
}

export async function getZeugnisseForLocation(
  locationId: string,
  limit = 50,
): Promise<ZeugnisWithDriver[]> {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('fahrer_zeugnisse')
    .select(`
      *,
      employees!driver_id (name, vehicle)
    `)
    .eq('location_id', locationId)
    .order('monat', { ascending: false })
    .order('erstellt_am', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getZeugnisseForLocation: ${error.message}`);

  return (data ?? []).map(row => {
    const emp = row.employees as { name?: string; vehicle?: string } | null;
    return {
      ...mapRow(row as Record<string, unknown>),
      driverName: emp?.name ?? null,
      vehicle:    emp?.vehicle ?? null,
    };
  });
}

export async function getZeugnisseForDriver(
  driverId:   string,
  locationId: string,
  limit = 12,
): Promise<FahrerZeugnis[]> {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('fahrer_zeugnisse')
    .select('*')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .order('monat', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getZeugnisseForDriver: ${error.message}`);

  return (data ?? []).map(row => mapRow(row as Record<string, unknown>));
}

export async function pruneOldZeugnisse(monthsOld = 24): Promise<number> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc('prune_fahrer_zeugnisse', { months_old: monthsOld });
  if (error) throw new Error(`prune_fahrer_zeugnisse: ${error.message}`);
  return (data as number) ?? 0;
}
