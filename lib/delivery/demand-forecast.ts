/**
 * lib/delivery/demand-forecast.ts
 *
 * Phase 201: Smart Demand Forecasting — Enhanced accuracy tracking
 *
 * Builds on the basic forecast.ts (Phase 19) by:
 *  - Storing hourly forecast snapshots in demand_forecast_snapshots
 *  - Filling in actuals once the slot has passed
 *  - Computing accuracy per weekday+hour pattern
 *  - Providing a weekly 7×24 forecast grid
 *  - Dashboard with calibration metrics
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { getForecast } from '@/lib/delivery/forecast';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ForecastAccuracySlot {
  weekday: number;
  hourOfDay: number;
  dataPoints: number;
  avgExpected: number;
  avgActual: number;
  avgAccuracyPct: number;
  peakActual: number;
  totalOrders30d: number;
}

export interface ForecastAccuracySummary {
  totalSnapshots: number;
  evaluatedSnapshots: number;
  avgAccuracyPct: number | null;
  avgAbsError: number | null;
  avgMape: number | null;
  totalActualOrders: number;
  totalExpectedOrders: number;
  earliestSnapshot: string | null;
  latestSnapshot: string | null;
}

export interface WeeklyForecastCell {
  weekday: number;
  hourOfDay: number;
  expectedOrders: number;
  confidenceOrders: number;
  peakOrders: number;
  recommendedDrivers: number;
  dataPoints: number;
}

export interface DemandForecastDashboard {
  summary: ForecastAccuracySummary | null;
  accuracyBySlot: ForecastAccuracySlot[];
  weeklyGrid: WeeklyForecastCell[];
  next24hForecast: {
    hourLocal: string;
    expectedOrders: number;
    confidenceOrders: number;
    recommendedTargetDrivers: number;
  }[];
  recentSnapshots: {
    forecastForHour: string;
    expectedOrders: number;
    actualOrders: number | null;
    accuracyPct: number | null;
  }[];
}

// ── recordForecastSnapshotsForLocation ────────────────────────────────────────

/**
 * Fetches the next 6-hour forecast and persists each slot into
 * demand_forecast_snapshots (idempotent via UPSERT on location+hour).
 */
export async function recordForecastSnapshotsForLocation(
  locationId: string,
): Promise<{ saved: number; errors: number }> {
  const sb = createServiceClient();

  let forecast;
  try {
    forecast = await getForecast(locationId, 6);
  } catch {
    return { saved: 0, errors: 1 };
  }

  const rows = forecast.slots.map((slot) => ({
    location_id:                 locationId,
    forecast_for_hour:           slot.hourUtc,
    forecast_at:                 new Date().toISOString(),
    weekday:                     slot.weekday,
    hour_of_day:                 slot.hourOfDay,
    expected_orders:             slot.expectedOrders,
    confidence_orders:           slot.confidenceOrders,
    peak_orders:                 slot.peakOrders,
    recommended_min_drivers:     slot.recommendedMinDrivers,
    recommended_target_drivers:  slot.recommendedTargetDrivers,
  }));

  let saved = 0;
  let errors = 0;

  // Upsert — do not overwrite actual_orders if already filled
  for (const row of rows) {
    const { error } = await sb
      .from('demand_forecast_snapshots')
      .upsert(row, {
        onConflict: 'location_id,forecast_for_hour',
        ignoreDuplicates: false,
      });
    if (error) errors++;
    else saved++;
  }

  return { saved, errors };
}

// ── fillActualsForLocation ────────────────────────────────────────────────────

/**
 * For every past snapshot (slot has already ended) that has no actual_orders,
 * counts the real orders that arrived during that hour and computes accuracy_pct.
 * Only fills slots that ended more than 30 minutes ago (to avoid partial counts).
 */
export async function fillActualsForLocation(
  locationId: string,
): Promise<{ filled: number; errors: number }> {
  const sb = createServiceClient();

  const cutoff = new Date(Date.now() - 30 * 60_000).toISOString();

  const { data: pending } = await sb
    .from('demand_forecast_snapshots')
    .select('id, forecast_for_hour, expected_orders')
    .eq('location_id', locationId)
    .is('actual_orders', null)
    .lt('forecast_for_hour', cutoff)
    .order('forecast_for_hour', { ascending: true })
    .limit(48);

  if (!pending?.length) return { filled: 0, errors: 0 };

  let filled = 0;
  let errors = 0;

  for (const snap of pending) {
    const slotStart = snap.forecast_for_hour as string;
    const slotEnd = new Date(new Date(slotStart).getTime() + 3_600_000).toISOString();

    const { count } = await sb
      .from('customer_orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .gte('created_at', slotStart)
      .lt('created_at', slotEnd);

    const actualOrders = count ?? 0;
    const expected = snap.expected_orders as number;
    const accuracyPct =
      actualOrders > 0
        ? Math.max(0, (1 - Math.abs(actualOrders - expected) / actualOrders) * 100)
        : expected === 0
          ? 100
          : 0;

    const { error } = await sb
      .from('demand_forecast_snapshots')
      .update({
        actual_orders: actualOrders,
        accuracy_pct: Math.round(accuracyPct * 100) / 100,
      })
      .eq('id', snap.id);

    if (error) errors++;
    else filled++;
  }

  return { filled, errors };
}

// ── Batch cron helpers ────────────────────────────────────────────────────────

export async function recordForecastAllLocations(): Promise<{
  locations: number;
  saved: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: locs } = await sb.from('locations').select('id').eq('active', true);
  if (!locs?.length) return { locations: 0, saved: 0, errors: 0 };

  const results = await Promise.allSettled(
    locs.map((l) => recordForecastSnapshotsForLocation(l.id as string)),
  );

  let saved = 0;
  let errors = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') { saved += r.value.saved; errors += r.value.errors; }
    else errors++;
  }
  return { locations: locs.length, saved, errors };
}

