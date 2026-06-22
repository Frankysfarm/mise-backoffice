/**
 * lib/delivery/liefertreue-matrix.ts — Phase 413
 *
 * Liefertreue-Matrix-Engine:
 * 7×24-Heatmap der Lieferpünktlichkeit je Stunde × Wochentag.
 *
 * Analysiert historische Lieferdaten (weeksBack Wochen) und berechnet
 * für jede Kombination aus Wochentag (0–6) und Stunde (0–23) die
 * durchschnittliche On-Time-Rate, Lieferzeit und Bestellanzahl.
 *
 * Identifiziert "Hotspot"-Zellen (chronisch schlechte Qualitätsfenster)
 * und erzeugt Empfehlungen für proaktive Maßnahmen.
 *
 * Public API:
 *  computeLiefertreueMatrix(locationId, weeksBack?)   — 7×24 Matrix berechnen + UPSERT
 *  getLiefertreueMatrixDashboard(locationId)          — Matrix + Hotspots + Summary
 *  detectLiefertreueHotspots(locationId)              — Problemzellen abrufen
 *  computeMatrixAllLocations(weeksBack?)              — Cron-Batch alle Standorte
 *  pruneOldSnapshots(daysToKeep?)                     — Cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export type LiefertreueQualityLabel =
  | 'excellent'   // ≥ 85% on-time
  | 'good'        // ≥ 70%
  | 'fair'        // ≥ 55%
  | 'poor'        // ≥ 40%
  | 'critical'    // < 40%
  | 'keine_daten';

export interface LiefertreueZelle {
  dayOfWeek:      number;   // 0=So … 6=Sa
  hourOfDay:      number;   // 0–23
  onTimeRate:     number | null;  // 0.0–1.0
  avgDeliveryMin: number | null;
  orderCount:     number;
  weeksUsed:      number;
  qualityLabel:   LiefertreueQualityLabel;
  isHotspot:      boolean;
}

export interface LiefertreueMatrixSummary {
  locationId:           string;
  avgOnTimeRateTotal:   number | null;
  minOnTimeRate:        number | null;
  maxOnTimeRate:        number | null;
  hotspotCount:         number;
  totalCellsWithData:   number;
  worstDayOfWeek:       number | null;  // DOW mit tiefster Ø-Rate
  worstHourOfDay:       number | null;  // Stunde mit tiefster Ø-Rate
  bestDayOfWeek:        number | null;
  bestHourOfDay:        number | null;
  overallQualityLabel:  LiefertreueQualityLabel;
  computedAt:           string;
}

export interface LiefertreueHotspot {
  dayOfWeek:      number;
  hourOfDay:      number;
  onTimeRate:     number;
  avgDeliveryMin: number | null;
  orderCount:     number;
  qualityLabel:   LiefertreueQualityLabel;
  recommendation: string;
}

export interface LiefertreueMatrixDashboard {
  locationId:  string;
  matrix:      LiefertreueZelle[][];   // [dayOfWeek 0–6][hourOfDay 0–23]
  hotspots:    LiefertreueHotspot[];
  summary:     LiefertreueMatrixSummary;
}

export interface ComputeMatrixResult {
  locationId:   string;
  cellsUpserted: number;
  hotspotCount: number;
  durationMs:   number;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function toQualityLabel(onTimeRate: number | null): LiefertreueQualityLabel {
  if (onTimeRate === null) return 'keine_daten';
  if (onTimeRate >= 0.85)  return 'excellent';
  if (onTimeRate >= 0.70)  return 'good';
  if (onTimeRate >= 0.55)  return 'fair';
  if (onTimeRate >= 0.40)  return 'poor';
  return 'critical';
}

const DOW_LABELS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function hotspotRecommendation(dow: number, hour: number, onTimeRate: number): string {
  const dayLabel  = DOW_LABELS[dow] ?? `Tag ${dow}`;
  const ratePct   = Math.round(onTimeRate * 100);
  const baseMsg   = `${dayLabel} ${hour}:00–${hour + 1}:00 Uhr: nur ${ratePct}% pünktlich.`;

  if (hour >= 11 && hour <= 13) return `${baseMsg} Mittagsspitze — extra Fahrer einplanen.`;
  if (hour >= 17 && hour <= 20) return `${baseMsg} Abendrush — Küchen-Vorlaufzeit erhöhen.`;
  if (hour >= 21)               return `${baseMsg} Spätschicht — Routenlänge prüfen.`;
  return `${baseMsg} Dispatcher informieren + Kapazität prüfen.`;
}

// ── Kern: Matrix berechnen ────────────────────────────────────────────────────

/**
 * Liest historische Bestelldaten (weeksBack Wochen) und berechnet für jede
 * Wochentag-Stunde-Kombination die Ø On-Time-Rate.
 *
 * Quelle: customer_orders (typ=lieferung, status=geliefert, delivered_at NOT NULL,
 *         estimated_delivery_at NOT NULL) → on_time wenn delivered_at <= estimated_delivery_at
 */
