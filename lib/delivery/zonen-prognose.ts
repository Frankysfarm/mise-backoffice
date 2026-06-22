/**
 * lib/delivery/zonen-prognose.ts — Phase 423
 *
 * Zonen-Prognose-Engine: ML-ähnliche 7-Tage-Vorschau von Bestellvolumen und Umsatz
 * je Lieferzone (A/B/C/D), basierend auf zone_revenue_snapshots (Phase 331).
 *
 * Algorithmus:
 *   1. Lade zone_revenue_snapshots der letzten N Tage für die Location
 *   2. Gruppiere nach (zone × Wochentag)
 *   3. Gewichteter Mittelwert mit Exponential-Decay (Half-Life 21 Tage)
 *   4. 80%-Konfidenzband: Median-Absolute-Deviation (MAD) × 1.28
 *   5. Konfidenz: Datenpunkte / 52, capped 0–1
 *   6. Trend: Ø letzte 14 Tage vs. vorherige 14 Tage (>5% = up, <-5% = down)
 *   7. UPSERT: 7 Tage × bis zu 4 Zonen je Location
 *
 * Public API:
 *   computeZonenPrognose(locationId, daysBack?)          — 7-Tage-Forecast + UPSERT
 *   computeZonenPrognoseAllLocations(daysBack?)          — Cron-Batch alle Standorte
 *   getZonenPrognose(locationId, zone?)                  — Gespeicherte Prognosen (7 Tage)
 *   getZonenPrognoseUebersicht(locationId)               — Kompakt-Übersicht für Dashboard
 *   pruneOldZonenPrognosen(daysOld?)                     — Cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export type TrendRichtung = 'up' | 'stable' | 'down';
export type ZoneName = 'A' | 'B' | 'C' | 'D';

export interface ZonenTagesPrognose {
  zone:               ZoneName;
  prognoseDatum:      string;       // YYYY-MM-DD
  wochentag:          number;       // 0=So … 6=Sa
  wochentagLabel:     string;
  expectedOrders:     number;
  expectedRevenueEur: number;
  expectedFeeEur:     number;
  expectedMarginPct:  number | null;
  confidence:         number;       // 0.0–1.0
  rangeLowEur:        number;
  rangeHighEur:       number;
  basisSnapshots:     number;
  trendRichtung:      TrendRichtung;
}

export interface ZonenPrognoseResult {
  locationId:           string;
  prognosen:            ZonenTagesPrognose[];
  gesamtPrognose7TageEur: number;
  topZone7Tage:         ZoneName | null;
  zoneSummen:           Record<string, number>;
  letzteAktualisierung: string;
}

export interface ZonenPrognoseUebersicht {
  locationId:    string;
  zonen:         Array<{
    zone:              ZoneName;
    morgenRevenueEur:  number;
    morgenOrders:      number;
    trend7d:           TrendRichtung;
    confidence:        number;
  }>;
  gesamt7TageEur: number;
  topZone:        ZoneName | null;
  berechnetAm:    string | null;
}

export interface ZonenPrognoseComputeResult {
  locationId:  string;
  zonen:       number;
  tage:        number;
  upserted:    number;
  fehler:      number;
  durationMs:  number;
}

export interface ZonenPrognoseAllLocationsResult {
  locations: number;
  upserted:  number;
  errors:    number;
}

// ── Konstanten ──────────────────────────────────────────────────────────────────

const WOCHENTAG_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const HALF_LIFE_DAYS   = 21;
const ALL_ZONES: ZoneName[] = ['A', 'B', 'C', 'D'];

// ── Hilfsfunktionen ─────────────────────────────────────────────────────────────

function isoDateOffset(base: Date, offsetDays: number): string {
  const d = new Date(base.getTime() + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function weekdayOfIso(isoDate: string): number {
  return new Date(isoDate + 'T12:00:00Z').getDay();
}

function decayWeight(ageInDays: number): number {
  return Math.exp((-ageInDays * Math.LN2) / HALF_LIFE_DAYS);
}

function mad(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  const deviations = values.map(v => Math.abs(v - med)).sort((a, b) => a - b);
  return deviations[Math.floor(deviations.length / 2)];
}

function computeTrend(recent14: number[], prev14: number[]): TrendRichtung {
  if (!recent14.length || !prev14.length) return 'stable';
  const avgRecent = recent14.reduce((s, v) => s + v, 0) / recent14.length;
  const avgPrev   = prev14.reduce((s, v) => s + v, 0) / prev14.length;
  if (avgPrev === 0) return 'stable';
  const delta = (avgRecent - avgPrev) / avgPrev;
  if (delta > 0.05)  return 'up';
  if (delta < -0.05) return 'down';
  return 'stable';
}

// ── Snapshot-Zeile aus DB ──────────────────────────────────────────────────────

interface SnapshotRow {
  zone_name:      string;
  snapshot_date:  string;
  order_count:    number;
  revenue_eur:    number;
  fee_revenue_eur: number | null;
  margin_score:   number | null;
}

// ── Prognose-Berechnung ────────────────────────────────────────────────────────

/**
 * Berechnet 7-Tage-Prognosen je Zone für eine Location und führt UPSERT durch.
 * Gibt Zusammenfassung zurück.
 */
