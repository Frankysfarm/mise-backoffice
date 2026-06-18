/**
 * lib/delivery/order-lifecycle.ts
 *
 * Phase 242: Smart Order Lifecycle Funnel Analysis
 *
 * Captures per-order end-to-end timing across 4 stages and surfaces
 * bottlenecks so managers can pinpoint exactly where time is lost.
 *
 * Stages:
 *   1. dispatch_wait_min  : placed_at → kitchen_notified_at
 *   2. kitchen_prep_min   : kitchen_notified_at → kitchen_ready_at
 *   3. pickup_wait_min    : kitchen_ready_at → pickup stop completed_at
 *   4. drive_min          : pickup stop completed_at → dropoff completed_at
 *
 * Public API:
 *   snapOrderLifecycle(orderId, locationId)  — capture one order's timing
 *   snapCompletedOrders(locationId)          — batch-snap recent completions
 *   snapAllLocations()                       — cron batch
 *   getLifecycleDashboard(locationId)        — admin dashboard data
 *   pruneOldLifecycleSnapshots(days)         — cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LifecycleStageStats {
  avgMin: number | null;
  pct: number;          // share of total avg time (0–100)
  label: string;
  color: string;
}

export interface LifecycleSummary {
  totalOrders: number;
  avgTotalMin: number | null;
  avgDispatchWaitMin: number | null;
  avgKitchenPrepMin: number | null;
  avgPickupWaitMin: number | null;
  avgDriveMin: number | null;
  onTimePct: number | null;
  bottleneckStage: string | null;
}

export interface LifecycleHourRow {
  hourOfDay: number;
  orderCount: number;
  avgDispatchWaitMin: number | null;
  avgKitchenPrepMin: number | null;
  avgPickupWaitMin: number | null;
  avgDriveMin: number | null;
  avgTotalMin: number | null;
}

export interface LifecycleTrendDay {
  dayStr: string;           // YYYY-MM-DD
  orderCount: number;
  avgTotalMin: number | null;
  onTimePct: number | null;
}

export interface LifecycleDashboard {
  summary: LifecycleSummary;
  stages: LifecycleStageStats[];
  byHour: LifecycleHourRow[];
  trend7d: LifecycleTrendDay[];
  lastSnappedAt: string | null;
}

interface RawOrder {
  id: string;
  bestellnummer: string | null;
  bestellt_am: string;
  location_id: string;
}

interface RawKitchenTiming {
  order_id: string;
  notified_at: string | null;
  ready_at: string | null;
}

interface RawBatchStop {
  id: string;
  order_id: string | null;
  stop_type: string;
  completed_at: string | null;
  mise_delivery_batches: {
    driver_id: string | null;
    mise_drivers: { fahrzeug: string | null } | null;
    mise_batch_stops: { order_id: string | null; stop_type: string; completed_at: string | null }[];
  } | null;
}

interface RawPerformance {
  order_id: string;
  on_time: boolean | null;
  eta_min: number | null;
  zone: string | null;
}

// ─── Core Snap ────────────────────────────────────────────────────────────────

export async function snapOrderLifecycle(
  orderId: string,
  locationId: string,
): Promise<boolean> {
  const sb = createServiceClient();

  // Load core order
  const { data: order } = await sb
    .from('customer_orders')
    .select('id, bestellnummer, bestellt_am, location_id')
    .eq('id', orderId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (!order || !order.bestellt_am) return false;

  // Load kitchen timing
  const { data: timing } = await sb
    .from('kitchen_timings')
    .select('notified_at, ready_at')
    .eq('order_id', orderId)
    .maybeSingle();

  // Load pickup and dropoff stops for this order
  const { data: dropoffStop } = await sb
    .from('mise_batch_stops')
    .select(`
      id, order_id, stop_type, completed_at,
      mise_delivery_batches!inner(
        driver_id,
        mise_drivers(fahrzeug),
        mise_batch_stops(order_id, stop_type, completed_at)
      )
    `)
    .eq('order_id', orderId)
    .eq('stop_type', 'dropoff')
    .not('completed_at', 'is', null)
    .limit(1)
    .maybeSingle() as { data: RawBatchStop | null };

  // Load performance record for on_time / eta / zone
  const { data: perf } = await sb
    .from('delivery_performance')
    .select('order_id, on_time, eta_min, zone')
    .eq('order_id', orderId)
    .maybeSingle() as { data: RawPerformance | null };

  const placedAt = new Date(order.bestellt_am as string);
  const kitchenNotifiedAt = timing?.notified_at ? new Date(timing.notified_at as string) : null;
  const kitchenReadyAt = timing?.ready_at ? new Date(timing.ready_at as string) : null;

  // Find the pickup stop completed time (same batch, same restaurant stop)
  let pickupCompletedAt: Date | null = null;
  if (dropoffStop?.mise_delivery_batches) {
    const allStops = dropoffStop.mise_delivery_batches.mise_batch_stops ?? [];
    const pickupStop = allStops.find(
      (s) => s.stop_type === 'pickup' && s.completed_at != null,
    );
    if (pickupStop?.completed_at) {
      pickupCompletedAt = new Date(pickupStop.completed_at as string);
    }
  }

  const deliveryCompletedAt = dropoffStop?.completed_at
    ? new Date(dropoffStop.completed_at as string)
    : null;

  // Compute stage durations (minutes)
  function diffMin(a: Date | null, b: Date | null): number | null {
    if (!a || !b) return null;
    const d = (b.getTime() - a.getTime()) / 60_000;
    return d >= 0 && d < 300 ? Math.round(d * 10) / 10 : null;
  }

  const dispatchWaitMin = diffMin(placedAt, kitchenNotifiedAt);
  const kitchenPrepMin = diffMin(kitchenNotifiedAt, kitchenReadyAt);
  const pickupWaitMin = diffMin(kitchenReadyAt, pickupCompletedAt);
  const driveMin = diffMin(pickupCompletedAt, deliveryCompletedAt);
  const totalMin = diffMin(placedAt, deliveryCompletedAt);

  // Only snap if at least delivery is complete
  if (!deliveryCompletedAt || !totalMin) return false;

  const vehicle = (dropoffStop?.mise_delivery_batches?.mise_drivers as { fahrzeug: string | null } | null)?.fahrzeug ?? null;
  const hourOfDay = placedAt.getUTCHours();
  const dayOfWeek = placedAt.getUTCDay();

  const { error } = await sb.from('order_lifecycle_snapshots').upsert(
    {
      location_id:           locationId,
      order_id:              orderId,
      bestellnummer:         order.bestellnummer as string | null,
      placed_at:             placedAt.toISOString(),
      kitchen_notified_at:   kitchenNotifiedAt?.toISOString() ?? null,
      kitchen_ready_at:      kitchenReadyAt?.toISOString() ?? null,
      pickup_completed_at:   pickupCompletedAt?.toISOString() ?? null,
      delivery_completed_at: deliveryCompletedAt.toISOString(),
      dispatch_wait_min:     dispatchWaitMin,
      kitchen_prep_min:      kitchenPrepMin,
      pickup_wait_min:       pickupWaitMin,
      drive_min:             driveMin,
      total_min:             totalMin,
      zone:                  perf?.zone ?? null,
      vehicle_type:          vehicle,
      on_time:               perf?.on_time ?? null,
      eta_min:               perf?.eta_min ?? null,
      hour_of_day:           hourOfDay,
      day_of_week:           dayOfWeek,
      snapped_at:            new Date().toISOString(),
    },
    { onConflict: 'order_id' },
  );

  if (error) {
    // Migration not run yet — graceful fallback
    if (error.message?.includes('order_lifecycle_snapshots')) return false;
    throw error;
  }
  return true;
}

// ─── Batch Snap ───────────────────────────────────────────────────────────────

/** Snap the last 200 completed delivery orders for a location (cron / rebuild). */
export async function snapCompletedOrders(locationId: string): Promise<number> {
  const sb = createServiceClient();

  // Already snapped order IDs (last 7 days) — avoid double work
  const { data: existing } = await sb
    .from('order_lifecycle_snapshots')
    .select('order_id')
    .eq('location_id', locationId)
    .gte('snapped_at', new Date(Date.now() - 7 * 86_400_000).toISOString())
    .limit(1000);

  const existingIds = new Set((existing ?? []).map((r) => r.order_id as string));

  // Recently completed delivery orders
  const { data: orders } = await sb
    .from('customer_orders')
    .select('id')
    .eq('location_id', locationId)
    .eq('bestellart', 'lieferung')
    .eq('status', 'geliefert')
    .gte('bestellt_am', new Date(Date.now() - 7 * 86_400_000).toISOString())
    .order('bestellt_am', { ascending: false })
    .limit(200) as { data: RawOrder[] | null };

  if (!orders) return 0;

  const newOrders = orders.filter((o) => !existingIds.has(o.id));
  let snapped = 0;

  for (const o of newOrders) {
    const ok = await snapOrderLifecycle(o.id, locationId);
    if (ok) snapped++;
  }

  return snapped;
}

