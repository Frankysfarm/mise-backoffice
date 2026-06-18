/**
 * lib/delivery/delivery-promise.ts
 *
 * Phase 229: Smart Delivery Promise Engine
 *
 * Computes a realistic delivery window at order placement time,
 * records the promise, and later settles it against actual delivery time.
 * Tracks accuracy over time to power a continuous-improvement dashboard.
 *
 * Factors used for promise computation:
 *  1. Zone base ETA (from delivery_zones config)
 *  2. Kitchen queue depth (pending + in_prep orders)
 *  3. Available drivers ratio
 *  4. Weather difficulty factor (latest snapshot)
 *  5. Surge active → widen window
 *  6. Time-of-day pattern (peak hours)
 *  7. 14-day historical accuracy offset (self-calibrating)
 *
 * Public API:
 *   computePromise(locationId, zoneName?)       → PromiseWindow
 *   recordPromise(input)                        → { id }
 *   settlePromise(orderId)                      → settled | skipped
 *   settleAllPendingPromises(locationId)        → { settled, errors }
 *   getPromiseDashboard(locationId)             → PromiseDashboard
 *   pruneOldPromises(daysToKeep)                → { pruned }
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { getZoneConfig } from './zones';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PromiseWindow {
  minMin: number;
  maxMin: number;
  confidenceScore: number;
  label: string;
  queueDepth: number;
  availableDrivers: number;
  weatherFactor: number;
  surgeActive: boolean;
}

export interface RecordPromiseInput {
  orderId: string;
  locationId: string;
  zoneName?: string;
  promisedMin: number;
  promisedMax: number;
  confidenceScore: number;
  queueDepth: number;
  availableDrivers: number;
  weatherFactor: number;
  surgeActive: boolean;
}

export interface SettleResult {
  status: 'settled' | 'skipped' | 'not_found';
  actualDeliveryMin?: number;
  accuracyBucket?: string;
}

export interface PromiseAccuracyDay {
  promiseDate: string;
  totalPromises: number;
  settledCount: number;
  earlyCount: number;
  onTimeCount: number;
  lateCount: number;
  veryLateCount: number;
  onTimeRatePct: number;
  avgActualMin: number | null;
  avgWindowWidthMin: number | null;
  avgMissMin: number | null;
}

export interface PromiseKpis {
  total7d: number;
  settled7d: number;
  onTimeRatePct: number;
  avgActualMin: number | null;
  avgPromiseMidpoint: number | null;
  avgMissMin: number | null;
  veryLate7d: number;
}

export interface PromiseDashboard {
  kpis: PromiseKpis;
  trend30d: PromiseAccuracyDay[];
  unsettledCount: number;
  lastComputedAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const KITCHEN_OVERHEAD_PER_ORDER = 3;  // min per queued order
const DRIVER_SHORTAGE_BUFFER     = 8;  // extra min when < 1 driver/3 orders
const PEAK_HOUR_BUFFER           = 5;  // extra min during peak hours (11-14, 17-21)
const SURGE_WINDOW_EXTRA         = 10; // widen window by 10 min when surge active
const MIN_WINDOW_WIDTH           = 10; // always at least 10-min window

// ── Internal helpers ──────────────────────────────────────────────────────────

function isPeakHour(utcHour: number): boolean {
  return (utcHour >= 10 && utcHour <= 13) || (utcHour >= 16 && utcHour <= 20);
}

/**
 * Returns the 14-day calibration offset: if we historically promise too low,
 * we add the average miss to future promises.
 */
async function getCalibrationOffset(locationId: string): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('delivery_promises')
    .select('actual_delivery_min, promised_max')
    .eq('location_id', locationId)
    .not('actual_delivery_min', 'is', null)
    .gte('promised_at', new Date(Date.now() - 14 * 86400 * 1000).toISOString())
    .order('promised_at', { ascending: false })
    .limit(200);

  if (!data || data.length < 10) return 0;

  const overRuns = data
    .map((r) => {
      const actual = r.actual_delivery_min as number;
      const max = r.promised_max as number;
      return actual > max ? actual - max : 0;
    })
    .filter((v) => v > 0);

  if (overRuns.length < 5) return 0;
  const avgOverrun = overRuns.reduce((a, b) => a + b, 0) / overRuns.length;
  return Math.round(Math.min(avgOverrun * 0.5, 10)); // cap at 10 min correction
}

async function getLatestWeatherFactor(locationId: string): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('weather_snapshots')
    .select('eta_factor')
    .eq('location_id', locationId)
    .order('snapped_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return 1.0;
  const factor = data.eta_factor as number;
  return typeof factor === 'number' ? factor : 1.0;
}

async function isSurgeActive(locationId: string): Promise<boolean> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('surge_events')
    .select('id')
    .eq('location_id', locationId)
    .is('ended_at', null)
    .limit(1)
    .maybeSingle();

  return data != null;
}

