/**
 * lib/delivery/shift-performance-prediction.ts — Phase 224
 *
 * Smart Shift Performance Prediction Engine
 *
 * Analyses historical order data grouped by day_of_week + hour_bucket
 * to predict optimal staffing for each 7×24 slot.
 *
 * Cron: snapshotAllLocations() täglich 03:30 UTC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface ShiftPrediction {
  id: string;
  locationId: string;
  snapshotDate: string;
  dayOfWeek: number;
  hourBucket: number;
  predictedDriverCount: number;
  predictedOrderCount: number;
  predictedRevenueEur: number;
  confidenceScore: number;
  dataPoints: number;
  signals: Record<string, unknown>;
  actualDriverCount: number | null;
  actualOrderCount: number | null;
  actualRevenueEur: number | null;
}

export interface ShiftPredictionAccuracy {
  locationId: string;
  avgOrderError: number;
  avgConfidence: number;
  filledActuals: number;
  totalSlots: number;
  latestSnapshot: string | null;
}

export interface ShiftPredictionDashboard {
  heatmap: number[][];  // [dow 0-6][hour 0-23] = predicted_order_count
  topHours: Array<{
    dayOfWeek: number;
    hourBucket: number;
    predictedOrders: number;
    predictedRevenue: number;
    confidence: number;
  }>;
  avgConfidence: number;
  totalSlots: number;
  accuracy: ShiftPredictionAccuracy | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function clamp(val: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, val));
}

// ────────────────────────────────────────────────────────────────────────────
// Core: predict shifts for one location (all 7×24 slots)
// ────────────────────────────────────────────────────────────────────────────

export async function predictShiftsForLocation(locationId: string): Promise<{
  slotsUpserted: number;
  dow: Record<number, number[]>;
}> {
  const svc = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const d30ago = new Date(Date.now() - 30 * 86400000).toISOString();

  // Fetch last 30 days of orders for this location
  const { data: orders } = await svc
    .from('customer_orders')
    .select('bestellt_am, gesamtbetrag')
    .eq('location_id', locationId)
    .gte('bestellt_am', d30ago)
    .not('bestellt_am', 'is', null);

  // Bucket orders by dow + hour
  type BucketStats = { orderCount: number; revenueEur: number; dataPoints: number };
  const buckets = new Map<string, BucketStats>();

  for (const order of orders ?? []) {
    const d = new Date(order.bestellt_am as string);
    const dow = d.getUTCDay(); // 0=Sun..6=Sat
    const hour = d.getUTCHours();
    const key = `${dow}:${hour}`;
    const existing = buckets.get(key) ?? { orderCount: 0, revenueEur: 0, dataPoints: 0 };
    existing.orderCount += 1;
    existing.revenueEur += Number(order.gesamtbetrag ?? 0);
    existing.dataPoints += 1;
    buckets.set(key, existing);
  }

  // Build upserts for all 7×24 slots
  const upserts: Array<Record<string, unknown>> = [];
  const dowMap: Record<number, number[]> = {};

  for (let dow = 0; dow < 7; dow++) {
    dowMap[dow] = [];
    for (let hour = 0; hour < 24; hour++) {
      const key = `${dow}:${hour}`;
      const stats = buckets.get(key);

      // We aggregate across 4 weeks; a single day_of_week appears ~4 times in 30d
      // dataPoints here = total orders in slot across all matching days
      // To get avg per occurrence, we count how many days of that dow occurred in 30d
      const daysOfDowInPeriod = Math.floor(30 / 7) + (dow <= new Date().getUTCDay() ? 1 : 0);
      const totalOrders = stats?.orderCount ?? 0;
      const totalRevenue = stats?.revenueEur ?? 0;
      const dataPoints = stats?.dataPoints ?? 0;

      const avgOrders = daysOfDowInPeriod > 0 ? totalOrders / daysOfDowInPeriod : 0;
      const avgRevenue = daysOfDowInPeriod > 0 ? totalRevenue / daysOfDowInPeriod : 0;

      // Driver demand: assume 3 orders per driver slot, 1.2 safety factor
      const predictedDriverCount = avgOrders > 0 ? Math.ceil((avgOrders / 3) * 1.2) : 0;
      // Confidence: data_points clamped to 30 (30 days of data = full confidence)
      const confidenceScore = clamp(dataPoints / 30);

      upserts.push({
        location_id:             locationId,
        snapshot_date:           today,
        day_of_week:             dow,
        hour_bucket:             hour,
        predicted_driver_count:  Math.round(predictedDriverCount * 100) / 100,
        predicted_order_count:   Math.round(avgOrders * 100) / 100,
        predicted_revenue_eur:   Math.round(avgRevenue * 100) / 100,
        confidence_score:        Math.round(confidenceScore * 1000) / 1000,
        data_points:             dataPoints,
        signals: {
          total_orders_30d: totalOrders,
          total_revenue_30d: totalRevenue,
          days_of_dow_in_period: daysOfDowInPeriod,
        },
      });
      dowMap[dow].push(hour);
    }
  }

  // Batch upsert in chunks of 50
  let slotsUpserted = 0;
  const chunkSize = 50;
  for (let i = 0; i < upserts.length; i += chunkSize) {
    const chunk = upserts.slice(i, i + chunkSize);
    const { error } = await svc
      .from('shift_performance_predictions')
      .upsert(chunk, { onConflict: 'location_id,snapshot_date,day_of_week,hour_bucket' });
    if (!error) slotsUpserted += chunk.length;
  }

  return { slotsUpserted, dow: dowMap };
}

// ────────────────────────────────────────────────────────────────────────────
// Cron batch
// ────────────────────────────────────────────────────────────────────────────

export async function snapshotAllLocations(): Promise<{
  locations: number;
  slotsUpserted: number;
  errors: number;
}> {
  const svc = createServiceClient();
  const { data: locations } = await svc
    .from('tenants')
    .select('id')
    .eq('is_active', true)
    .eq('module_delivery', true);

  if (!locations?.length) return { locations: 0, slotsUpserted: 0, errors: 0 };

  let totalSlots = 0;
  let errors = 0;

  for (const loc of locations) {
    try {
      const res = await predictShiftsForLocation(loc.id as string);
      totalSlots += res.slotsUpserted;
    } catch {
      errors++;
    }
  }

  return { locations: locations.length, slotsUpserted: totalSlots, errors };
}

// ────────────────────────────────────────────────────────────────────────────
// Query: get predictions
// ────────────────────────────────────────────────────────────────────────────

export async function getPredictions(
  locationId: string,
  dow?: number,
): Promise<ShiftPrediction[]> {
  const svc = createServiceClient();

  // Get latest snapshot date
  const { data: latest } = await svc
    .from('shift_performance_predictions')
    .select('snapshot_date')
    .eq('location_id', locationId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest?.snapshot_date) return [];

  let query = svc
    .from('shift_performance_predictions')
    .select('*')
    .eq('location_id', locationId)
    .eq('snapshot_date', latest.snapshot_date as string);

  if (dow !== undefined) {
    query = query.eq('day_of_week', dow);
  }

  const { data } = await query.order('day_of_week').order('hour_bucket');

  return (data ?? []).map(row => ({
    id:                    row.id as string,
    locationId:            row.location_id as string,
    snapshotDate:          row.snapshot_date as string,
    dayOfWeek:             Number(row.day_of_week),
    hourBucket:            Number(row.hour_bucket),
    predictedDriverCount:  Number(row.predicted_driver_count),
    predictedOrderCount:   Number(row.predicted_order_count),
    predictedRevenueEur:   Number(row.predicted_revenue_eur),
    confidenceScore:       Number(row.confidence_score),
    dataPoints:            Number(row.data_points),
    signals:               (row.signals as Record<string, unknown>) ?? {},
    actualDriverCount:     row.actual_driver_count != null ? Number(row.actual_driver_count) : null,
    actualOrderCount:      row.actual_order_count != null ? Number(row.actual_order_count) : null,
    actualRevenueEur:      row.actual_revenue_eur != null ? Number(row.actual_revenue_eur) : null,
  }));
}

// ────────────────────────────────────────────────────────────────────────────
// Dashboard
// ────────────────────────────────────────────────────────────────────────────

export async function getDashboard(locationId: string): Promise<ShiftPredictionDashboard> {
  const svc = createServiceClient();

  const [predictions, accuracyRes] = await Promise.all([
    getPredictions(locationId),
    svc
      .from('v_shift_prediction_accuracy')
      .select('*')
      .eq('location_id', locationId)
      .maybeSingle(),
  ]);

  // Build 7×24 heatmap (orders)
  const heatmap: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0) as number[]);
  for (const p of predictions) {
    heatmap[p.dayOfWeek][p.hourBucket] = Math.round(p.predictedOrderCount * 10) / 10;
  }

  // Top 5 hours by predicted orders
  const topHours = [...predictions]
    .sort((a, b) => b.predictedOrderCount - a.predictedOrderCount)
    .slice(0, 5)
    .map(p => ({
      dayOfWeek: p.dayOfWeek,
      hourBucket: p.hourBucket,
      predictedOrders: p.predictedOrderCount,
      predictedRevenue: p.predictedRevenueEur,
      confidence: p.confidenceScore,
    }));

  const avgConfidence =
    predictions.length > 0
      ? predictions.reduce((s, p) => s + p.confidenceScore, 0) / predictions.length
      : 0;

  const acc = accuracyRes.data;
  const accuracy: ShiftPredictionAccuracy | null = acc
    ? {
        locationId:    acc.location_id as string,
        avgOrderError: Number(acc.avg_order_error ?? 0),
        avgConfidence: Number(acc.avg_confidence ?? 0),
        filledActuals: Number(acc.filled_actuals ?? 0),
        totalSlots:    Number(acc.total_slots ?? 0),
        latestSnapshot: (acc.latest_snapshot as string | null) ?? null,
      }
    : null;

  return {
    heatmap,
    topHours,
    avgConfidence: Math.round(avgConfidence * 1000) / 1000,
    totalSlots: predictions.length,
    accuracy,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Prune
// ────────────────────────────────────────────────────────────────────────────

export async function pruneOldPredictions(daysToKeep = 90): Promise<number> {
  const svc = createServiceClient();
  const { data } = await svc.rpc('prune_old_shift_predictions', { days_to_keep: daysToKeep });
  return Number(data ?? 0);
}
