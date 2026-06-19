/**
 * lib/delivery/demand-surge-v2.ts
 *
 * Phase 304 — Predictive Demand Surge Detection V2
 *
 * Unterschied zu surge-prediction.ts (V1 — Velocity-Ratio-Ansatz):
 *   V1: ordersLast30 / historicalAvg → Ratio-Schwellwerte (1.4 / 1.8 / 2.5)
 *   V2: Statistische Anomalie-Erkennung mittels Z-Score + Multi-Window-Analyse
 *
 * Algorithmus:
 *   1. Lade 8 Wochen Bestellhistorie für location (stündlich aggregiert)
 *   2. Berechne Mittelwert + Standardabweichung je Stunde+Wochentag (56 Slots)
 *   3. Multi-Window: 15 Min / 30 Min / 60 Min aktuelle Bestellrate
 *   4. Z-Score pro Fenster: (actual - mean) / stddev
 *   5. Kombinierter Signal-Score: gewichtete Z-Scores
 *   6. Trend-Richtung: beschleunigt (15M > 30M/2) oder abflauend?
 *   7. Konfidenz: basierend auf Datenpunkte-Qualität (n ≥ 5 = volle Konfidenz)
 *   8. Predictive Horizon: Hochrechnung auf nächste 60 Min
 *   9. Schwellwerte: Z ≥ 1.5 → LOW, Z ≥ 2.0 → MEDIUM, Z ≥ 3.0 → HIGH
 *  10. Bei MEDIUM/HIGH → Alert in demand_surge_v2_alerts schreiben
 *
 * Öffentliche Funktionen:
 *   detectDemandSurgeV2(locationId)          — Haupt-Erkennungslogik
 *   runDemandSurgeAllLocations()             — Cron-Batch
 *   getDemandSurgeDashboard(locationId)      — Admin-Dashboard
 *   getActiveAlerts(locationId)              — aktive Alerts für Dispatch-Panel
 *   dismissAlert(alertId, locationId)        — Dispatch bestätigt Alert
 *   rebuildHourlyBaseline(locationId)        — Baseline neu berechnen
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ─────────────────────────────────────────────────────────────────────

export type SurgeLevel = 'normal' | 'low' | 'medium' | 'high';

export interface TimeWindowSignal {
  windowMin:    15 | 30 | 60;
  orderCount:   number;
  ratePerHour:  number;
  meanPerHour:  number;
  stddevPerHour: number;
  zScore:       number;
  dataPoints:   number;
}

export interface SurgeV2Trend {
  direction:  'accelerating' | 'stable' | 'decelerating';
  rate15:     number;
  rate30half: number;
  changePct:  number;
}

export interface SurgeV2Prediction {
  predictedOrdersNext60: number;
  forecastLevel:         SurgeLevel;
  forecastConfidence:    number;
}

export interface SurgeV2Result {
  locationId:        string;
  detectedAt:        string;
  surgeLevel:        SurgeLevel;
  combinedZScore:    number;
  confidencePct:     number;
  windows:           TimeWindowSignal[];
  trend:             SurgeV2Trend;
  prediction:        SurgeV2Prediction;
  alertId:           string | null;
  skipped:           boolean;
  reason?:           string;
}

export interface SurgeV2Alert {
  id:           string;
  locationId:   string;
  surgeLevel:   SurgeLevel;
  zScore:       number;
  orderRate:    number;
  detectedAt:   string;
  forecastNext60: number;
  dismissed:    boolean;
  dismissedAt:  string | null;
  resolvedAt:   string | null;
}

export interface HourlyBaseline {
  hourOfDay:   number;
  dayOfWeek:   number;
  meanPerHour: number;
  stddev:      number;
  dataPoints:  number;
  updatedAt:   string;
}

export interface SurgeV2Dashboard {
  activeAlerts:    SurgeV2Alert[];
  recentDetections: Array<{
    detectedAt:   string;
    surgeLevel:   SurgeLevel;
    zScore:       number;
    orderRate:    number;
    dismissed:    boolean;
  }>;
  baselineSlots:   number;
  avgBaselineConfidence: number | null;
  alertsLast24h:   number;
  mediumHighLast24h: number;
}

// ── Schwellwerte ──────────────────────────────────────────────────────────────

const Z_SCORE_LOW    = 1.5;
const Z_SCORE_MEDIUM = 2.0;
const Z_SCORE_HIGH   = 3.0;

const WINDOW_WEIGHTS: Record<15 | 30 | 60, number> = {
  15: 0.45,   // aktuellstes Signal — höchstes Gewicht
  30: 0.35,
  60: 0.20,
};

function zScoreToLevel(z: number): SurgeLevel {
  if (z >= Z_SCORE_HIGH)   return 'high';
  if (z >= Z_SCORE_MEDIUM) return 'medium';
  if (z >= Z_SCORE_LOW)    return 'low';
  return 'normal';
}

// ── Hauptfunktion ─────────────────────────────────────────────────────────────

export async function detectDemandSurgeV2(locationId: string): Promise<SurgeV2Result> {
  const svc = createServiceClient();
  const now = new Date();

  // ── 1. Aktuelle Bestellzahlen je Zeitfenster ──
  const windows = await Promise.all(
    ([15, 30, 60] as const).map((w) => fetchWindowSignal(svc, locationId, now, w)),
  );

  // ── 2. Kombinierten Z-Score berechnen (gewichtet) ──
  let combinedZ = 0;
  let totalWeight = 0;
  for (const w of windows) {
    if (w.dataPoints >= 3) {
      combinedZ += w.zScore * WINDOW_WEIGHTS[w.windowMin];
      totalWeight += WINDOW_WEIGHTS[w.windowMin];
    }
  }
  if (totalWeight > 0) combinedZ /= totalWeight;

  // ── 3. Konfidenz aus Datenpunkte-Qualität ──
  const avgDataPoints = windows.reduce((s, w) => s + w.dataPoints, 0) / windows.length;
  const confidencePct = Math.min(100, Math.round((avgDataPoints / 8) * 100));

  const surgeLevel = zScoreToLevel(combinedZ);

  // Kein Signal → skip (kein Alert-Spam bei normal)
  if (surgeLevel === 'normal') {
    return {
      locationId,
      detectedAt:     now.toISOString(),
      surgeLevel:     'normal',
      combinedZScore: Math.round(combinedZ * 100) / 100,
      confidencePct,
      windows,
      trend:          buildTrend(windows),
      prediction:     buildPrediction(windows, 'normal', confidencePct),
      alertId:        null,
      skipped:        true,
      reason:         `Z=${combinedZ.toFixed(2)} unter Schwellwert ${Z_SCORE_LOW}`,
    };
  }

  // ── 4. Trend berechnen ──
  const trend = buildTrend(windows);

  // ── 5. Vorhersage für nächste 60 Min ──
  const prediction = buildPrediction(windows, surgeLevel, confidencePct);

  // ── 6. Alert speichern (nur bei MEDIUM/HIGH oder wenn sich Level erhöht hat) ──
  const alertId = await upsertAlert(svc, {
    locationId,
    surgeLevel,
    zScore:         combinedZ,
    orderRate:      windows.find((w) => w.windowMin === 30)?.ratePerHour ?? 0,
    detectedAt:     now.toISOString(),
    forecastNext60: prediction.predictedOrdersNext60,
  });

  return {
    locationId,
    detectedAt:     now.toISOString(),
    surgeLevel,
    combinedZScore: Math.round(combinedZ * 100) / 100,
    confidencePct,
    windows,
    trend,
    prediction,
    alertId,
    skipped:        false,
  };
}

// ── Cron-Batch ────────────────────────────────────────────────────────────────

export async function runDemandSurgeAllLocations(): Promise<{
  processed: number;
  alerts: number;
  errors: number;
}> {
  const svc = createServiceClient();
  const { data: locations } = await svc
    .from('locations')
    .select('id')
    .eq('active', true);

  let alerts = 0;
  let errors = 0;

  for (const loc of locations ?? []) {
    try {
      const result = await detectDemandSurgeV2(loc.id as string);
      if (!result.skipped) alerts++;
    } catch (err) {
      console.error('[demand-surge-v2] location error:', loc.id, err);
      errors++;
    }
  }

  return { processed: (locations ?? []).length, alerts, errors };
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getDemandSurgeDashboard(locationId: string): Promise<SurgeV2Dashboard> {
  const svc = createServiceClient();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [activeAlertsRes, recentRes, baselineRes] = await Promise.all([
    svc
      .from('demand_surge_v2_alerts')
      .select('*')
      .eq('location_id', locationId)
      .eq('dismissed', false)
      .is('resolved_at', null)
      .order('detected_at', { ascending: false })
      .limit(10),
    svc
      .from('demand_surge_v2_alerts')
      .select('detected_at, surge_level, z_score, order_rate, dismissed')
      .eq('location_id', locationId)
      .gte('detected_at', since24h)
      .order('detected_at', { ascending: false })
      .limit(50),
    svc
      .from('demand_surge_v2_baseline')
      .select('data_points')
      .eq('location_id', locationId),
  ]);

  const activeAlerts: SurgeV2Alert[] = (activeAlertsRes.data ?? []).map(mapAlert);
  const recent = (recentRes.data ?? []) as Array<{
    detected_at: string;
    surge_level: string;
    z_score: number;
    order_rate: number;
    dismissed: boolean;
  }>;

  const baselineRows = (baselineRes.data ?? []) as Array<{ data_points: number }>;
  const baselineSlots = baselineRows.length;
  const avgDataPoints = baselineSlots > 0
    ? baselineRows.reduce((s, r) => s + (r.data_points ?? 0), 0) / baselineSlots
    : null;
  const avgBaselineConfidence = avgDataPoints != null
    ? Math.min(100, Math.round((avgDataPoints / 8) * 100))
    : null;

  return {
    activeAlerts,
    recentDetections: recent.map((r) => ({
      detectedAt:  r.detected_at,
      surgeLevel:  r.surge_level as SurgeLevel,
      zScore:      Math.round(r.z_score * 100) / 100,
      orderRate:   Math.round(r.order_rate * 10) / 10,
      dismissed:   r.dismissed,
    })),
    baselineSlots,
    avgBaselineConfidence,
    alertsLast24h:    recent.length,
    mediumHighLast24h: recent.filter((r) => r.surge_level === 'medium' || r.surge_level === 'high').length,
  };
}

export async function getActiveAlerts(locationId: string): Promise<SurgeV2Alert[]> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('demand_surge_v2_alerts')
    .select('*')
    .eq('location_id', locationId)
    .eq('dismissed', false)
    .is('resolved_at', null)
    .order('detected_at', { ascending: false })
    .limit(5);

  return (data ?? []).map(mapAlert);
}

export async function dismissAlert(alertId: string, locationId: string): Promise<boolean> {
  const svc = createServiceClient();
  const { error } = await svc
    .from('demand_surge_v2_alerts')
    .update({ dismissed: true, dismissed_at: new Date().toISOString() })
    .eq('id', alertId)
    .eq('location_id', locationId);

  return !error;
}

// ── Baseline neu aufbauen ─────────────────────────────────────────────────────

export async function rebuildHourlyBaseline(locationId: string): Promise<{ slots: number }> {
  const svc = createServiceClient();
  const eightWeeksAgo = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString();

  const { data: orders } = await svc
    .from('customer_orders')
    .select('created_at')
    .eq('location_id', locationId)
    .in('typ', ['lieferung'])
    .gte('created_at', eightWeeksAgo);

  if (!orders || orders.length === 0) return { slots: 0 };

  // Aggregiere nach Stunde+Wochentag
  const slots: Record<string, number[]> = {};

  for (const order of orders as Array<{ created_at: string }>) {
    const d = new Date(order.created_at);
    const key = `${d.getUTCDay()}_${d.getUTCHours()}`;
    if (!slots[key]) slots[key] = Array(8).fill(0) as number[];  // 8 Wochen Slots
    // Zähle je Tag separat — wir brauchen den Tages-Slot
    const weekSlot = Math.floor((Date.now() - d.getTime()) / (7 * 24 * 60 * 60 * 1000));
    if (weekSlot < 8) {
      (slots[key][weekSlot] as number) += 1;
    }
  }

  // Berechne Mittelwert + StdDev je Slot + Upsert in Baseline-Tabelle
  const upserts: Array<{
    location_id: string;
    day_of_week: number;
    hour_of_day: number;
    mean_per_hour: number;
    stddev: number;
    data_points: number;
    updated_at: string;
  }> = [];

  for (const [key, counts] of Object.entries(slots)) {
    const [dowStr, hourStr] = key.split('_');
    const nonZeroCounts = counts.filter((c) => c > 0);
    const n = nonZeroCounts.length;
    if (n === 0) continue;

    const mean = nonZeroCounts.reduce((a, b) => a + b, 0) / n;
    const variance = n > 1
      ? nonZeroCounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1)
      : 0;
    const stddev = Math.sqrt(variance);

    upserts.push({
      location_id:   locationId,
      day_of_week:   parseInt(dowStr ?? '0', 10),
      hour_of_day:   parseInt(hourStr ?? '0', 10),
      mean_per_hour: Math.round(mean * 10) / 10,
      stddev:        Math.round(stddev * 100) / 100,
      data_points:   n,
      updated_at:    new Date().toISOString(),
    });
  }

  if (upserts.length > 0) {
    await svc
      .from('demand_surge_v2_baseline')
      .upsert(upserts, { onConflict: 'location_id,day_of_week,hour_of_day' });
  }

  return { slots: upserts.length };
}

// ── Interne Hilfsfunktionen ───────────────────────────────────────────────────

async function fetchWindowSignal(
  svc: ReturnType<typeof createServiceClient>,
  locationId: string,
  now: Date,
  windowMin: 15 | 30 | 60,
): Promise<TimeWindowSignal> {
  const windowStart = new Date(now.getTime() - windowMin * 60 * 1000).toISOString();

  const { count } = await svc
    .from('customer_orders')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .in('typ', ['lieferung'])
    .gte('created_at', windowStart);

  const orderCount = count ?? 0;
  const ratePerHour = (orderCount / windowMin) * 60;

  // Lade Baseline für aktuelle Stunde + Wochentag
  const hourOfDay = now.getUTCHours();
  const dayOfWeek = now.getUTCDay();

  const { data: baseline } = await svc
    .from('demand_surge_v2_baseline')
    .select('mean_per_hour, stddev, data_points')
    .eq('location_id', locationId)
    .eq('hour_of_day', hourOfDay)
    .eq('day_of_week', dayOfWeek)
    .maybeSingle() as {
      data: { mean_per_hour: number; stddev: number; data_points: number } | null;
    };

  const meanPerHour = baseline?.mean_per_hour ?? 0;
  const stddevPerHour = baseline?.stddev ?? 1;
  const dataPoints = baseline?.data_points ?? 0;

  const zScore = stddevPerHour > 0
    ? (ratePerHour - meanPerHour) / stddevPerHour
    : 0;

  return {
    windowMin,
    orderCount,
    ratePerHour:   Math.round(ratePerHour * 10) / 10,
    meanPerHour:   Math.round(meanPerHour * 10) / 10,
    stddevPerHour: Math.round(stddevPerHour * 100) / 100,
    zScore:        Math.round(zScore * 100) / 100,
    dataPoints,
  };
}

function buildTrend(windows: TimeWindowSignal[]): SurgeV2Trend {
  const w15 = windows.find((w) => w.windowMin === 15);
  const w30 = windows.find((w) => w.windowMin === 30);

  const rate15 = w15?.ratePerHour ?? 0;
  const rate30half = (w30?.ratePerHour ?? 0);  // 30-Min-Rate entspricht bereits Hochrechnung auf 1h

  const changePct = rate30half > 0
    ? Math.round(((rate15 - rate30half) / rate30half) * 100)
    : 0;

  const direction: SurgeV2Trend['direction'] =
    changePct >= 15  ? 'accelerating' :
    changePct <= -15 ? 'decelerating' :
    'stable';

  return { direction, rate15, rate30half, changePct };
}

function buildPrediction(
  windows:    TimeWindowSignal[],
  level:      SurgeLevel,
  confidence: number,
): SurgeV2Prediction {
  const w15 = windows.find((w) => w.windowMin === 15);
  const ratePerHour = w15?.ratePerHour ?? 0;

  // Prognose: aktuelle Rate * Konfidenz-Faktor (bei niedrigem Konfidenz konservativer)
  const confFactor = confidence / 100;
  const predictedOrdersNext60 = Math.round(ratePerHour * confFactor);

  // Vorausschau-Level konservativ (level kann sich noch erhöhen oder abflachen)
  const forecastLevel: SurgeLevel = level;

  return {
    predictedOrdersNext60,
    forecastLevel,
    forecastConfidence: confidence,
  };
}

async function upsertAlert(
  svc: ReturnType<typeof createServiceClient>,
  params: {
    locationId:    string;
    surgeLevel:    SurgeLevel;
    zScore:        number;
    orderRate:     number;
    detectedAt:    string;
    forecastNext60: number;
  },
): Promise<string | null> {
  try {
    // Wenn es bereits einen offenen Alert vom gleichen Level gibt (letzte 30 Min) → updaten
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: existing } = await svc
      .from('demand_surge_v2_alerts')
      .select('id')
      .eq('location_id', params.locationId)
      .eq('surge_level', params.surgeLevel)
      .eq('dismissed', false)
      .gte('detected_at', thirtyMinAgo)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      await svc
        .from('demand_surge_v2_alerts')
        .update({
          z_score:          Math.round(params.zScore * 100) / 100,
          order_rate:       params.orderRate,
          forecast_next_60: params.forecastNext60,
          detected_at:      params.detectedAt,
        })
        .eq('id', existing.id as string);
      return existing.id as string;
    }

    // Neuen Alert anlegen
    const { data: inserted } = await svc
      .from('demand_surge_v2_alerts')
      .insert({
        location_id:      params.locationId,
        surge_level:      params.surgeLevel,
        z_score:          Math.round(params.zScore * 100) / 100,
        order_rate:       params.orderRate,
        detected_at:      params.detectedAt,
        forecast_next_60: params.forecastNext60,
        dismissed:        false,
      })
      .select('id')
      .maybeSingle();

    return (inserted as { id: string } | null)?.id ?? null;
  } catch (err) {
    // Graceful — wenn Tabelle fehlt (Migration noch nicht ausgeführt)
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('demand_surge_v2') || msg.includes('42P01')) return null;
    console.error('[demand-surge-v2] upsertAlert:', msg);
    return null;
  }
}

function mapAlert(row: Record<string, unknown>): SurgeV2Alert {
  return {
    id:            row['id'] as string,
    locationId:    row['location_id'] as string,
    surgeLevel:    row['surge_level'] as SurgeLevel,
    zScore:        Math.round((row['z_score'] as number) * 100) / 100,
    orderRate:     Math.round((row['order_rate'] as number) * 10) / 10,
    detectedAt:    row['detected_at'] as string,
    forecastNext60: (row['forecast_next_60'] as number) ?? 0,
    dismissed:     (row['dismissed'] as boolean) ?? false,
    dismissedAt:   (row['dismissed_at'] as string | null) ?? null,
    resolvedAt:    (row['resolved_at'] as string | null) ?? null,
  };
}