async function getQueueStats(locationId: string): Promise<{ depth: number; drivers: number }> {
  const sb = createServiceClient();
  const [ordersRes, driversRes] = await Promise.all([
    sb
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .in('status', ['accepted', 'in_preparation', 'ready']),
    sb
      .from('mise_drivers')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('state', 'available'),
  ]);

  return {
    depth: ordersRes.count ?? 0,
    drivers: driversRes.count ?? 0,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Compute a realistic delivery promise window for the given location + zone. */
export async function computePromise(
  locationId: string,
  zoneName?: string,
): Promise<PromiseWindow> {
  const [zones, queueStats, weatherFactor, surgeActive, calibOffset] = await Promise.all([
    getZoneConfig(locationId),
    getQueueStats(locationId),
    getLatestWeatherFactor(locationId),
    isSurgeActive(locationId),
    getCalibrationOffset(locationId),
  ]);

  const zone = zoneName
    ? (zones.find((z) => z.name === zoneName) ?? zones[zones.length - 1])
    : (zones[0] ?? { eta_base_min: 30 });

  const baseMin = zone.eta_base_min;
  const utcHour = new Date().getUTCHours();

  // Dynamic adjustments
  const kitchenOverhead = Math.min(queueStats.depth * KITCHEN_OVERHEAD_PER_ORDER, 20);
  const driverShortage =
    queueStats.drivers < Math.ceil(queueStats.depth / 3) ? DRIVER_SHORTAGE_BUFFER : 0;
  const peakBuffer = isPeakHour(utcHour) ? PEAK_HOUR_BUFFER : 0;
  const weatherExtra = Math.round((weatherFactor - 1.0) * baseMin);

  const adjustedBase = Math.round(
    baseMin + kitchenOverhead + driverShortage + peakBuffer + weatherExtra + calibOffset,
  );

  // Window width: wider under stress
  const stressLevel = (queueStats.depth / Math.max(queueStats.drivers, 1));
  const baseWidth = stressLevel > 3 ? 20 : stressLevel > 1.5 ? 15 : MIN_WINDOW_WIDTH;
  const windowWidth = baseWidth + (surgeActive ? SURGE_WINDOW_EXTRA : 0);

  const minMin = Math.max(adjustedBase, baseMin);
  const maxMin = minMin + windowWidth;

  // Confidence: decreases with queue depth, weather, surge
  let confidence = 85;
  if (queueStats.depth > 10) confidence -= 10;
  if (queueStats.depth > 20) confidence -= 10;
  if (weatherFactor > 1.2)   confidence -= 10;
  if (surgeActive)            confidence -= 10;
  if (queueStats.drivers < 1) confidence -= 15;
  confidence = Math.max(confidence, 30);

  const label = `${minMin}–${maxMin} min`;

  return {
    minMin,
    maxMin,
    confidenceScore: confidence,
    label,
    queueDepth: queueStats.depth,
    availableDrivers: queueStats.drivers,
    weatherFactor,
    surgeActive,
  };
}

/** Persist a delivery promise to DB (call right after order creation). */
export async function recordPromise(input: RecordPromiseInput): Promise<{ id: string }> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('delivery_promises')
    .upsert(
      {
        order_id:          input.orderId,
        location_id:       input.locationId,
        zone_name:         input.zoneName ?? null,
        promised_min:      input.promisedMin,
        promised_max:      input.promisedMax,
        confidence_score:  input.confidenceScore,
        queue_depth:       input.queueDepth,
        available_drivers: input.availableDrivers,
        weather_factor:    input.weatherFactor,
        surge_active:      input.surgeActive,
        promised_at:       new Date().toISOString(),
      },
      { onConflict: 'order_id' },
    )
    .select('id')
    .single();

  if (error || !data) throw new Error(`recordPromise failed: ${error?.message}`);
  return { id: data.id as string };
}

/**
 * Settle a promise once the order is delivered.
 * Looks up actual delivery time from orders table.
 */
export async function settlePromise(orderId: string): Promise<SettleResult> {
  const sb = createServiceClient();

  // Find the promise
  const { data: promise } = await sb
    .from('delivery_promises')
    .select('id, location_id, promised_at')
    .eq('order_id', orderId)
    .is('settled_at', null)
    .maybeSingle();

  if (!promise) return { status: 'not_found' };

  // Get actual delivery time
  const { data: order } = await sb
    .from('orders')
    .select('status, delivered_at, created_at')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) return { status: 'skipped' };

  const deliveredAt = order.delivered_at as string | null;
  const createdAt   = order.created_at as string;

  if (!deliveredAt) return { status: 'skipped' };

  const promisedAt = promise.promised_at as string;
  const actualMs   = new Date(deliveredAt).getTime() - new Date(promisedAt).getTime();
  const actualMin  = Math.round(actualMs / 60000);

  if (actualMin < 0 || actualMin > 300) return { status: 'skipped' };

  const { data: settled, error } = await sb
    .from('delivery_promises')
    .update({
      actual_delivery_min: actualMin,
      settled_at:          new Date().toISOString(),
    })
    .eq('id', promise.id)
    .select('accuracy_bucket')
    .single();

  if (error || !settled) return { status: 'skipped' };

  return {
    status: 'settled',
    actualDeliveryMin: actualMin,
    accuracyBucket: settled.accuracy_bucket as string | undefined ?? undefined,
  };
}

