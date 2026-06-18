/**
 * lib/delivery/capacity-forecast.ts
 *
 * Phase 228: Smart Delivery Capacity Forecasting
 *
 * 7-day ahead predictions for order volume + driver utilization.
 * Uses DOW-based demand patterns + trend factor from last 28 days.
 *
 * Public API:
 *   buildForecastForLocation(locationId)  — compute 7-day forecast
 *   buildAllLocations()                   — cron batch
 *   getCapacityForecastDashboard(locationId) — KPIs + 7-day grid
 *   pruneOldForecasts(daysToKeep)         — cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CapacityForecastDay {
  forecastDate: string;
  dayOfWeek: number;
  expectedOrders: number;
  expectedOrdersLow: number;
  expectedOrdersHigh: number;
  recommendedDrivers: number;
  predictedUtilizationPct: number;
  trendFactor: number;
  confidenceScore: number;
  isPeakDay: boolean;
  peakHourStart: number | null;
  peakHourEnd: number | null;
  dataPoints: number;
  activeDrivers: number;
}

export interface CapacityForecastDashboard {
  forecast7d: CapacityForecastDay[];
  avgDailyOrders7d: number;
  avgUtilization7d: number;
  busiestDay: CapacityForecastDay | null;
  quietestDay: CapacityForecastDay | null;
  trendFactor7d: number;
  avgConfidence: number;
  totalExpectedOrders7d: number;
  peakDays: number;
  computedAt: string;
}

export interface BuildForecastResult {
  locationId: string;
  daysForecasted: number;
  upserted: number;
  errors: number;
}

export interface BatchResult {
  locations: number;
  daysForecasted: number;
  upserted: number;
  errors: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toISODateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

// ── Core computation ──────────────────────────────────────────────────────────

interface DemandPatternRow {
  weekday: number;
  hour_of_day: number;
  avg_orders: number;
  stddev_orders: number | null;
  peak_orders: number | null;
  data_points: number;
}

interface DemandSnapshotRow {
  snapshot_hour: string;
  orders_count: number;
}

export async function buildForecastForLocation(locationId: string): Promise<BuildForecastResult> {
  const sb = createServiceClient();
  const result: BuildForecastResult = { locationId, daysForecasted: 0, upserted: 0, errors: 0 };

  // 1. Demand pattern from view (DOW × hour averages)
  const { data: pattern } = await sb
    .from('v_hourly_demand_pattern')
    .select('weekday, hour_of_day, avg_orders, stddev_orders, peak_orders, data_points')
    .eq('location_id', locationId) as { data: DemandPatternRow[] | null };

  if (!pattern?.length) return result;

  // 2. Trend factor: sum orders last 14d vs. prior 14d
  const { data: trendRows } = await sb
    .from('delivery_demand_snapshots')
    .select('snapshot_hour, orders_count')
    .eq('location_id', locationId)
    .gte('snapshot_hour', new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString())
    .order('snapshot_hour', { ascending: false }) as { data: DemandSnapshotRow[] | null };

  let trendFactor = 1.0;
  if (trendRows?.length) {
    const cutoff14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const recent = trendRows.filter((r) => new Date(r.snapshot_hour) >= cutoff14d);
    const prior = trendRows.filter((r) => new Date(r.snapshot_hour) < cutoff14d);
    const sumRecent = recent.reduce((s, r) => s + ((r.orders_count as number) ?? 0), 0);
    const sumPrior = prior.reduce((s, r) => s + ((r.orders_count as number) ?? 0), 0);
    if (sumPrior > 0) {
      trendFactor = Math.round((sumRecent / sumPrior) * 1000) / 1000;
    }
  }

  // 3. Active drivers count
  const { count: activeDriversCount } = await sb
    .from('employees')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('rolle', 'fahrer')
    .eq('aktiv', true);

  const activeDrivers = activeDriversCount ?? 0;

  // 4. Build per-DOW lookup from pattern
  // Map: DOW → hour → row
  const patternMap = new Map<number, Map<number, DemandPatternRow>>();
  for (const row of pattern) {
    const dow = row.weekday as number;
    if (!patternMap.has(dow)) patternMap.set(dow, new Map());
    patternMap.get(dow)!.set(row.hour_of_day as number, row);
  }

  // 5. Compute 7-day forecast
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const rows: Array<Record<string, unknown>> = [];

  for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
    const forecastDate = addDays(today, dayOffset);
    const dow = forecastDate.getUTCDay(); // 0=Sun…6=Sat
    const forecastDateStr = toISODateStr(forecastDate);

    const dowPattern = patternMap.get(dow);
    if (!dowPattern) continue;

    const hourRows = Array.from(dowPattern.values());

    // Sum hourly averages for that DOW
    const sumAvgOrders = hourRows.reduce((s, r) => s + ((r.avg_orders as number) ?? 0), 0);
    const avgDataPoints = hourRows.length > 0
      ? hourRows.reduce((s, r) => s + ((r.data_points as number) ?? 0), 0) / hourRows.length
      : 0;
    const avgStddev = hourRows.length > 0
      ? hourRows.reduce((s, r) => s + ((r.stddev_orders as number) ?? 0), 0) / hourRows.length
      : 0;

    // Apply trend factor
    const expected = Math.round(sumAvgOrders * trendFactor * 10) / 10;

    // Confidence score: min(100, round(avgDataPoints / 8 * 100))
    const confidenceScore = Math.min(100, Math.round(avgDataPoints / 8 * 100));

    // Driver recommendation: ceil(expected / 15)
    const recommendedDrivers = Math.max(1, Math.ceil(expected / 15));

    // Utilization: (expected / (recommendedDrivers * 15)) * 100 clamped 0–100
    const rawUtilization = recommendedDrivers > 0
      ? (expected / (recommendedDrivers * 15)) * 100
      : 0;
    const predictedUtilizationPct = Math.min(100, Math.max(0, Math.round(rawUtilization * 10) / 10));

    // is_peak_day: utilization > 75
    const isPeakDay = predictedUtilizationPct > 75;

    // Peak hour window: hours where avg_orders > (daily_avg + 1 stddev)
    const dailyAvgPerHour = sumAvgOrders / Math.max(1, hourRows.length);
    const overallStddev = avgStddev;
    const peakThreshold = dailyAvgPerHour + overallStddev;

    const peakHours = hourRows
      .filter((r) => (r.avg_orders as number) > peakThreshold)
      .map((r) => r.hour_of_day as number)
      .sort((a, b) => a - b);

    const peakHourStart = peakHours.length > 0 ? peakHours[0] : null;
    const peakHourEnd = peakHours.length > 0 ? peakHours[peakHours.length - 1] : null;

    // Confidence interval: expected ± 1.5 * avgStddev * sqrt(dataPoints)
    const ciMargin = 1.5 * avgStddev * Math.sqrt(Math.max(1, avgDataPoints));
    const expectedLow = Math.max(0, Math.round((expected - ciMargin) * 10) / 10);
    const expectedHigh = Math.round((expected + ciMargin) * 10) / 10;

    rows.push({
      location_id:               locationId,
      forecast_date:             forecastDateStr,
      day_of_week:               dow,
      expected_orders:           expected,
      expected_orders_low:       expectedLow,
      expected_orders_high:      expectedHigh,
      recommended_drivers:       recommendedDrivers,
      predicted_utilization_pct: predictedUtilizationPct,
      trend_factor:              trendFactor,
      confidence_score:          confidenceScore,
      is_peak_day:               isPeakDay,
      peak_hour_start:           peakHourStart,
      peak_hour_end:             peakHourEnd,
      data_points:               Math.round(avgDataPoints),
      active_drivers:            activeDrivers,
      computed_at:               new Date().toISOString(),
    });
  }

  // 6. Upsert into capacity_forecast_snapshots
  for (const row of rows) {
    const { error } = await sb
      .from('capacity_forecast_snapshots')
      .upsert(row, { onConflict: 'location_id,forecast_date' });
    if (error) {
      result.errors++;
    } else {
      result.upserted++;
    }
  }

  result.daysForecasted = rows.length;
  return result;
}

// ── Cron batch ────────────────────────────────────────────────────────────────

export async function buildAllLocations(): Promise<BatchResult> {
  const sb = createServiceClient();
  const { data: locations } = await sb
    .from('locations')
    .select('id')
    .eq('active', true);

  const batch: BatchResult = { locations: 0, daysForecasted: 0, upserted: 0, errors: 0 };
  if (!locations?.length) return batch;

  for (const loc of locations) {
    try {
      const r = await buildForecastForLocation(loc.id as string);
      batch.locations++;
      batch.daysForecasted += r.daysForecasted;
      batch.upserted       += r.upserted;
      batch.errors         += r.errors;
    } catch {
      batch.errors++;
    }
  }
  return batch;
}

// ── Dashboard query ───────────────────────────────────────────────────────────

interface ForecastSnapshotRow {
  id: string;
  location_id: string;
  forecast_date: string;
  day_of_week: number;
  expected_orders: number;
  expected_orders_low: number;
  expected_orders_high: number;
  recommended_drivers: number;
  predicted_utilization_pct: number;
  trend_factor: number;
  confidence_score: number;
  is_peak_day: boolean;
  peak_hour_start: number | null;
  peak_hour_end: number | null;
  data_points: number;
  active_drivers: number;
  computed_at: string;
}

export async function getCapacityForecastDashboard(locationId: string): Promise<CapacityForecastDashboard> {
  const sb = createServiceClient();

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayIso = toISODateStr(today);

  // Check if latest rows are fresh (computed in last 2h)
  const { data: rows } = await sb
    .from('capacity_forecast_snapshots')
    .select('*')
    .eq('location_id', locationId)
    .gte('forecast_date', todayIso)
    .order('forecast_date', { ascending: true })
    .limit(7) as { data: ForecastSnapshotRow[] | null };

  // If stale or no rows, recompute
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const hasFreshData = rows?.length &&
    rows.some((r) => new Date(r.computed_at) >= twoHoursAgo);

  let freshRows: ForecastSnapshotRow[] = rows ?? [];

  if (!hasFreshData) {
    await buildForecastForLocation(locationId);
    const { data: reloaded } = await sb
      .from('capacity_forecast_snapshots')
      .select('*')
      .eq('location_id', locationId)
      .gte('forecast_date', todayIso)
      .order('forecast_date', { ascending: true })
      .limit(7) as { data: ForecastSnapshotRow[] | null };
    freshRows = reloaded ?? [];
  }

  const forecast7d: CapacityForecastDay[] = freshRows.map((r) => ({
    forecastDate:            r.forecast_date,
    dayOfWeek:               r.day_of_week,
    expectedOrders:          r.expected_orders,
    expectedOrdersLow:       r.expected_orders_low,
    expectedOrdersHigh:      r.expected_orders_high,
    recommendedDrivers:      r.recommended_drivers,
    predictedUtilizationPct: r.predicted_utilization_pct,
    trendFactor:             r.trend_factor,
    confidenceScore:         r.confidence_score,
    isPeakDay:               r.is_peak_day,
    peakHourStart:           r.peak_hour_start,
    peakHourEnd:             r.peak_hour_end,
    dataPoints:              r.data_points,
    activeDrivers:           r.active_drivers,
  }));

  const totalExpectedOrders7d = forecast7d.reduce((s, d) => s + d.expectedOrders, 0);
  const avgDailyOrders7d = forecast7d.length > 0
    ? Math.round(totalExpectedOrders7d / forecast7d.length * 10) / 10
    : 0;
  const avgUtilization7d = forecast7d.length > 0
    ? Math.round(forecast7d.reduce((s, d) => s + d.predictedUtilizationPct, 0) / forecast7d.length * 10) / 10
    : 0;
  const avgConfidence = forecast7d.length > 0
    ? Math.round(forecast7d.reduce((s, d) => s + d.confidenceScore, 0) / forecast7d.length)
    : 0;
  const trendFactor7d = forecast7d.length > 0 ? forecast7d[0].trendFactor : 1.0;
  const peakDays = forecast7d.filter((d) => d.isPeakDay).length;

  const busiestDay = forecast7d.reduce<CapacityForecastDay | null>((best, d) => {
    if (!best || d.expectedOrders > best.expectedOrders) return d;
    return best;
  }, null);

  const quietestDay = forecast7d.reduce<CapacityForecastDay | null>((best, d) => {
    if (!best || d.expectedOrders < best.expectedOrders) return d;
    return best;
  }, null);

  return {
    forecast7d,
    avgDailyOrders7d,
    avgUtilization7d,
    busiestDay,
    quietestDay,
    trendFactor7d,
    avgConfidence,
    totalExpectedOrders7d: Math.round(totalExpectedOrders7d * 10) / 10,
    peakDays,
    computedAt: new Date().toISOString(),
  };
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export async function pruneOldForecasts(daysToKeep = 30): Promise<number> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc('prune_old_capacity_forecasts', { days_to_keep: daysToKeep });
  if (error) return 0;
  return (data as number | null) ?? 0;
}
