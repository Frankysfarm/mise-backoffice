/**
 * lib/delivery/schicht-abschluss.ts — Phase 430
 *
 * Schicht-Abschluss-Intelligenz: Generiert personalisierte Post-Shift-Berichte
 * für Fahrer, sobald ihre letzte Tour abgeschlossen ist.
 *
 * Algorithmus:
 *   1. driver_shifts (beendete Schichten heute) → heutige Schichtdaten
 *   2. delivery_batches + customer_orders → Touren/Lieferungen/Pünktlichkeit
 *   3. driver_score_daily_snapshots → Composite-Score + Grade
 *   4. 30-Tage-Schnitt aus driver_score_daily_snapshots (eigener Baseline)
 *   5. Team-Schnitt aller Fahrer der Location heute
 *   6. Dynamische Highlights + Tipps je Score + Trend
 *
 * Public API:
 *   generateAbschluss(driverId, locationId, datum?)        — Bericht für einen Fahrer
 *   generateAbschlussForLocation(locationId, datum?)       — Alle Fahrer der Location
 *   generateAbschlussAllLocations(datum?)                  — Cron-Batch
 *   getAbschluss(driverId, locationId, datum?)             — Bericht lesen
 *   getTodaysAbschluesse(locationId)                       — Alle heutigen Berichte
 *   pruneOldBerichte(daysOld?)                             — Cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export type ScoreGrade = 'A+' | 'A' | 'B' | 'C' | 'D';

export interface SchichtAbschlussBericht {
  id:                   string;
  locationId:           string;
  driverId:             string;
  schichtDatum:         string;
  schichtBeginn:        string | null;
  schichtEnde:          string | null;
  tourenAnzahl:         number;
  lieferungenGesamt:    number;
  puenktlichkeitsPct:   number | null;
  avgDeliveryMin:       number | null;
  stornoratesPct:       number | null;
  compositeScore:       number | null;
  scoreGrade:           ScoreGrade | null;
  eigenerSchnitt30d:    number | null;
  deltaEigenerSchnitt:  number | null;
  teamSchnittHeute:     number | null;
  deltaTeamSchnitt:     number | null;
  topZone:              string | null;
  verdienstEur:         number | null;
  highlights:           string[];
  tipps:                string[];
  generiertAm:          string;
}

export interface AbschlussWithDriver extends SchichtAbschlussBericht {
  driverName: string | null;
  vehicle:    string | null;
}

export interface GenerateResult {
  driverId:     string;
  schichtDatum: string;
  upserted:     boolean;
  skipped:      boolean;
  reason?:      string;
}

export interface GenerateAllResult {
  locationId: string;
  drivers:    number;
  upserted:   number;
  skipped:    number;
  errors:     number;
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

function gradeFromScore(score: number): ScoreGrade {
  if (score >= 90) return 'A+';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  if (score >= 45) return 'C';
  return 'D';
}

function berlinDate(d?: Date | string): string {
  const dt = d ? toDate(d) : new Date();
  return dt.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' })
    .split('.').reverse().join('-');
}

function buildHighlights(
  lieferungen:    number,
  puenktlichkeit: number | null,
  score:          number | null,
  deltaTeam:      number | null,
  deltaEigen:     number | null,
): string[] {
  const hl: string[] = [];
  if (lieferungen >= 15) hl.push(`🚀 ${lieferungen} Lieferungen — Top-Schicht!`);
  else if (lieferungen >= 10) hl.push(`📦 ${lieferungen} Lieferungen erfolgreich abgeschlossen`);
  if (puenktlichkeit !== null && puenktlichkeit >= 90) hl.push(`⏱️ ${puenktlichkeit.toFixed(0)}% Pünktlichkeit — ausgezeichnet`);
  if (score !== null && score >= 90) hl.push('🏆 Score A+ — Spitzenleistung heute!');
  if (deltaTeam !== null && deltaTeam > 5) hl.push(`📈 ${deltaTeam.toFixed(1)} Punkte über Team-Durchschnitt`);
  if (deltaEigen !== null && deltaEigen > 3) hl.push('✨ Besser als dein persönlicher Schnitt!');
  return hl.slice(0, 3);
}

function buildTipps(
  puenktlichkeit: number | null,
  score:          number | null,
  stornorate:     number | null,
  lieferungen:    number,
): string[] {
  const tips: string[] = [];
  if (puenktlichkeit !== null && puenktlichkeit < 70)
    tips.push('💡 Pünktlichkeit verbessern: Stoppzeiten optimieren und früher zum nächsten Stopp fahren.');
  if (stornorate !== null && stornorate > 5)
    tips.push('💡 Stornorate senken: Bei Lieferproblemen frühzeitig im Dispatch melden.');
  if (score !== null && score < 60)
    tips.push('💡 Score steigern: Auf Kundenbewertungen und Lieferpünktlichkeit achten.');
  if (lieferungen < 6)
    tips.push('💡 Mehr Touren akzeptieren: In Stoßzeiten aktiv bleiben für mehr Lieferungen.');
  if (tips.length === 0)
    tips.push('💡 Weiter so! Morgen wieder auf die Top-Zone konzentrieren.');
  return tips.slice(0, 2);
}

// ── Hauptfunktionen ────────────────────────────────────────────────────────────

export async function generateAbschluss(
  driverId:   string,
  locationId: string,
  datum?:     string,
): Promise<GenerateResult> {
  const sb         = createServiceClient();
  const schichtDatum = datum ?? berlinDate();

  // ①  Schicht-Zeitstempel (driver_shifts)
  const { data: shift } = await sb
    .from('driver_shifts')
    .select('started_at, ended_at')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .gte('started_at', schichtDatum + 'T00:00:00Z')
    .lt('started_at', schichtDatum + 'T23:59:59Z')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // ②  Heutige Batches des Fahrers
  const { data: batches } = await sb
    .from('delivery_batches')
    .select('id, status, started_at, completed_at, zone_id')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .gte('created_at', schichtDatum + 'T00:00:00Z')
    .lt('created_at', schichtDatum + 'T23:59:59Z');

  const batchIds = (batches ?? []).map((b) => b.id);

  // ③  Lieferungen aus customer_orders
  let lieferungenGesamt = 0;
  let pünktlichZähler   = 0;
  let pünktlichGesamt   = 0;
  let stornoZähler      = 0;
  let avgDelMin: number | null = null;
  let topZone: string | null = null;

  if (batchIds.length > 0) {
    const { data: orders } = await sb
      .from('customer_orders')
      .select('status, delivery_started_at, delivered_at, promised_delivery_at, zone_id')
      .in('batch_id', batchIds);

    const all = orders ?? [];
    lieferungenGesamt = all.filter((o) => o.status === 'delivered').length;
    stornoZähler      = all.filter((o) => ['cancelled', 'rejected'].includes(o.status)).length;

    const withTimes = all.filter(
      (o) => o.delivered_at && o.delivery_started_at,
    );
    if (withTimes.length > 0) {
      const delMins = withTimes.map(
        (o) => (toDate(o.delivered_at).getTime() - toDate(o.delivery_started_at).getTime()) / 60_000,
      );
      avgDelMin = delMins.reduce((s, v) => s + v, 0) / delMins.length;
    }

    const withPromise = all.filter(
      (o) => o.delivered_at && o.promised_delivery_at,
    );
    if (withPromise.length > 0) {
      pünktlichGesamt = withPromise.length;
      pünktlichZähler = withPromise.filter(
        (o) => toDate(o.delivered_at) <= toDate(o.promised_delivery_at),
      ).length;
    }

    // Top-Zone: Zone mit den meisten Lieferungen
    const zoneCounts: Record<string, number> = {};
    all
      .filter((o) => o.status === 'delivered' && o.zone_id)
      .forEach((o) => {
        zoneCounts[o.zone_id] = (zoneCounts[o.zone_id] ?? 0) + 1;
      });
    if (Object.keys(zoneCounts).length > 0) {
      topZone = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1])[0][0];
    }
  }

  const puenktlichkeitsPct =
    pünktlichGesamt > 0 ? (pünktlichZähler / pünktlichGesamt) * 100 : null;
  const stornoratesPct =
    (lieferungenGesamt + stornoZähler) > 0
      ? (stornoZähler / (lieferungenGesamt + stornoZähler)) * 100
      : null;

  // ④  Composite-Score aus daily snapshot
  const { data: snap } = await sb
    .from('driver_score_daily_snapshots')
    .select('composite_score, score_grade')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .eq('snapshot_date', schichtDatum)
    .maybeSingle();

  const compositeScore = snap?.composite_score ?? null;
  const scoreGrade     = (snap?.score_grade as ScoreGrade) ?? (compositeScore !== null ? gradeFromScore(compositeScore) : null);

  // ⑤  30-Tage-Schnitt (eigener Baseline)
  const { data: history30 } = await sb
    .from('driver_score_daily_snapshots')
    .select('composite_score')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .gte('snapshot_date', berlinDate(new Date(Date.now() - 30 * 86_400_000)))
    .order('snapshot_date', { ascending: false })
    .limit(30);

  const scores30 = (history30 ?? []).map((r) => r.composite_score).filter((v) => v != null) as number[];
  const eigenerSchnitt30d =
    scores30.length > 0 ? scores30.reduce((s, v) => s + v, 0) / scores30.length : null;
  const deltaEigenerSchnitt =
    compositeScore !== null && eigenerSchnitt30d !== null
      ? compositeScore - eigenerSchnitt30d
      : null;

  // ⑥  Team-Schnitt heute
  const { data: teamSnaps } = await sb
    .from('driver_score_daily_snapshots')
    .select('composite_score')
    .eq('location_id', locationId)
    .eq('snapshot_date', schichtDatum);

  const teamScores = (teamSnaps ?? [])
    .map((r) => r.composite_score)
    .filter((v) => v != null) as number[];
  const teamSchnittHeute =
    teamScores.length > 0 ? teamScores.reduce((s, v) => s + v, 0) / teamScores.length : null;
  const deltaTeamSchnitt =
    compositeScore !== null && teamSchnittHeute !== null
      ? compositeScore - teamSchnittHeute
      : null;

  // ⑦  Verdienst aus payouts (approximiert)
  const { data: payRow } = await sb
    .from('driver_payouts')
    .select('amount_eur')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .gte('created_at', schichtDatum + 'T00:00:00Z')
    .lt('created_at', schichtDatum + 'T23:59:59Z')
    .maybeSingle();
  const verdienstEur = payRow?.amount_eur ?? null;

  // ⑧  Highlights + Tipps generieren
  const highlights = buildHighlights(
    lieferungenGesamt,
    puenktlichkeitsPct,
    compositeScore,
    deltaTeamSchnitt,
    deltaEigenerSchnitt,
  );
  const tipps = buildTipps(
    puenktlichkeitsPct,
    compositeScore,
    stornoratesPct,
    lieferungenGesamt,
  );

  // ⑨  UPSERT
  const { error } = await sb.from('schicht_abschluss_berichte').upsert(
    {
      location_id:           locationId,
      driver_id:             driverId,
      schicht_datum:         schichtDatum,
      schicht_beginn:        shift?.started_at ?? null,
      schicht_ende:          shift?.ended_at ?? null,
      touren_anzahl:         (batches ?? []).length,
      lieferungen_gesamt:    lieferungenGesamt,
      puenktlichkeits_pct:   puenktlichkeitsPct,
      avg_delivery_min:      avgDelMin,
      stornorate_pct:        stornoratesPct,
      composite_score:       compositeScore,
      score_grade:           scoreGrade,
      eigener_schnitt_30d:   eigenerSchnitt30d,
      delta_eigener_schnitt: deltaEigenerSchnitt,
      team_schnitt_heute:    teamSchnittHeute,
      delta_team_schnitt:    deltaTeamSchnitt,
      top_zone:              topZone,
      verdienst_eur:         verdienstEur,
      highlights:            highlights,
      tipps:                 tipps,
      generiert_am:          new Date().toISOString(),
    },
    { onConflict: 'driver_id,schicht_datum' },
  );

  if (error) {
    console.error('[schicht-abschluss] upsert error:', error.message);
    return { driverId, schichtDatum, upserted: false, skipped: false, reason: error.message };
  }

  return { driverId, schichtDatum, upserted: true, skipped: false };
}

export async function generateAbschlussForLocation(
  locationId: string,
  datum?:     string,
): Promise<GenerateAllResult> {
  const sb           = createServiceClient();
  const schichtDatum = datum ?? berlinDate();
  const dayStart     = schichtDatum + 'T00:00:00Z';
  const dayEnd       = schichtDatum + 'T23:59:59Z';

  // Fahrer mit Schicht heute
  const { data: shifts } = await sb
    .from('driver_shifts')
    .select('driver_id')
    .eq('location_id', locationId)
    .gte('started_at', dayStart)
    .lt('started_at', dayEnd);

  const driverIds = [...new Set((shifts ?? []).map((s) => s.driver_id))];

  let upserted = 0, skipped = 0, errors = 0;
  await Promise.allSettled(
    driverIds.map(async (driverId) => {
      try {
        const r = await generateAbschluss(driverId, locationId, schichtDatum);
        if (r.upserted) upserted++;
        else if (r.skipped) skipped++;
        else errors++;
      } catch {
        errors++;
      }
    }),
  );

  return { locationId, drivers: driverIds.length, upserted, skipped, errors };
}

export async function generateAbschlussAllLocations(datum?: string): Promise<GenerateAllResult[]> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('is_active', true);

  const results = await Promise.allSettled(
    (locs ?? []).map((l) => generateAbschlussForLocation(l.id, datum)),
  );

  return results
    .filter((r): r is PromiseFulfilledResult<GenerateAllResult> => r.status === 'fulfilled')
    .map((r) => r.value);
}

export async function getAbschluss(
  driverId:   string,
  locationId: string,
  datum?:     string,
): Promise<SchichtAbschlussBericht | null> {
  const sb           = createServiceClient();
  const schichtDatum = datum ?? berlinDate();

  const { data } = await sb
    .from('schicht_abschluss_berichte')
    .select('*')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .eq('schicht_datum', schichtDatum)
    .maybeSingle();

  if (!data) return null;
  return mapRow(data);
}

export async function getTodaysAbschluesse(locationId: string): Promise<AbschlussWithDriver[]> {
  const sb   = createServiceClient();
  const date = berlinDate();

  const { data } = await sb
    .from('schicht_abschluss_berichte')
    .select(`
      *,
      employees!schicht_abschluss_berichte_driver_id_fkey(name, vehicle)
    `)
    .eq('location_id', locationId)
    .eq('schicht_datum', date)
    .order('composite_score', { ascending: false });

  return (data ?? []).map((row) => ({
    ...mapRow(row),
    driverName: (row.employees as { name?: string } | null)?.name ?? null,
    vehicle:    (row.employees as { vehicle?: string } | null)?.vehicle ?? null,
  }));
}

export async function pruneOldBerichte(daysOld = 60): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_schicht_abschluss_berichte', { days_old: daysOld });
  return (data as number) ?? 0;
}

// ── Mapper ─────────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): SchichtAbschlussBericht {
  return {
    id:                   String(row.id),
    locationId:           String(row.location_id),
    driverId:             String(row.driver_id),
    schichtDatum:         String(row.schicht_datum),
    schichtBeginn:        (row.schicht_beginn as string) ?? null,
    schichtEnde:          (row.schicht_ende as string) ?? null,
    tourenAnzahl:         Number(row.touren_anzahl ?? 0),
    lieferungenGesamt:    Number(row.lieferungen_gesamt ?? 0),
    puenktlichkeitsPct:   row.puenktlichkeits_pct != null ? Number(row.puenktlichkeits_pct) : null,
    avgDeliveryMin:       row.avg_delivery_min != null ? Number(row.avg_delivery_min) : null,
    stornoratesPct:       row.stornorate_pct != null ? Number(row.stornorate_pct) : null,
    compositeScore:       row.composite_score != null ? Number(row.composite_score) : null,
    scoreGrade:           (row.score_grade as ScoreGrade) ?? null,
    eigenerSchnitt30d:    row.eigener_schnitt_30d != null ? Number(row.eigener_schnitt_30d) : null,
    deltaEigenerSchnitt:  row.delta_eigener_schnitt != null ? Number(row.delta_eigener_schnitt) : null,
    teamSchnittHeute:     row.team_schnitt_heute != null ? Number(row.team_schnitt_heute) : null,
    deltaTeamSchnitt:     row.delta_team_schnitt != null ? Number(row.delta_team_schnitt) : null,
    topZone:              (row.top_zone as string) ?? null,
    verdienstEur:         row.verdienst_eur != null ? Number(row.verdienst_eur) : null,
    highlights:           Array.isArray(row.highlights) ? (row.highlights as string[]) : [],
    tipps:                Array.isArray(row.tipps) ? (row.tipps as string[]) : [],
    generiertAm:          String(row.generiert_am),
  };
}