/**
 * Cron batch: settle all delivered-but-unsettled promises for a location.
 */
export async function settleAllPendingPromises(
  locationId: string,
): Promise<{ settled: number; errors: number }> {
  const sb = createServiceClient();

  // Find unsettled promises with delivered orders
  const { data: pending } = await sb
    .from('delivery_promises')
    .select('order_id')
    .eq('location_id', locationId)
    .is('settled_at', null)
    .gte('promised_at', new Date(Date.now() - 48 * 3600 * 1000).toISOString())
    .limit(200);

  if (!pending || pending.length === 0) return { settled: 0, errors: 0 };

  const orderIds = pending.map((p) => p.order_id as string);

  // Batch-fetch delivered orders
  const { data: deliveredOrders } = await sb
    .from('orders')
    .select('id, delivered_at, created_at')
    .in('id', orderIds)
    .in('status', ['delivered', 'completed', 'bezahlt'])
    .not('delivered_at', 'is', null);

  if (!deliveredOrders || deliveredOrders.length === 0) return { settled: 0, errors: 0 };

  let settled = 0;
  let errors = 0;

  for (const order of deliveredOrders) {
    try {
      const result = await settlePromise(order.id as string);
      if (result.status === 'settled') settled++;
    } catch {
      errors++;
    }
  }

  return { settled, errors };
}

/** Admin dashboard KPIs + 30-day trend. */
export async function getPromiseDashboard(locationId: string): Promise<PromiseDashboard> {
  const sb = createServiceClient();

  const [kpisRes, trendRes, unsettledRes] = await Promise.all([
    sb
      .from('v_promise_kpis_7d')
      .select('*')
      .eq('location_id', locationId)
      .maybeSingle(),

    sb
      .from('v_promise_accuracy_daily')
      .select('*')
      .eq('location_id', locationId)
      .order('promise_date', { ascending: false })
      .limit(30),

    sb
      .from('delivery_promises')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .is('settled_at', null),
  ]);

  const raw = kpisRes.data;
  const kpis: PromiseKpis = raw
    ? {
        total7d:           Number(raw.total_7d ?? 0),
        settled7d:         Number(raw.settled_7d ?? 0),
        onTimeRatePct:     Number(raw.on_time_rate_pct ?? 0),
        avgActualMin:      raw.avg_actual_min != null ? Number(raw.avg_actual_min) : null,
        avgPromiseMidpoint: raw.avg_promise_midpoint != null ? Number(raw.avg_promise_midpoint) : null,
        avgMissMin:        raw.avg_miss_min != null ? Number(raw.avg_miss_min) : null,
        veryLate7d:        Number(raw.very_late_7d ?? 0),
      }
    : {
        total7d: 0, settled7d: 0, onTimeRatePct: 0,
        avgActualMin: null, avgPromiseMidpoint: null, avgMissMin: null, veryLate7d: 0,
      };

  const trend30d: PromiseAccuracyDay[] = (trendRes.data ?? []).map((r) => ({
    promiseDate:      r.promise_date as string,
    totalPromises:    Number(r.total_promises ?? 0),
    settledCount:     Number(r.settled_count ?? 0),
    earlyCount:       Number(r.early_count ?? 0),
    onTimeCount:      Number(r.on_time_count ?? 0),
    lateCount:        Number(r.late_count ?? 0),
    veryLateCount:    Number(r.very_late_count ?? 0),
    onTimeRatePct:    Number(r.on_time_rate_pct ?? 0),
    avgActualMin:     r.avg_actual_min != null ? Number(r.avg_actual_min) : null,
    avgWindowWidthMin: r.avg_window_width_min != null ? Number(r.avg_window_width_min) : null,
    avgMissMin:       r.avg_miss_min != null ? Number(r.avg_miss_min) : null,
  }));

  return {
    kpis,
    trend30d,
    unsettledCount: unsettledRes.count ?? 0,
    lastComputedAt: new Date().toISOString(),
  };
}

/** Prune settled promises older than daysToKeep. */
export async function pruneOldPromises(
  daysToKeep = 90,
): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc('prune_old_delivery_promises', {
    days_to_keep: daysToKeep,
  });
  if (error) throw error;
  return { pruned: (data as number | null) ?? 0 };
}

/** Settle promises for all active locations (cron batch). */
export async function settleAllLocations(): Promise<{
  locations: number;
  settled: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: locations } = await sb
    .from('locations')
    .select('id')
    .eq('active', true);

  if (!locations || locations.length === 0) return { locations: 0, settled: 0, errors: 0 };

  let totalSettled = 0;
  let totalErrors = 0;

  for (const loc of locations) {
    const result = await settleAllPendingPromises(loc.id as string).catch(() => ({
      settled: 0,
      errors: 1,
    }));
    totalSettled += result.settled;
    totalErrors  += result.errors;
  }

  return { locations: locations.length, settled: totalSettled, errors: totalErrors };
}