export async function fillActualsAllLocations(): Promise<{
  locations: number;
  filled: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: locs } = await sb.from('locations').select('id').eq('active', true);
  if (!locs?.length) return { locations: 0, filled: 0, errors: 0 };

  const results = await Promise.allSettled(
    locs.map((l) => fillActualsForLocation(l.id as string)),
  );

  let filled = 0;
  let errors = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') { filled += r.value.filled; errors += r.value.errors; }
    else errors++;
  }
  return { locations: locs.length, filled, errors };
}

export async function pruneForecastSnapshots(days = 60): Promise<number> {
  const sb = createServiceClient();
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const { count } = await sb
    .from('demand_forecast_snapshots')
    .delete({ count: 'exact' })
    .lt('forecast_for_hour', cutoff);
  return count ?? 0;
}

// ── getAccuracyDashboard ──────────────────────────────────────────────────────

export async function getDemandForecastDashboard(
  locationId: string,
): Promise<DemandForecastDashboard> {
  const sb = createServiceClient();

  const [summaryRes, accuracyRes, recentRes, forecastResult] = await Promise.all([
    sb
      .from('v_demand_forecast_summary')
      .select('*')
      .eq('location_id', locationId)
      .maybeSingle(),
    sb
      .from('v_demand_forecast_accuracy')
      .select('*')
      .eq('location_id', locationId)
      .limit(200),
    sb
      .from('demand_forecast_snapshots')
      .select('forecast_for_hour, expected_orders, actual_orders, accuracy_pct')
      .eq('location_id', locationId)
      .order('forecast_for_hour', { ascending: false })
      .limit(48),
    getForecast(locationId, 24).catch(() => null),
  ]);

  const summaryRow = summaryRes.data;
  const summary: ForecastAccuracySummary | null = summaryRow
    ? {
        totalSnapshots:     Number(summaryRow.total_snapshots ?? 0),
        evaluatedSnapshots: Number(summaryRow.evaluated_snapshots ?? 0),
        avgAccuracyPct:     summaryRow.avg_accuracy_pct != null ? Number(summaryRow.avg_accuracy_pct) : null,
        avgAbsError:        summaryRow.avg_abs_error != null ? Number(summaryRow.avg_abs_error) : null,
        avgMape:            summaryRow.avg_mape != null ? Number(summaryRow.avg_mape) : null,
        totalActualOrders:  Number(summaryRow.total_actual_orders ?? 0),
        totalExpectedOrders: Number(summaryRow.total_expected_orders ?? 0),
        earliestSnapshot:   (summaryRow.earliest_snapshot as string) ?? null,
        latestSnapshot:     (summaryRow.latest_snapshot as string) ?? null,
      }
    : null;

  const accuracyBySlot: ForecastAccuracySlot[] = (accuracyRes.data ?? []).map((r) => ({
    weekday:         Number(r.weekday),
    hourOfDay:       Number(r.hour_of_day),
    dataPoints:      Number(r.data_points ?? 0),
    avgExpected:     Number(r.avg_expected ?? 0),
    avgActual:       Number(r.avg_actual ?? 0),
    avgAccuracyPct:  Number(r.avg_accuracy_pct ?? 0),
    peakActual:      Number(r.peak_actual ?? 0),
    totalOrders30d:  Number(r.total_orders_30d ?? 0),
  }));

  // Build weekly grid from accuracy data (use demand pattern if accuracy data thin)
  const gridMap = new Map<string, ForecastAccuracySlot>();
  for (const slot of accuracyBySlot) {
    gridMap.set(`${slot.weekday}_${slot.hourOfDay}`, slot);
  }

  const weeklyGrid: WeeklyForecastCell[] = [];
  for (let wd = 0; wd <= 6; wd++) {
    for (let h = 0; h <= 23; h++) {
      const acc = gridMap.get(`${wd}_${h}`);
      weeklyGrid.push({
        weekday:           wd,
        hourOfDay:         h,
        expectedOrders:    acc ? Math.round(acc.avgExpected) : 0,
        confidenceOrders:  acc ? Math.round(acc.avgExpected * 1.2) : 0,
        peakOrders:        acc?.peakActual ?? 0,
        recommendedDrivers: acc ? Math.max(1, Math.ceil(acc.avgActual / 3)) : 0,
        dataPoints:        acc?.dataPoints ?? 0,
      });
    }
  }

  const next24hForecast = (forecastResult?.slots ?? []).map((s) => ({
    hourLocal:                s.hourLocal,
    expectedOrders:           s.expectedOrders,
    confidenceOrders:         s.confidenceOrders,
    recommendedTargetDrivers: s.recommendedTargetDrivers,
  }));

  const recentSnapshots = (recentRes.data ?? []).map((r) => ({
    forecastForHour: r.forecast_for_hour as string,
    expectedOrders:  Number(r.expected_orders),
    actualOrders:    r.actual_orders != null ? Number(r.actual_orders) : null,
    accuracyPct:     r.accuracy_pct != null ? Number(r.accuracy_pct) : null,
  }));

  return { summary, accuracyBySlot, weeklyGrid, next24hForecast, recentSnapshots };
}