export async function computeZonenPrognose(
  locationId: string,
  daysBack = 90,
): Promise<ZonenPrognoseComputeResult> {
  const start = Date.now();
  const sb = createServiceClient();

  const today    = new Date();
  const cutoff   = isoDateOffset(today, -daysBack);

  // ── 1. Historische Zone-Snapshots laden ──────────────────────────────────────
  const { data: rows, error } = await sb
    .from('zone_revenue_snapshots')
    .select('zone_name, snapshot_date, order_count, revenue_eur, fee_revenue_eur, margin_score')
    .eq('location_id', locationId)
    .gte('snapshot_date', cutoff)
    .order('snapshot_date', { ascending: true });

  if (error || !rows) {
    return { locationId, zonen: 0, tage: 7, upserted: 0, fehler: 1, durationMs: Date.now() - start };
  }

  // ── 2. Gruppieren: zone → wochentag → SnapshotRow[] ────────────────────────
  const byZoneWochentag = new Map<string, SnapshotRow[]>();

  for (const row of rows as SnapshotRow[]) {
    const zone = row.zone_name?.toUpperCase();
    if (!ALL_ZONES.includes(zone as ZoneName)) continue;
    const wd = weekdayOfIso(row.snapshot_date);
    const key = `${zone}_${wd}`;
    if (!byZoneWochentag.has(key)) byZoneWochentag.set(key, []);
    byZoneWochentag.get(key)!.push(row);
  }

  // Für Trend-Berechnung: alle Snapshots je Zone geordnet nach Datum
  const byZoneAll = new Map<string, SnapshotRow[]>();
  for (const row of rows as SnapshotRow[]) {
    const zone = row.zone_name?.toUpperCase();
    if (!ALL_ZONES.includes(zone as ZoneName)) continue;
    if (!byZoneAll.has(zone)) byZoneAll.set(zone, []);
    byZoneAll.get(zone)!.push(row);
  }

  // ── 3. 7 Tage × 4 Zonen → Prognosen berechnen ──────────────────────────────
  const upserts: object[] = [];
  const todayStr = today.toISOString().slice(0, 10);
  const todayTime = today.getTime();

  for (const zone of ALL_ZONES) {
    // Trend: letzte 14d vs. vorherige 14d Umsatz-Werte
    const allForZone = byZoneAll.get(zone) ?? [];
    const cutoff14 = isoDateOffset(today, -14);
    const cutoff28 = isoDateOffset(today, -28);
    const recent14Rev = allForZone.filter(r => r.snapshot_date >= cutoff14).map(r => r.revenue_eur);
    const prev14Rev   = allForZone.filter(r => r.snapshot_date >= cutoff28 && r.snapshot_date < cutoff14).map(r => r.revenue_eur);
    const zoneTrend   = computeTrend(recent14Rev, prev14Rev);

    for (let offset = 1; offset <= 7; offset++) {
      const prognoseDatum = isoDateOffset(today, offset);
      const wd = weekdayOfIso(prognoseDatum);
      const key = `${zone}_${wd}`;
      const snaps = byZoneWochentag.get(key) ?? [];

      if (snaps.length === 0) {
        // Kein Datenmaterial: Prognose mit 0 aber gespeichert
        upserts.push({
          location_id:          locationId,
          zone,
          prognose_datum:       prognoseDatum,
          wochentag:            wd,
          expected_orders:      0,
          expected_revenue_eur: 0,
          expected_fee_eur:     0,
          expected_margin_pct:  null,
          confidence:           0,
          range_low_eur:        0,
          range_high_eur:       0,
          basis_snapshots:      0,
          trend_richtung:       'stable',
          berechnet_am:         new Date().toISOString(),
        });
        continue;
      }

      // Exponential-Decay-Gewichtung
      let wSumRev = 0, wSumFee = 0, wSumOrd = 0, wSumMrg = 0, wTotal = 0, wMrgCount = 0;
      const revValues: number[] = [];

      for (const snap of snaps) {
        const ageDays = (todayTime - new Date(snap.snapshot_date + 'T12:00:00Z').getTime()) / 86_400_000;
        const w = decayWeight(Math.max(0, ageDays));
        wSumRev += snap.revenue_eur * w;
        wSumFee += (snap.fee_revenue_eur ?? 0) * w;
        wSumOrd += snap.order_count * w;
        wTotal  += w;
        if (snap.margin_score != null) {
          wSumMrg += snap.margin_score * w;
          wMrgCount += w;
        }
        revValues.push(snap.revenue_eur);
      }

      const expectedRev = wTotal > 0 ? wSumRev / wTotal : 0;
      const expectedFee = wTotal > 0 ? wSumFee / wTotal : 0;
      const expectedOrd = wTotal > 0 ? wSumOrd / wTotal : 0;
      const expectedMrg = wMrgCount > 0 ? wSumMrg / wMrgCount : null;

      // MAD-Konfidenzband
      const madVal = mad(revValues);
      const bandHalf = madVal * 1.28;

      const confidence = Math.min(1, snaps.length / 52);

      upserts.push({
        location_id:          locationId,
        zone,
        prognose_datum:       prognoseDatum,
        wochentag:            wd,
        expected_orders:      Math.round(expectedOrd * 100) / 100,
        expected_revenue_eur: Math.round(expectedRev * 100) / 100,
        expected_fee_eur:     Math.round(expectedFee * 100) / 100,
        expected_margin_pct:  expectedMrg != null ? Math.round(expectedMrg * 10) / 10 : null,
        confidence:           Math.round(confidence * 1000) / 1000,
        range_low_eur:        Math.round(Math.max(0, expectedRev - bandHalf) * 100) / 100,
        range_high_eur:       Math.round((expectedRev + bandHalf) * 100) / 100,
        basis_snapshots:      snaps.length,
        trend_richtung:       offset === 1 ? zoneTrend : zoneTrend, // same trend for all 7 days
        berechnet_am:         new Date().toISOString(),
      });
    }
  }

  if (upserts.length === 0) {
    return { locationId, zonen: 0, tage: 7, upserted: 0, fehler: 0, durationMs: Date.now() - start };
  }

  // ── 4. UPSERT in Batches von 28 ──────────────────────────────────────────────
  const { error: upsertErr } = await sb
    .from('zonen_prognose_snapshots')
    .upsert(upserts, { onConflict: 'location_id,zone,prognose_datum' });

  const fehler = upsertErr ? 1 : 0;
  return {
    locationId,
    zonen:     ALL_ZONES.length,
    tage:      7,
    upserted:  upsertErr ? 0 : upserts.length,
    fehler,
    durationMs: Date.now() - start,
  };
}