export async function computeLiefertreueMatrix(
  locationId: string,
  weeksBack = 8,
): Promise<ComputeMatrixResult> {
  const t0  = Date.now();
  const svc = createServiceClient();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeksBack * 7);
  const cutoffIso = cutoff.toISOString();

  // Bestelldaten laden (nur Lieferungen mit vollständigen Zeitstempeln)
  type OrderRow = {
    created_at: string;
    delivered_at: string | null;
    estimated_delivery_at: string | null;
    prep_duration_min: number | null;
    delivery_duration_min: number | null;
  };

  const { data: orders, error } = await svc
    .from('customer_orders')
    .select('created_at, delivered_at, estimated_delivery_at, prep_duration_min, delivery_duration_min')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .eq('status', 'geliefert')
    .not('delivered_at', 'is', null)
    .not('estimated_delivery_at', 'is', null)
    .gte('created_at', cutoffIso)
    .order('created_at', { ascending: false })
    .limit(10000);

  if (error) throw error;

  // Aggregation: Map<`${dow}-${hour}`, { onTimeSum, totalCount, deliveryMinSum, deliveryMinCount }>
  type CellAccum = {
    onTimeSum: number;
    totalCount: number;
    deliveryMinSum: number;
    deliveryMinCount: number;
  };
  const cellMap = new Map<string, CellAccum>();

  for (const o of (orders ?? []) as OrderRow[]) {
    if (!o.created_at || !o.delivered_at || !o.estimated_delivery_at) continue;

    const createdAt   = new Date(o.created_at);
    const deliveredAt = new Date(o.delivered_at);
    const estimatedAt = new Date(o.estimated_delivery_at);

    const dow  = createdAt.getUTCDay();   // 0=So … 6=Sa
    const hour = createdAt.getUTCHours(); // 0–23
    const key  = `${dow}-${hour}`;

    const isOnTime = deliveredAt <= estimatedAt ? 1 : 0;
    const deliveryMin =
      o.delivery_duration_min !== null ? Number(o.delivery_duration_min)
      : o.prep_duration_min   !== null ? Number(o.prep_duration_min)
      : null;

    const cell = cellMap.get(key) ?? { onTimeSum: 0, totalCount: 0, deliveryMinSum: 0, deliveryMinCount: 0 };
    cell.onTimeSum    += isOnTime;
    cell.totalCount   += 1;
    if (deliveryMin !== null) {
      cell.deliveryMinSum   += deliveryMin;
      cell.deliveryMinCount += 1;
    }
    cellMap.set(key, cell);
  }

  // Woche-Anzahl je Zelle bestimmen (vereinfacht: unique Wochen im Cutoff)
  // Für Genauigkeit: Bestelldaten auf Wochenebene zählen
  const weekSet = new Map<string, Set<string>>();
  for (const o of (orders ?? []) as OrderRow[]) {
    if (!o.created_at) continue;
    const d    = new Date(o.created_at);
    const dow  = d.getUTCDay();
    const hour = d.getUTCHours();
    const key  = `${dow}-${hour}`;
    // ISO-Woche als Woche-Identifier
    const weekNum = `${d.getUTCFullYear()}-W${Math.floor((d.getUTCDay() + 6) / 7)}-${String(d.getUTCDate()).slice(0,1)}`;
    if (!weekSet.has(key)) weekSet.set(key, new Set());
    weekSet.get(key)!.add(weekNum);
  }

  // UPSERT alle 7×24 Zellen
  const upserts: {
    location_id:      string;
    day_of_week:      number;
    hour_of_day:      number;
    on_time_rate:     number | null;
    avg_delivery_min: number | null;
    order_count:      number;
    weeks_used:       number;
    quality_label:    LiefertreueQualityLabel;
    is_hotspot:       boolean;
    computed_at:      string;
  }[] = [];

  const now = new Date().toISOString();

  for (let dow = 0; dow <= 6; dow++) {
    for (let hour = 0; hour <= 23; hour++) {
      const key   = `${dow}-${hour}`;
      const cell  = cellMap.get(key);
      const weeks = weekSet.get(key)?.size ?? 0;

      const onTimeRate    = cell && cell.totalCount > 0 ? cell.onTimeSum / cell.totalCount : null;
      const avgDeliveryMin =
        cell && cell.deliveryMinCount > 0
          ? Math.round((cell.deliveryMinSum / cell.deliveryMinCount) * 10) / 10
          : null;
      const orderCount  = cell?.totalCount ?? 0;
      const qualityLabel = toQualityLabel(onTimeRate);
      const isHotspot    = onTimeRate !== null && onTimeRate < 0.60 && orderCount >= 5;

      upserts.push({
        location_id:      locationId,
        day_of_week:      dow,
        hour_of_day:      hour,
        on_time_rate:     onTimeRate,
        avg_delivery_min: avgDeliveryMin,
        order_count:      orderCount,
        weeks_used:       Math.min(weeks, weeksBack),
        quality_label:    qualityLabel,
        is_hotspot:       isHotspot,
        computed_at:      now,
      });
    }
  }

  const { error: upsertErr } = await svc
    .from('liefertreue_matrix_snapshots')
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

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getLiefertreueMatrixDashboard(
  locationId: string,
): Promise<LiefertreueMatrixDashboard> {
  const svc = createServiceClient();

  const { data: rows, error } = await svc
    .from('liefertreue_matrix_snapshots')
    .select('day_of_week, hour_of_day, on_time_rate, avg_delivery_min, order_count, weeks_used, quality_label, is_hotspot, computed_at')
    .eq('location_id', locationId)
    .order('day_of_week', { ascending: true })
    .order('hour_of_day', { ascending: true });

  if (error) throw error;

  type SnapshotRow = {
    day_of_week:      number;
    hour_of_day:      number;
    on_time_rate:     number | null;
    avg_delivery_min: number | null;
    order_count:      number;
    weeks_used:       number;
    quality_label:    string;
    is_hotspot:       boolean;
    computed_at:      string;
  };

  const snapshots = (rows ?? []) as SnapshotRow[];

  // 7×24 Matrix aufbauen
  const matrix: LiefertreueZelle[][] = Array.from({ length: 7 }, (_, dow) =>
    Array.from({ length: 24 }, (_, hour) => ({
      dayOfWeek:      dow,
      hourOfDay:      hour,
      onTimeRate:     null,
      avgDeliveryMin: null,
      orderCount:     0,
      weeksUsed:      0,
      qualityLabel:   'keine_daten' as LiefertreueQualityLabel,
      isHotspot:      false,
    })),
  );

  let lastComputedAt = new Date(0).toISOString();

  for (const r of snapshots) {
    const dow  = Number(r.day_of_week);
    const hour = Number(r.hour_of_day);
    if (dow < 0 || dow > 6 || hour < 0 || hour > 23) continue;

    matrix[dow][hour] = {
      dayOfWeek:      dow,
      hourOfDay:      hour,
      onTimeRate:     r.on_time_rate !== null ? Number(r.on_time_rate) : null,
      avgDeliveryMin: r.avg_delivery_min !== null ? Number(r.avg_delivery_min) : null,
      orderCount:     Number(r.order_count),
      weeksUsed:      Number(r.weeks_used),
      qualityLabel:   r.quality_label as LiefertreueQualityLabel,
      isHotspot:      r.is_hotspot,
    };

    if (r.computed_at > lastComputedAt) lastComputedAt = r.computed_at;
  }

  // Hotspots sammeln
  const hotspots: LiefertreueHotspot[] = snapshots
    .filter((r) => r.is_hotspot)
    .map((r) => ({
      dayOfWeek:      Number(r.day_of_week),
      hourOfDay:      Number(r.hour_of_day),
      onTimeRate:     Number(r.on_time_rate),
      avgDeliveryMin: r.avg_delivery_min !== null ? Number(r.avg_delivery_min) : null,
      orderCount:     Number(r.order_count),
      qualityLabel:   r.quality_label as LiefertreueQualityLabel,
      recommendation: hotspotRecommendation(Number(r.day_of_week), Number(r.hour_of_day), Number(r.on_time_rate)),
    }))
    .sort((a, b) => (a.onTimeRate ?? 1) - (b.onTimeRate ?? 1)); // schlechteste zuerst

  // Summary berechnen
  const cellsWithData = snapshots.filter((r) => r.on_time_rate !== null && Number(r.order_count) >= 1);
  const rates         = cellsWithData.map((r) => Number(r.on_time_rate));

  const avgOnTimeRateTotal = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
  const minOnTimeRate      = rates.length > 0 ? Math.min(...rates) : null;
  const maxOnTimeRate      = rates.length > 0 ? Math.max(...rates) : null;

  // Schlechtester/bester Wochentag (Ø über alle Stunden)
  const dowRates: (number | null)[] = Array.from({ length: 7 }, (_, dow) => {
    const cells = cellsWithData.filter((r) => Number(r.day_of_week) === dow);
    if (cells.length === 0) return null;
    return cells.reduce((s, r) => s + Number(r.on_time_rate), 0) / cells.length;
  });
  const validDowRates = dowRates.map((r, i) => ({ i, r })).filter((x) => x.r !== null);
  const worstDayOfWeek = validDowRates.length > 0
    ? validDowRates.reduce((a, b) => (b.r! < a.r! ? b : a)).i
    : null;
  const bestDayOfWeek  = validDowRates.length > 0
    ? validDowRates.reduce((a, b) => (b.r! > a.r! ? b : a)).i
    : null;

  // Schlechteste/beste Stunde (Ø über alle DOW)
  const hourRates: (number | null)[] = Array.from({ length: 24 }, (_, hour) => {
    const cells = cellsWithData.filter((r) => Number(r.hour_of_day) === hour);
    if (cells.length === 0) return null;
    return cells.reduce((s, r) => s + Number(r.on_time_rate), 0) / cells.length;
  });
  const validHourRates = hourRates.map((r, i) => ({ i, r })).filter((x) => x.r !== null);
  const worstHourOfDay = validHourRates.length > 0
    ? validHourRates.reduce((a, b) => (b.r! < a.r! ? b : a)).i
    : null;
  const bestHourOfDay  = validHourRates.length > 0
    ? validHourRates.reduce((a, b) => (b.r! > a.r! ? b : a)).i
    : null;

  const summary: LiefertreueMatrixSummary = {
    locationId,
    avgOnTimeRateTotal,
    minOnTimeRate,
    maxOnTimeRate,
    hotspotCount: hotspots.length,
    totalCellsWithData: cellsWithData.length,
    worstDayOfWeek,
    worstHourOfDay,
    bestDayOfWeek,
    bestHourOfDay,
    overallQualityLabel: toQualityLabel(avgOnTimeRateTotal),
    computedAt: lastComputedAt,
  };

  return { locationId, matrix, hotspots, summary };
}

