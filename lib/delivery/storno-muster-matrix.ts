/**
 * lib/delivery/storno-muster-matrix.ts — Phase 415
 *
 * Storno-Muster-Matrix-Engine:
 * 7×24-Heatmap der Stornierungsraten je Stunde × Wochentag.
 *
 * Analysiert historische Bestelldaten (weeksBack Wochen) und berechnet
 * für jede Kombination aus Wochentag (0–6) und Stunde (0–23) die
 * Stornierungsrate, Ursachenkategorie und Bestellanzahl.
 *
 * Identifiziert "Hotspot"-Zellen (chronisch hohe Stornierungsraten)
 * und erzeugt Empfehlungen für proaktive Maßnahmen.
 *
 * Public API:
 *  computeStornoMusterMatrix(locationId, weeksBack?)   — 7×24 Matrix berechnen + UPSERT
 *  getStornoMusterDashboard(locationId)                — Matrix + Hotspots + Summary
 *  detectStornoHotspots(locationId)                    — Problemzellen abrufen
 *  computeMatrixAllLocations(weeksBack?)               — Cron-Batch alle Standorte
 *  pruneOldSnapshots(daysToKeep?)                      — Cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export type StornoQualityLabel =
  | 'excellent'   // < 3% storno rate
  | 'good'        // < 6%
  | 'fair'        // < 10%
  | 'poor'        // < 15%
  | 'critical'    // ≥ 15%
  | 'keine_daten';

export type StornoCause =
  | 'kueche_verzoegerung'
  | 'kein_fahrer'
  | 'kunde_storniert'
  | 'zone_problem'
  | 'unbekannt';

export interface StornoMusterZelle {
  dayOfWeek:     number;   // 0=So … 6=Sa
  hourOfDay:     number;   // 0–23
  stornoRate:    number | null;  // 0.0–1.0
  stornoCount:   number;
  totalCount:    number;
  weeksUsed:     number;
  primaryCause:  StornoCause | null;
  qualityLabel:  StornoQualityLabel;
  isHotspot:     boolean;
}

export interface StornoMusterSummary {
  locationId:            string;
  avgStornoRateTotal:    number | null;
  maxStornoRate:         number | null;
  minStornoRate:         number | null;
  hotspotCount:          number;
  totalCellsWithData:    number;
  totalStornosInMatrix:  number;
  totalOrdersInMatrix:   number;
  worstDayOfWeek:        number | null;
  worstHourOfDay:        number | null;
  bestDayOfWeek:         number | null;
  bestHourOfDay:         number | null;
  overallQualityLabel:   StornoQualityLabel;
  dominantCause:         StornoCause | null;
  computedAt:            string;
}

export interface StornoHotspot {
  dayOfWeek:    number;
  hourOfDay:    number;
  stornoRate:   number;
  stornoCount:  number;
  totalCount:   number;
  qualityLabel: StornoQualityLabel;
  primaryCause: StornoCause | null;
  recommendation: string;
}

export interface StornoMusterDashboard {
  locationId: string;
  matrix:     StornoMusterZelle[][];   // [dayOfWeek 0–6][hourOfDay 0–23]
  hotspots:   StornoHotspot[];
  summary:    StornoMusterSummary;
}

export interface ComputeStornoMatrixResult {
  locationId:   string;
  cellsUpserted: number;
  hotspotCount: number;
  durationMs:   number;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function toQualityLabel(stornoRate: number | null): StornoQualityLabel {
  if (stornoRate === null) return 'keine_daten';
  if (stornoRate < 0.03)   return 'excellent';
  if (stornoRate < 0.06)   return 'good';
  if (stornoRate < 0.10)   return 'fair';
  if (stornoRate < 0.15)   return 'poor';
  return 'critical';
}

const DOW_LABELS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function hotspotRecommendation(
  dow: number,
  hour: number,
  stornoRate: number,
  cause: StornoCause | null,
): string {
  const dayLabel  = DOW_LABELS[dow] ?? `Tag ${dow}`;
  const ratePct   = Math.round(stornoRate * 100);
  const baseMsg   = `${dayLabel} ${hour}:00–${hour + 1}:00 Uhr: ${ratePct}% Stornorate.`;

  switch (cause) {
    case 'kueche_verzoegerung':
      return `${baseMsg} Küchenverzögerungen häufig — Kochkapazität erhöhen oder Bestellannahme drosseln.`;
    case 'kein_fahrer':
      return `${baseMsg} Fahrermangel in diesem Slot — mehr Fahrer einplanen.`;
    case 'zone_problem':
      return `${baseMsg} Zonenproblem — Liefergebiet oder Routing prüfen.`;
    case 'kunde_storniert':
      return `${baseMsg} Kunden stornieren häufig — ETA-Kommunikation verbessern.`;
    default:
      if (hour >= 11 && hour <= 13) return `${baseMsg} Mittagsspitze — Prozesse beschleunigen.`;
      if (hour >= 17 && hour <= 20) return `${baseMsg} Abendrush — Kapazität erhöhen.`;
      return `${baseMsg} Ursache prüfen und Abläufe optimieren.`;
  }
}

// ── Kern: Matrix berechnen ────────────────────────────────────────────────────

export async function computeStornoMusterMatrix(
  locationId: string,
  weeksBack = 8,
): Promise<ComputeStornoMatrixResult> {
  const t0  = Date.now();
  const svc = createServiceClient();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeksBack * 7);
  const cutoffIso = cutoff.toISOString();

  type OrderRow = {
    created_at:     string;
    status:         string;
    storniert_weil: string | null;
    prep_duration_min: number | null;
  };

  const { data: orders, error } = await svc
    .from('customer_orders')
    .select('created_at, status, storniert_weil, prep_duration_min')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .gte('created_at', cutoffIso)
    .not('status', 'in', '("neu","bestätigt")')
    .order('created_at', { ascending: false })
    .limit(20000);

  if (error) throw error;

  type CellAccum = {
    stornoCount:    number;
    totalCount:     number;
    causeMap:       Map<StornoCause, number>;
    latePrepCount:  number;
  };

  const cellMap = new Map<string, CellAccum>();

  for (const o of (orders ?? []) as OrderRow[]) {
    if (!o.created_at) continue;

    const createdAt = new Date(o.created_at);
    const dow  = createdAt.getUTCDay();
    const hour = createdAt.getUTCHours();
    const key  = `${dow}-${hour}`;

    const cell = cellMap.get(key) ?? {
      stornoCount:   0,
      totalCount:    0,
      causeMap:      new Map<StornoCause, number>(),
      latePrepCount: 0,
    };

    cell.totalCount++;

    const isStorniert = o.status === 'storniert';
    if (isStorniert) {
      cell.stornoCount++;

      const cause = classifyCause(o.storniert_weil, o.prep_duration_min);
      cell.causeMap.set(cause, (cell.causeMap.get(cause) ?? 0) + 1);
    }

    if (o.prep_duration_min !== null && Number(o.prep_duration_min) > 30) {
      cell.latePrepCount++;
    }

    cellMap.set(key, cell);
  }

  // Wochenanzahl je Zelle
  const weekSet = new Map<string, Set<string>>();
  for (const o of (orders ?? []) as OrderRow[]) {
    if (!o.created_at) continue;
    const d    = new Date(o.created_at);
    const key  = `${d.getUTCDay()}-${d.getUTCHours()}`;
    const wNum = `${d.getUTCFullYear()}-W${Math.floor(d.getUTCDate() / 7)}`;
    if (!weekSet.has(key)) weekSet.set(key, new Set());
    weekSet.get(key)!.add(wNum);
  }

  // UPSERT alle 7×24 Zellen
  const upserts: {
    location_id:   string;
    day_of_week:   number;
    hour_of_day:   number;
    storno_rate:   number | null;
    storno_count:  number;
    total_count:   number;
    weeks_used:    number;
    primary_cause: StornoCause | null;
    quality_label: StornoQualityLabel;
    is_hotspot:    boolean;
    computed_at:   string;
  }[] = [];

  const now = new Date().toISOString();

  for (let dow = 0; dow <= 6; dow++) {
    for (let hour = 0; hour <= 23; hour++) {
      const key   = `${dow}-${hour}`;
      const cell  = cellMap.get(key);
      const weeks = weekSet.get(key)?.size ?? 0;

      const stornoRate  = cell && cell.totalCount > 0
        ? cell.stornoCount / cell.totalCount
        : null;
      const stornoCount = cell?.stornoCount ?? 0;
      const totalCount  = cell?.totalCount  ?? 0;
      const qualityLabel = toQualityLabel(stornoRate);
      const isHotspot    = stornoRate !== null && stornoRate >= 0.10 && totalCount >= 5;

      let primaryCause: StornoCause | null = null;
      if (cell && cell.causeMap.size > 0) {
        let maxCount = 0;
        for (const [cause, count] of cell.causeMap.entries()) {
          if (count > maxCount) { maxCount = count; primaryCause = cause; }
        }
      }

      upserts.push({
        location_id:   locationId,
        day_of_week:   dow,
        hour_of_day:   hour,
        storno_rate:   stornoRate,
        storno_count:  stornoCount,
        total_count:   totalCount,
        weeks_used:    Math.min(weeks, weeksBack),
        primary_cause: primaryCause,
        quality_label: qualityLabel,
        is_hotspot:    isHotspot,
        computed_at:   now,
      });
    }
  }

  const { error: upsertErr } = await svc
    .from('storno_muster_snapshots')
    .upsert(upserts, { onConflict: 'location_id,day_of_week,hour_of_day' });

  if (upsertErr) throw upsertErr;

  const hotspotCount = upserts.filter((u) => u.is_hotspot).length;

  return {
    locationId,
    cellsUpserted: upserts.length,
    hotspotCount,
    durationMs: Date.now() - t0,
  };
}

function classifyCause(
  stornoGrund: string | null,
  prepDurationMin: number | null,
): StornoCause {
  if (stornoGrund) {
    const g = stornoGrund.toLowerCase();
    if (g.includes('küche') || g.includes('kueche') || g.includes('zubereitung') || g.includes('prep'))
      return 'kueche_verzoegerung';
    if (g.includes('fahrer') || g.includes('driver') || g.includes('kapazität'))
      return 'kein_fahrer';
    if (g.includes('zone') || g.includes('liefergebiet') || g.includes('route'))
      return 'zone_problem';
    if (g.includes('kunde') || g.includes('customer') || g.includes('selbst'))
      return 'kunde_storniert';
  }
  if (prepDurationMin !== null && Number(prepDurationMin) > 35) {
    return 'kueche_verzoegerung';
  }
  return 'unbekannt';
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getStornoMusterDashboard(
  locationId: string,
): Promise<StornoMusterDashboard> {
  const svc = createServiceClient();

  const { data: rows, error } = await svc
    .from('storno_muster_snapshots')
    .select('day_of_week, hour_of_day, storno_rate, storno_count, total_count, weeks_used, primary_cause, quality_label, is_hotspot, computed_at')
    .eq('location_id', locationId)
    .order('day_of_week', { ascending: true })
    .order('hour_of_day', { ascending: true });

  if (error) throw error;

  type SnapshotRow = {
    day_of_week:   number;
    hour_of_day:   number;
    storno_rate:   number | null;
    storno_count:  number;
    total_count:   number;
    weeks_used:    number;
    primary_cause: string | null;
    quality_label: string;
    is_hotspot:    boolean;
    computed_at:   string;
  };

  const snapshots = (rows ?? []) as SnapshotRow[];

  // 7×24 Matrix aufbauen
  const matrix: StornoMusterZelle[][] = Array.from({ length: 7 }, (_, dow) =>
    Array.from({ length: 24 }, (_, hour) => ({
      dayOfWeek:    dow,
      hourOfDay:    hour,
      stornoRate:   null,
      stornoCount:  0,
      totalCount:   0,
      weeksUsed:    0,
      primaryCause: null,
      qualityLabel: 'keine_daten' as StornoQualityLabel,
      isHotspot:    false,
    })),
  );

  let lastComputedAt = new Date(0).toISOString();

  for (const r of snapshots) {
    const dow  = Number(r.day_of_week);
    const hour = Number(r.hour_of_day);
    if (dow < 0 || dow > 6 || hour < 0 || hour > 23) continue;

    matrix[dow][hour] = {
      dayOfWeek:    dow,
      hourOfDay:    hour,
      stornoRate:   r.storno_rate !== null ? Number(r.storno_rate) : null,
      stornoCount:  Number(r.storno_count),
      totalCount:   Number(r.total_count),
      weeksUsed:    Number(r.weeks_used),
      primaryCause: (r.primary_cause as StornoCause) ?? null,
      qualityLabel: r.quality_label as StornoQualityLabel,
      isHotspot:    r.is_hotspot,
    };

    if (r.computed_at > lastComputedAt) lastComputedAt = r.computed_at;
  }

  // Hotspots sammeln
  const hotspots: StornoHotspot[] = snapshots
    .filter((r) => r.is_hotspot)
    .map((r) => ({
      dayOfWeek:    Number(r.day_of_week),
      hourOfDay:    Number(r.hour_of_day),
      stornoRate:   Number(r.storno_rate),
      stornoCount:  Number(r.storno_count),
      totalCount:   Number(r.total_count),
      qualityLabel: r.quality_label as StornoQualityLabel,
      primaryCause: (r.primary_cause as StornoCause) ?? null,
      recommendation: hotspotRecommendation(
        Number(r.day_of_week),
        Number(r.hour_of_day),
        Number(r.storno_rate),
        (r.primary_cause as StornoCause) ?? null,
      ),
    }))
    .sort((a, b) => b.stornoRate - a.stornoRate);

  // Summary berechnen
  const cellsWithData  = snapshots.filter((r) => r.storno_rate !== null && Number(r.total_count) >= 1);
  const rates          = cellsWithData.map((r) => Number(r.storno_rate));

  const avgStornoRateTotal = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
  const maxStornoRate      = rates.length > 0 ? Math.max(...rates) : null;
  const minStornoRate      = rates.length > 0 ? Math.min(...rates) : null;

  const totalStornosInMatrix = snapshots.reduce((s, r) => s + Number(r.storno_count), 0);
  const totalOrdersInMatrix  = snapshots.reduce((s, r) => s + Number(r.total_count), 0);

  const dowRates: (number | null)[] = Array.from({ length: 7 }, (_, dow) => {
    const cells = cellsWithData.filter((r) => Number(r.day_of_week) === dow);
    if (cells.length === 0) return null;
    return cells.reduce((s, r) => s + Number(r.storno_rate), 0) / cells.length;
  });
  const validDowRates = dowRates.map((r, i) => ({ i, r })).filter((x) => x.r !== null);
  const worstDayOfWeek = validDowRates.length > 0
    ? validDowRates.reduce((a, b) => (b.r! > a.r! ? b : a)).i
    : null;
  const bestDayOfWeek  = validDowRates.length > 0
    ? validDowRates.reduce((a, b) => (b.r! < a.r! ? b : a)).i
    : null;

  const hourRates: (number | null)[] = Array.from({ length: 24 }, (_, hour) => {
    const cells = cellsWithData.filter((r) => Number(r.hour_of_day) === hour);
    if (cells.length === 0) return null;
    return cells.reduce((s, r) => s + Number(r.storno_rate), 0) / cells.length;
  });
  const validHourRates = hourRates.map((r, i) => ({ i, r })).filter((x) => x.r !== null);
  const worstHourOfDay = validHourRates.length > 0
    ? validHourRates.reduce((a, b) => (b.r! > a.r! ? b : a)).i
    : null;
  const bestHourOfDay  = validHourRates.length > 0
    ? validHourRates.reduce((a, b) => (b.r! < a.r! ? b : a)).i
    : null;

  // Dominante Ursache über alle Hotspot-Zellen
  const causeAgg = new Map<StornoCause, number>();
  for (const r of snapshots) {
    if (r.primary_cause) {
      const c = r.primary_cause as StornoCause;
      causeAgg.set(c, (causeAgg.get(c) ?? 0) + Number(r.storno_count));
    }
  }
  let dominantCause: StornoCause | null = null;
  let maxCauseCount = 0;
  for (const [cause, count] of causeAgg.entries()) {
    if (count > maxCauseCount) { maxCauseCount = count; dominantCause = cause; }
  }

  const summary: StornoMusterSummary = {
    locationId,
    avgStornoRateTotal,
    maxStornoRate,
    minStornoRate,
    hotspotCount:         hotspots.length,
    totalCellsWithData:   cellsWithData.length,
    totalStornosInMatrix,
    totalOrdersInMatrix,
    worstDayOfWeek,
    worstHourOfDay,
    bestDayOfWeek,
    bestHourOfDay,
    overallQualityLabel:  toQualityLabel(avgStornoRateTotal),
    dominantCause,
    computedAt:           lastComputedAt,
  };

  return { locationId, matrix, hotspots, summary };
}

// ── Hotspots direkt abrufen ────────────────────────────────────────────────────

export async function detectStornoHotspots(
  locationId: string,
): Promise<StornoHotspot[]> {
  const svc = createServiceClient();

  const { data, error } = await svc
    .from('storno_muster_snapshots')
    .select('day_of_week, hour_of_day, storno_rate, storno_count, total_count, quality_label, primary_cause')
    .eq('location_id', locationId)
    .eq('is_hotspot', true)
    .order('storno_rate', { ascending: false })
    .limit(20);

  if (error) throw error;

  type Row = {
    day_of_week:   number;
    hour_of_day:   number;
    storno_rate:   number | null;
    storno_count:  number;
    total_count:   number;
    quality_label: string;
    primary_cause: string | null;
  };

  return ((data ?? []) as Row[]).map((r) => ({
    dayOfWeek:    Number(r.day_of_week),
    hourOfDay:    Number(r.hour_of_day),
    stornoRate:   Number(r.storno_rate),
    stornoCount:  Number(r.storno_count),
    totalCount:   Number(r.total_count),
    qualityLabel: r.quality_label as StornoQualityLabel,
    primaryCause: (r.primary_cause as StornoCause) ?? null,
    recommendation: hotspotRecommendation(
      Number(r.day_of_week),
      Number(r.hour_of_day),
      Number(r.storno_rate ?? 0),
      (r.primary_cause as StornoCause) ?? null,
    ),
  }));
}

// ── Cron-Batch ────────────────────────────────────────────────────────────────

export async function computeMatrixAllLocations(
  weeksBack = 8,
): Promise<{ locations: number; succeeded: number; errors: number; hotspots: number }> {
  const svc = createServiceClient();

  const { data: locs } = await svc
    .from('locations')
    .select('id')
    .eq('is_active', true);

  if (!locs || locs.length === 0) return { locations: 0, succeeded: 0, errors: 0, hotspots: 0 };

  const results = await Promise.allSettled(
    locs.map((l: { id: string }) => computeStornoMusterMatrix(l.id, weeksBack)),
  );

  let succeeded = 0;
  let errors    = 0;
  let hotspots  = 0;

  for (const r of results) {
    if (r.status === 'fulfilled') {
      succeeded++;
      hotspots += r.value.hotspotCount;
    } else {
      errors++;
      console.error('[storno-muster-matrix] batch error:', r.reason);
    }
  }

  return { locations: locs.length, succeeded, errors, hotspots };
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export async function pruneOldSnapshots(daysToKeep = 30): Promise<number> {
  const svc = createServiceClient();
  const { data, error } = await svc.rpc('prune_storno_muster_snapshots', {
    days_old: daysToKeep,
  });
  if (error) {
    console.error('[storno-muster-matrix] prune error:', error);
    return 0;
  }
  return (data as number) ?? 0;
}