/**
 * Cron-Batch: Alle aktiven Locations berechnen.
 */
export async function computeZonenPrognoseAllLocations(
  daysBack = 90,
): Promise<ZonenPrognoseAllLocationsResult> {
  const sb = createServiceClient();
  const { data: locs } = await sb.from('locations').select('id').eq('active', true);
  if (!locs?.length) return { locations: 0, upserted: 0, errors: 0 };

  const results = await Promise.allSettled(
    locs.map(loc => computeZonenPrognose(loc.id, daysBack)),
  );

  let totalUpserted = 0, errors = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') {
      totalUpserted += r.value.upserted;
      errors        += r.value.fehler;
    } else {
      errors++;
    }
  }
  return { locations: locs.length, upserted: totalUpserted, errors };
}

/**
 * Gespeicherte Prognosen für eine Location laden (nächste 7 Tage).
 * Optional nach Zone filtern.
 */
export async function getZonenPrognose(
  locationId: string,
  zone?: ZoneName,
): Promise<ZonenPrognoseResult> {
  const sb = createServiceClient();

  const today   = new Date().toISOString().slice(0, 10);
  const in7Days = isoDateOffset(new Date(), 7);

  let query = sb
    .from('zonen_prognose_snapshots')
    .select('*')
    .eq('location_id', locationId)
    .gte('prognose_datum', today)
    .lte('prognose_datum', in7Days)
    .order('zone', { ascending: true })
    .order('prognose_datum', { ascending: true });

  if (zone) query = query.eq('zone', zone);

  const { data } = await query;
  const rows = (data ?? []) as Array<{
    zone: string;
    prognose_datum: string;
    wochentag: number;
    expected_orders: number;
    expected_revenue_eur: number;
    expected_fee_eur: number;
    expected_margin_pct: number | null;
    confidence: number;
    range_low_eur: number;
    range_high_eur: number;
    basis_snapshots: number;
    trend_richtung: string;
    berechnet_am: string;
  }>;

  const prognosen: ZonenTagesPrognose[] = rows.map(r => ({
    zone:               r.zone as ZoneName,
    prognoseDatum:      r.prognose_datum,
    wochentag:          r.wochentag,
    wochentagLabel:     WOCHENTAG_LABELS[r.wochentag] ?? '?',
    expectedOrders:     r.expected_orders,
    expectedRevenueEur: r.expected_revenue_eur,
    expectedFeeEur:     r.expected_fee_eur,
    expectedMarginPct:  r.expected_margin_pct,
    confidence:         r.confidence,
    rangeLowEur:        r.range_low_eur,
    rangeHighEur:       r.range_high_eur,
    basisSnapshots:     r.basis_snapshots,
    trendRichtung:      r.trend_richtung as TrendRichtung,
  }));

  // Summen je Zone
  const zoneSummen: Record<string, number> = {};
  let gesamtPrognose7TageEur = 0;
  for (const p of prognosen) {
    zoneSummen[p.zone] = (zoneSummen[p.zone] ?? 0) + p.expectedRevenueEur;
    gesamtPrognose7TageEur += p.expectedRevenueEur;
  }

  // Top-Zone
  let topZone: ZoneName | null = null;
  let maxRev = 0;
  for (const [z, rev] of Object.entries(zoneSummen)) {
    if (rev > maxRev) { maxRev = rev; topZone = z as ZoneName; }
  }

  const letzteAktualisierung = rows.at(-1)?.berechnet_am ?? new Date().toISOString();

  return {
    locationId,
    prognosen,
    gesamtPrognose7TageEur: Math.round(gesamtPrognose7TageEur * 100) / 100,
    topZone7Tage: topZone,
    zoneSummen,
    letzteAktualisierung,
  };
}

