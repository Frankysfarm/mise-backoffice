/**
 * lib/delivery/tages-muster.ts — Phase 422
 *
 * Tages-Muster-Erkennung: Stündliche Bestell- und Umsatzmuster je Wochentag.
 *
 * Algorithmus:
 *   1. Lade order_pulse_snapshots der letzten N Tage (15-Min-Buckets)
 *   2. Aggregiere zu stündlichen Summen je Kalendertag
 *   3. Gruppiere nach (Wochentag × Stunde) → Ø Bestellungen, Ø Umsatz, P75
 *   4. Peak-Klasse: Vergleich mit Wochentag-Mittelwert + Standardabweichung
 *   5. UPSERT in tages_muster_snapshots (UNIQUE location_id, wochentag, stunde)
 *
 * Public API:
 *   computeTagesMuster(locationId, daysBack?)        — Muster berechnen + UPSERT
 *   computeTagesMusterAllLocations(daysBack?)        — Cron-Batch alle Standorte
 *   getTagesMuster(locationId, wochentag?)           — Gespeicherte Muster laden
 *   getTagesMusterPrognose(locationId)               — Heute + Morgen stündlich
 *   pruneOldTagesMuster(daysOld?)                    — Cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export type PeakKlasse = 'low' | 'normal' | 'peak' | 'high';

export interface TagesMusterStunde {
  wochentag:        number;     // 0=So … 6=Sa
  wochentagLabel:   string;
  stunde:           number;     // 0–23 UTC
  stundeLabel:      string;     // 'HH:00' Berlin (UTC+2)
  avgBestellungen:  number;
  avgUmsatzEur:     number;
  p75Bestellungen:  number;
  peakKlasse:       PeakKlasse;
  basisTage:        number;
}

export interface TagesMusterTag {
  wochentag:      number;
  wochentagLabel: string;
  stunden:        TagesMusterStunde[];
  peakStunden:    number[];   // UTC-Stunden mit peak/high Klasse
  maxAvgStunde:   number;     // UTC-Stunde mit höchstem Ø
  totalAvgBest:   number;     // Tages-Ø Bestellungen gesamt
}

export interface TagesMusterPrognoseStunde {
  stundeUtc:      number;
  stundeLabel:    string;
  istVergangenheit: boolean;
  avgBestellungen: number;
  avgUmsatzEur:    number;
  peakKlasse:      PeakKlasse;
}

export interface TagesMusterPrognose {
  locationId:     string;
  heute: {
    wochentag:    number;
    wochentagLabel: string;
    stunden:      TagesMusterPrognoseStunde[];
  };
  morgen: {
    wochentag:    number;
    wochentagLabel: string;
    stunden:      TagesMusterPrognoseStunde[];
  };
  letzteAktualisierung: string | null;
}

export interface ComputeTagesMusterResult {
  locationId:  string;
  upserted:    number;
  basisTage:   number;
  durationMs:  number;
}

// ── Konstanten ─────────────────────────────────────────────────────────────────

const DOW_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const BERLIN_OFFSET_H = 2; // UTC+2 Näherung (CEST)

function berlinStundeLabel(utcH: number): string {
  const berlinH = (utcH + BERLIN_OFFSET_H) % 24;
  return String(berlinH).padStart(2, '0') + ':00';
}

function percentile75(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.75) - 1;
  return sorted[Math.max(0, idx)];
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stddev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function classifyPeak(avgBest: number, dowMean: number, dowStd: number): PeakKlasse {
  if (dowStd === 0) return avgBest > 0 ? 'normal' : 'low';
  const z = (avgBest - dowMean) / dowStd;
  if (z > 1.4) return 'high';
  if (z > 0.3) return 'peak';
  if (z < -0.6) return 'low';
  return 'normal';
}

// ── computeTagesMuster ────────────────────────────────────────────────────────

export async function computeTagesMuster(
  locationId: string,
  daysBack = 90,
): Promise<ComputeTagesMusterResult> {
  const start = Date.now();
  const svc = createServiceClient();

  const since = new Date(Date.now() - daysBack * 86_400_000).toISOString();

  // Lade alle 15-Min-Buckets der letzten daysBack Tage
  const { data: buckets } = await svc
    .from('order_pulse_snapshots')
    .select('bucket_start, order_count, revenue_eur')
    .eq('location_id', locationId)
    .gte('bucket_start', since)
    .order('bucket_start', { ascending: true });

  type BucketRow = { bucket_start: string; order_count: number | null; revenue_eur: number | null };
  const rows = (buckets ?? []) as BucketRow[];

  // Schritt 1: Aggregiere 15-Min-Buckets zu stündlichen Summen je Kalendertag
  // Key: "YYYY-MM-DD_HH" (UTC)
  const hourlyByDay = new Map<string, { orderCount: number; revenueEur: number }>();
  for (const row of rows) {
    if (!row.bucket_start) continue;
    const d = new Date(row.bucket_start);
    const dateStr = d.toISOString().slice(0, 10);
    const hourStr = String(d.getUTCHours()).padStart(2, '0');
    const key = `${dateStr}_${hourStr}`;
    const entry = hourlyByDay.get(key) ?? { orderCount: 0, revenueEur: 0 };
    entry.orderCount += row.order_count ?? 0;
    entry.revenueEur += row.revenue_eur ?? 0;
    hourlyByDay.set(key, entry);
  }

  // Schritt 2: Gruppiere nach (wochentag × stunde)
  // Key: `${dow}_${hour}`
  const patternMap = new Map<string, { counts: number[]; revenues: number[] }>();
  const uniqueDatesPerDow = new Map<number, Set<string>>(); // dow → Set<dateStr>

  for (const [key, { orderCount, revenueEur }] of hourlyByDay) {
    const [dateStr, hourStr] = key.split('_');
    const dow = new Date(`${dateStr}T12:00:00Z`).getDay();
    const hour = parseInt(hourStr, 10);
    const patKey = `${dow}_${hour}`;

    const entry = patternMap.get(patKey) ?? { counts: [], revenues: [] };
    entry.counts.push(orderCount);
    entry.revenues.push(revenueEur);
    patternMap.set(patKey, entry);

    const dowDates = uniqueDatesPerDow.get(dow) ?? new Set();
    dowDates.add(dateStr);
    uniqueDatesPerDow.set(dow, dowDates);
  }

  if (patternMap.size === 0) {
    return { locationId, upserted: 0, basisTage: 0, durationMs: Date.now() - start };
  }

  // Schritt 3: Berechne Ø-Werte je (dow, hour) für Peak-Klassifikation
  // Erst Mittelwerte pro dow für Normierung
  const dowAvgs = new Map<number, { avgs: number[] }>();
  for (const [key, { counts }] of patternMap) {
    const dow = parseInt(key.split('_')[0], 10);
    const avgC = mean(counts);
    const entry = dowAvgs.get(dow) ?? { avgs: [] };
    entry.avgs.push(avgC);
    dowAvgs.set(dow, entry);
  }

  const dowStats = new Map<number, { mean: number; std: number }>();
  for (const [dow, { avgs }] of dowAvgs) {
    const m = mean(avgs);
    const s = stddev(avgs, m);
    dowStats.set(dow, { mean: m, std: s });
  }

  // Schritt 4: Baue Upsert-Einträge
  const now = new Date().toISOString();
  const upserts: Array<{
    location_id:      string;
    wochentag:        number;
    stunde:           number;
    avg_bestellungen: number;
    avg_umsatz_eur:   number;
    p75_bestellungen: number;
    peak_klasse:      PeakKlasse;
    basis_tage:       number;
    berechnet_am:     string;
  }> = [];

  let totalBasisTage = 0;

  for (const [key, { counts, revenues }] of patternMap) {
    const [dowStr, hourStr] = key.split('_');
    const dow  = parseInt(dowStr, 10);
    const hour = parseInt(hourStr, 10);

    const avgBest  = Math.round(mean(counts) * 100) / 100;
    const avgUms   = Math.round(mean(revenues) * 100) / 100;
    const p75Best  = Math.round(percentile75(counts) * 100) / 100;
    const basisTage = uniqueDatesPerDow.get(dow)?.size ?? 0;
    const { mean: dm, std: ds } = dowStats.get(dow) ?? { mean: 0, std: 0 };
    const peakKlasse = classifyPeak(avgBest, dm, ds);

    totalBasisTage = Math.max(totalBasisTage, basisTage);

    upserts.push({
      location_id:      locationId,
      wochentag:        dow,
      stunde:           hour,
      avg_bestellungen: avgBest,
      avg_umsatz_eur:   avgUms,
      p75_bestellungen: p75Best,
      peak_klasse:      peakKlasse,
      basis_tage:       basisTage,
      berechnet_am:     now,
    });
  }

  // UPSERT in Batches von 168 (7 Tage × 24 Stunden)
  let upserted = 0;
  const BATCH = 168;
  for (let i = 0; i < upserts.length; i += BATCH) {
    const batch = upserts.slice(i, i + BATCH);
    const { error } = await svc
      .from('tages_muster_snapshots')
      .upsert(batch, { onConflict: 'location_id,wochentag,stunde' });
    if (!error) upserted += batch.length;
  }

  return { locationId, upserted, basisTage: totalBasisTage, durationMs: Date.now() - start };
}

// ── computeTagesMusterAllLocations ────────────────────────────────────────────

export async function computeTagesMusterAllLocations(
  daysBack = 90,
): Promise<{ locations: number; upserted: number; errors: number; durationMs: number }> {
  const start = Date.now();
  const svc = createServiceClient();

  const { data: locs } = await svc
    .from('locations')
    .select('id')
    .eq('aktiv', true);

  let upserted = 0;
  let errors = 0;
  const results = await Promise.allSettled(
    (locs ?? []).map(l => computeTagesMuster(String(l.id), daysBack)),
  );
  for (const r of results) {
    if (r.status === 'fulfilled') upserted += r.value.upserted;
    else errors++;
  }

  return { locations: (locs ?? []).length, upserted, errors, durationMs: Date.now() - start };
}

// ── getTagesMuster ────────────────────────────────────────────────────────────

export async function getTagesMuster(
  locationId: string,
  wochentag?: number,
): Promise<TagesMusterTag[]> {
  const svc = createServiceClient();

  let query = svc
    .from('tages_muster_snapshots')
    .select('wochentag, stunde, avg_bestellungen, avg_umsatz_eur, p75_bestellungen, peak_klasse, basis_tage')
    .eq('location_id', locationId)
    .order('wochentag', { ascending: true })
    .order('stunde', { ascending: true });

  if (wochentag !== undefined) {
    query = query.eq('wochentag', wochentag);
  }

  const { data } = await query;
  type Row = {
    wochentag: number; stunde: number;
    avg_bestellungen: number; avg_umsatz_eur: number;
    p75_bestellungen: number; peak_klasse: string; basis_tage: number;
  };
  const rows = (data ?? []) as Row[];

  // Gruppiere nach wochentag
  const byDow = new Map<number, Row[]>();
  for (const row of rows) {
    const arr = byDow.get(row.wochentag) ?? [];
    arr.push(row);
    byDow.set(row.wochentag, arr);
  }

  const result: TagesMusterTag[] = [];
  for (const [dow, dowRows] of byDow) {
    const stunden: TagesMusterStunde[] = dowRows.map(r => ({
      wochentag:       r.wochentag,
      wochentagLabel:  DOW_LABELS[r.wochentag] ?? '?',
      stunde:          r.stunde,
      stundeLabel:     berlinStundeLabel(r.stunde),
      avgBestellungen: r.avg_bestellungen,
      avgUmsatzEur:    r.avg_umsatz_eur,
      p75Bestellungen: r.p75_bestellungen,
      peakKlasse:      r.peak_klasse as PeakKlasse,
      basisTage:       r.basis_tage,
    }));

    const peakStunden = stunden
      .filter(s => s.peakKlasse === 'peak' || s.peakKlasse === 'high')
      .map(s => s.stunde);

    const maxRow = stunden.reduce(
      (best, s) => (s.avgBestellungen > best.avgBestellungen ? s : best),
      stunden[0] ?? { avgBestellungen: 0, stunde: 0 },
    );

    const totalAvgBest = stunden.reduce((s, r) => s + r.avgBestellungen, 0);

    result.push({
      wochentag:      dow,
      wochentagLabel: DOW_LABELS[dow] ?? '?',
      stunden,
      peakStunden,
      maxAvgStunde:   maxRow.stunde,
      totalAvgBest:   Math.round(totalAvgBest * 10) / 10,
    });
  }

  return result;
}

// ── getTagesMusterPrognose ────────────────────────────────────────────────────

export async function getTagesMusterPrognose(
  locationId: string,
): Promise<TagesMusterPrognose> {
  const svc = createServiceClient();
  const now = new Date();
  const nowUtcH = now.getUTCHours();
  const todayDow = now.getUTCDay();
  const morgenDow = (todayDow + 1) % 7;

  // Lade Pattern für heute und morgen
  const { data: rows } = await svc
    .from('tages_muster_snapshots')
    .select('wochentag, stunde, avg_bestellungen, avg_umsatz_eur, peak_klasse, berechnet_am')
    .eq('location_id', locationId)
    .in('wochentag', [todayDow, morgenDow])
    .order('wochentag', { ascending: true })
    .order('stunde', { ascending: true });

  type Row = {
    wochentag: number; stunde: number;
    avg_bestellungen: number; avg_umsatz_eur: number;
    peak_klasse: string; berechnet_am: string;
  };
  const allRows = (rows ?? []) as Row[];

  const letzteAktualisierung = allRows.length > 0
    ? (allRows[allRows.length - 1].berechnet_am ?? null)
    : null;

  function buildStunden(dow: number): TagesMusterPrognoseStunde[] {
    const dowRows = allRows.filter(r => r.wochentag === dow);
    const byHour = new Map(dowRows.map(r => [r.stunde, r]));
    return Array.from({ length: 24 }, (_, h) => {
      const r = byHour.get(h);
      return {
        stundeUtc:       h,
        stundeLabel:     berlinStundeLabel(h),
        istVergangenheit: dow === todayDow && h < nowUtcH,
        avgBestellungen:  r?.avg_bestellungen ?? 0,
        avgUmsatzEur:     r?.avg_umsatz_eur ?? 0,
        peakKlasse:       (r?.peak_klasse ?? 'normal') as PeakKlasse,
      };
    });
  }

  return {
    locationId,
    heute: {
      wochentag:      todayDow,
      wochentagLabel: DOW_LABELS[todayDow],
      stunden:        buildStunden(todayDow),
    },
    morgen: {
      wochentag:      morgenDow,
      wochentagLabel: DOW_LABELS[morgenDow],
      stunden:        buildStunden(morgenDow),
    },
    letzteAktualisierung,
  };
}

// ── pruneOldTagesMuster ───────────────────────────────────────────────────────

export async function pruneOldTagesMuster(daysOld = 30): Promise<number> {
  const svc = createServiceClient();
  const { data } = await svc.rpc('prune_tages_muster_snapshots', { days_old: daysOld });
  return typeof data === 'number' ? data : 0;
}