/** Cron batch: snap all active locations. */
export async function snapAllLocations(): Promise<{ locations: number; snapped: number }> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('aktiv', true)
    .limit(100);

  let totalSnapped = 0;
  for (const loc of locs ?? []) {
    const n = await snapCompletedOrders(loc.id as string).catch(() => 0);
    totalSnapped += n;
  }

  return { locations: (locs ?? []).length, snapped: totalSnapped };
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getLifecycleDashboard(locationId: string): Promise<LifecycleDashboard> {
  const sb = createServiceClient();

  // Stage averages (last 30 days via view)
  const { data: avgRow } = await sb
    .from('v_lifecycle_stage_averages')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();

  // By-hour breakdown
  const { data: hourRows } = await sb
    .from('v_lifecycle_by_hour')
    .select('*')
    .eq('location_id', locationId)
    .order('hour_of_day', { ascending: true })
    .limit(24);

  // 7-day trend (direct query)
  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: trendRows } = await sb
    .from('order_lifecycle_snapshots')
    .select('placed_at, total_min, on_time')
    .eq('location_id', locationId)
    .gte('placed_at', since7d)
    .order('placed_at', { ascending: true })
    .limit(1000);

  // Last snap time
  const { data: lastSnap } = await sb
    .from('order_lifecycle_snapshots')
    .select('snapped_at')
    .eq('location_id', locationId)
    .order('snapped_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Build summary
  const summary: LifecycleSummary = {
    totalOrders:          Number(avgRow?.total_orders ?? 0),
    avgTotalMin:          avgRow?.avg_total_min != null ? Number(avgRow.avg_total_min) : null,
    avgDispatchWaitMin:   avgRow?.avg_dispatch_wait_min != null ? Number(avgRow.avg_dispatch_wait_min) : null,
    avgKitchenPrepMin:    avgRow?.avg_kitchen_prep_min != null ? Number(avgRow.avg_kitchen_prep_min) : null,
    avgPickupWaitMin:     avgRow?.avg_pickup_wait_min != null ? Number(avgRow.avg_pickup_wait_min) : null,
    avgDriveMin:          avgRow?.avg_drive_min != null ? Number(avgRow.avg_drive_min) : null,
    onTimePct:            avgRow?.on_time_pct != null ? Number(avgRow.on_time_pct) : null,
    bottleneckStage:      null,
  };

  // Identify bottleneck (longest stage)
  const stageDurations: Record<string, number | null> = {
    'Dispatch-Wartezeit': summary.avgDispatchWaitMin,
    'Küchen-Zubereitung': summary.avgKitchenPrepMin,
    'Abholwartezeit':     summary.avgPickupWaitMin,
    'Fahrzeit':           summary.avgDriveMin,
  };
  let maxDuration = 0;
  for (const [name, dur] of Object.entries(stageDurations)) {
    if (dur != null && dur > maxDuration) {
      maxDuration = dur;
      summary.bottleneckStage = name;
    }
  }

  // Build stage breakdown with percentages
  const totalAvg = (summary.avgDispatchWaitMin ?? 0)
    + (summary.avgKitchenPrepMin ?? 0)
    + (summary.avgPickupWaitMin ?? 0)
    + (summary.avgDriveMin ?? 0);

  function stagePct(val: number | null): number {
    if (!val || !totalAvg) return 0;
    return Math.round((val / totalAvg) * 100);
  }

  const stages: LifecycleStageStats[] = [
    {
      label:  'Dispatch-Wartezeit',
      avgMin: summary.avgDispatchWaitMin,
      pct:    stagePct(summary.avgDispatchWaitMin),
      color:  'bg-purple-500',
    },
    {
      label:  'Küchen-Zubereitung',
      avgMin: summary.avgKitchenPrepMin,
      pct:    stagePct(summary.avgKitchenPrepMin),
      color:  'bg-amber-500',
    },
    {
      label:  'Abholwartezeit',
      avgMin: summary.avgPickupWaitMin,
      pct:    stagePct(summary.avgPickupWaitMin),
      color:  'bg-blue-500',
    },
    {
      label:  'Fahrzeit',
      avgMin: summary.avgDriveMin,
      pct:    stagePct(summary.avgDriveMin),
      color:  'bg-emerald-500',
    },
  ];

  // By-hour rows
  const byHour: LifecycleHourRow[] = (hourRows ?? []).map((r) => ({
    hourOfDay:            Number(r.hour_of_day),
    orderCount:           Number(r.order_count),
    avgDispatchWaitMin:   r.avg_dispatch_wait_min != null ? Number(r.avg_dispatch_wait_min) : null,
    avgKitchenPrepMin:    r.avg_kitchen_prep_min != null ? Number(r.avg_kitchen_prep_min) : null,
    avgPickupWaitMin:     r.avg_pickup_wait_min != null ? Number(r.avg_pickup_wait_min) : null,
    avgDriveMin:          r.avg_drive_min != null ? Number(r.avg_drive_min) : null,
    avgTotalMin:          r.avg_total_min != null ? Number(r.avg_total_min) : null,
  }));

  // 7-day trend: group by day (Berlin = UTC+1/+2, approximate with UTC+1)
  const dayMap = new Map<string, { total: number; onTime: number; count: number }>();
  for (const r of trendRows ?? []) {
    const d = (r.placed_at as string).slice(0, 10);
    const cur = dayMap.get(d) ?? { total: 0, onTime: 0, count: 0 };
    cur.count++;
    if (r.total_min != null) cur.total += Number(r.total_min);
    if (r.on_time === true) cur.onTime++;
    dayMap.set(d, cur);
  }

  const trend7d: LifecycleTrendDay[] = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([day, v]) => ({
      dayStr:     day,
      orderCount: v.count,
      avgTotalMin: v.count > 0 ? Math.round((v.total / v.count) * 10) / 10 : null,
      onTimePct:   v.count > 0 ? Math.round((v.onTime / v.count) * 1000) / 10 : null,
    }));

  return {
    summary,
    stages,
    byHour,
    trend7d,
    lastSnappedAt: (lastSnap?.snapped_at as string | null) ?? null,
  };
}

// ─── Prune ────────────────────────────────────────────────────────────────────

export async function pruneOldLifecycleSnapshots(daysToKeep = 60): Promise<number> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc('prune_old_order_lifecycle_snapshots', {
    days_to_keep: daysToKeep,
  });
  if (error) return 0;
  return (data as number) ?? 0;
}