// ── Hotspots direkt abrufen ────────────────────────────────────────────────────

export async function detectLiefertreueHotspots(
  locationId: string,
): Promise<LiefertreueHotspot[]> {
  const svc = createServiceClient();

  const { data, error } = await svc
    .from('liefertreue_matrix_snapshots')
    .select('day_of_week, hour_of_day, on_time_rate, avg_delivery_min, order_count, quality_label')
    .eq('location_id', locationId)
    .eq('is_hotspot', true)
    .order('on_time_rate', { ascending: true })
    .limit(20);

  if (error) throw error;

  type Row = {
    day_of_week:      number;
    hour_of_day:      number;
    on_time_rate:     number | null;
    avg_delivery_min: number | null;
    order_count:      number;
    quality_label:    string;
  };

  return ((data ?? []) as Row[]).map((r) => ({
    dayOfWeek:      Number(r.day_of_week),
    hourOfDay:      Number(r.hour_of_day),
    onTimeRate:     Number(r.on_time_rate),
    avgDeliveryMin: r.avg_delivery_min !== null ? Number(r.avg_delivery_min) : null,
    orderCount:     Number(r.order_count),
    qualityLabel:   r.quality_label as LiefertreueQualityLabel,
    recommendation: hotspotRecommendation(Number(r.day_of_week), Number(r.hour_of_day), Number(r.on_time_rate ?? 0)),
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
    locs.map((l: { id: string }) => computeLiefertreueMatrix(l.id, weeksBack)),
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
      console.error('[liefertreue-matrix] batch error:', r.reason);
    }
  }

  return { locations: locs.length, succeeded, errors, hotspots };
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export async function pruneOldSnapshots(daysToKeep = 30): Promise<number> {
  const svc = createServiceClient();
  const { data, error } = await svc.rpc('prune_liefertreue_matrix_snapshots', {
    days_old: daysToKeep,
  });
  if (error) {
    console.error('[liefertreue-matrix] prune error:', error);
    return 0;
  }
  return (data as number) ?? 0;
}