/**
 * Kompakt-Übersicht: Morgige Prognose je Zone + Gesamt-7-Tage-Summe.
 * Ideal für Dispatch-Badge und Driver-App-Chip.
 */
export async function getZonenPrognoseUebersicht(locationId: string): Promise<ZonenPrognoseUebersicht> {
  const sb = createServiceClient();

  const today   = new Date();
  const morgen  = isoDateOffset(today, 1);
  const in7Days = isoDateOffset(today, 7);

  const { data } = await sb
    .from('zonen_prognose_snapshots')
    .select('zone, prognose_datum, expected_orders, expected_revenue_eur, confidence, trend_richtung, berechnet_am')
    .eq('location_id', locationId)
    .gte('prognose_datum', morgen)
    .lte('prognose_datum', in7Days)
    .order('zone', { ascending: true })
    .order('prognose_datum', { ascending: true });

  const rows = (data ?? []) as Array<{
    zone: string;
    prognose_datum: string;
    expected_orders: number;
    expected_revenue_eur: number;
    confidence: number;
    trend_richtung: string;
    berechnet_am: string;
  }>;

  const zoneMorgen = new Map<string, { orders: number; rev: number; conf: number; trend: string }>();
  const zoneSum7   = new Map<string, number>();

  for (const r of rows) {
    const z = r.zone;
    zoneSum7.set(z, (zoneSum7.get(z) ?? 0) + r.expected_revenue_eur);
    if (r.prognose_datum === morgen && !zoneMorgen.has(z)) {
      zoneMorgen.set(z, {
        orders: r.expected_orders,
        rev:    r.expected_revenue_eur,
        conf:   r.confidence,
        trend:  r.trend_richtung,
      });
    }
  }

  let gesamt7TageEur = 0;
  let topZone: ZoneName | null = null;
  let maxRev = 0;
  for (const [z, rev] of zoneSum7) {
    gesamt7TageEur += rev;
    if (rev > maxRev) { maxRev = rev; topZone = z as ZoneName; }
  }

  const zonen = ALL_ZONES.map(zone => {
    const m = zoneMorgen.get(zone);
    return {
      zone,
      morgenRevenueEur: m?.rev ?? 0,
      morgenOrders:     m?.orders ?? 0,
      trend7d:          (m?.trend ?? 'stable') as TrendRichtung,
      confidence:       m?.conf ?? 0,
    };
  }).filter(z => z.morgenOrders > 0 || z.morgenRevenueEur > 0);

  return {
    locationId,
    zonen,
    gesamt7TageEur:  Math.round(gesamt7TageEur * 100) / 100,
    topZone,
    berechnetAm: rows.at(-1)?.berechnet_am ?? null,
  };
}

/**
 * Cleanup: Alte Prognosen löschen (Standard: 60 Tage).
 */
export async function pruneOldZonenPrognosen(daysOld = 60): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_zonen_prognose_snapshots', { days_old: daysOld });
  return typeof data === 'number' ? data : 0;
}
