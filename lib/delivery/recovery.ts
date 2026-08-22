/**
 * lib/delivery/recovery.ts
 *
 * Autonomous Recovery Engine — Phase 21
 *
 * When a mise_delivery_batch is cancelled (driver drops off, connection lost, manual cancel),
 * this engine:
 *  1. Loads all undelivered stops in the cancelled batch
 *  2. Liberates those orders (clears mise_batch_id / mise_driver_id)
 *  3. Boosts their priority so they get dispatched next tick
 *  4. Optionally triggers an immediate dispatch cycle for those orders
 *  5. Records a recovery_event for audit trail + admin visibility
 *
 * Integration points:
 *  - Called from PATCH /api/delivery/tours/[id]/status when state → 'cancelled'
 *  - Manual trigger via POST /api/delivery/admin/recovery
 *  - Cron: evaluates batches stuck in 'on_route' / 'at_restaurant' for >60 min
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { dispatchSingleOrder } from './dispatch-engine';
import { logDeliveryEvent } from './events';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export interface RecoveryEvent {
  id: string;
  location_id: string;
  cancelled_batch_id: string;
  driver_id: string | null;
  reason: string | null;
  orders_recovered: number;
  orders_requeued: number;
  recovery_batch_ids: string[];
  started_at: string;
  completed_at: string | null;
  duration_sec: number | null;
  error: string | null;
  driver_name?: string | null;
  driver_vehicle?: string | null;
}

export interface RecoveryResult {
  event_id: string;
  cancelled_batch_id: string;
  orders_recovered: number;
  orders_requeued: number;
  new_batch_ids: string[];
  error: string | null;
}

// Order row shape needed for re-dispatch
interface OrderRow {
  id: string;
  location_id: string;
  kunde_lat: number | null;
  kunde_lng: number | null;
  kunde_adresse: string | null;
  kunde_plz: string | null;
  kunde_stadt: string | null;
  bestellnummer: string;
  priority: string | null;
  estimated_prep_min: number | null;
  created_at: string;
  dispatch_attempts: number;
  dispatch_escalated_at: string | null;
  schedule_status: 'scheduled' | 'released' | 'immediate' | null;
}

// ----------------------------------------------------------------
// recoverCancelledBatch
// ----------------------------------------------------------------

/**
 * Core recovery function — call this whenever a batch is cancelled.
 *
 * @param batchId     - The cancelled mise_delivery_batch.id
 * @param reason      - Human-readable reason ('driver_cancelled' | 'driver_offline' | 'manual' | ...)
 * @param triggerRedispatch - If true, immediately attempt re-dispatch (synchronous). Default: true.
 */
export async function recoverCancelledBatch(
  batchId: string,
  reason = 'manual',
  triggerRedispatch = true,
): Promise<RecoveryResult> {
  const sb = createServiceClient();
  const startedAt = new Date().toISOString();

  // 1. Load batch details
  const { data: batch } = await sb
    .from('mise_delivery_batches')
    .select('id, driver_id, location_id, state')
    .eq('id', batchId)
    .maybeSingle();

  if (!batch) {
    return {
      event_id: '',
      cancelled_batch_id: batchId,
      orders_recovered: 0,
      orders_requeued: 0,
      new_batch_ids: [],
      error: 'Batch nicht gefunden',
    };
  }

  const locationId = batch.location_id as string;
  const driverId = batch.driver_id as string | null;

  // 2. Find all undelivered dropoff stops
  const { data: stops } = await sb
    .from('mise_delivery_batch_stops')
    .select('id, order_id, completed_at')
    .eq('batch_id', batchId)
    .eq('type', 'dropoff')
    .is('completed_at', null);

  const undeliveredOrderIds = (stops ?? [])
    .map((s) => s.order_id as string | null)
    .filter((id): id is string => id != null);

  const ordersRecovered = undeliveredOrderIds.length;

  if (ordersRecovered === 0) {
    // All stops already delivered — nothing to recover
    const { data: eventRow } = await sb
      .from('delivery_recovery_events')
      .insert({
        location_id: locationId,
        cancelled_batch_id: batchId,
        driver_id: driverId,
        reason,
        orders_recovered: 0,
        orders_requeued: 0,
        recovery_batch_ids: [],
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    return {
      event_id: (eventRow as { id: string } | null)?.id ?? '',
      cancelled_batch_id: batchId,
      orders_recovered: 0,
      orders_requeued: 0,
      new_batch_ids: [],
      error: null,
    };
  }

  // 3. Liberate orders — clear batch assignment, boost priority, reset dispatch counter
  await sb
    .from('customer_orders')
    .update({
      mise_batch_id: null,
      mise_driver_id: null,
      priority: 'high',
      dispatch_attempts: 0,
      dispatch_escalated_at: null,
      last_recovery_at: new Date().toISOString(),
    })
    .in('id', undeliveredOrderIds);

  // 4. Log recovery event
  logDeliveryEvent({
    event_type: 'order_held',
    location_id: locationId,
    payload: {
      type: 'batch_cancelled_recovery',
      cancelled_batch_id: batchId,
      driver_id: driverId,
      reason,
      orders_affected: undeliveredOrderIds,
    },
  }).catch(() => {});

  // 5. Create recovery record (open — will be updated after re-dispatch)
  const { data: eventRow } = await sb
    .from('delivery_recovery_events')
    .insert({
      location_id: locationId,
      cancelled_batch_id: batchId,
      driver_id: driverId,
      reason,
      orders_recovered: ordersRecovered,
      orders_requeued: 0,
      recovery_batch_ids: [],
      started_at: startedAt,
    })
    .select('id')
    .single();

  const eventId = (eventRow as { id: string } | null)?.id ?? '';

  // 6. Immediate re-dispatch (synchronous, best-effort)
  const newBatchIds: string[] = [];
  let requeued = 0;

  if (triggerRedispatch && undeliveredOrderIds.length > 0) {
    // Load the full order rows for dispatch
    const { data: orderRows } = await sb
      .from('customer_orders')
      .select('id, location_id, kunde_lat, kunde_lng, kunde_adresse, kunde_plz, kunde_stadt, bestellnummer, priority, estimated_prep_min, created_at, dispatch_attempts, dispatch_escalated_at, schedule_status')
      .in('id', undeliveredOrderIds);

    for (const row of orderRows ?? []) {
      try {
        const result = await dispatchSingleOrder(row as OrderRow);
        if (result.outcome !== 'held' && result.batchId) {
          newBatchIds.push(result.batchId);
          requeued++;
        }
      } catch {
        // Don't block other orders if one fails
      }
    }
  }

  // 7. Finalize recovery record
  if (eventId) {
    await sb
      .from('delivery_recovery_events')
      .update({
        orders_requeued: requeued,
        recovery_batch_ids: [...new Set(newBatchIds)],
        completed_at: new Date().toISOString(),
      })
      .eq('id', eventId);
  }

  return {
    event_id: eventId,
    cancelled_batch_id: batchId,
    orders_recovered: ordersRecovered,
    orders_requeued: requeued,
    new_batch_ids: [...new Set(newBatchIds)],
    error: null,
  };
}

// ----------------------------------------------------------------
// getRecoveryEvents
// ----------------------------------------------------------------

/**
 * Load recovery event history for a location.
 */
export async function getRecoveryEvents(
  locationId: string,
  limit = 20,
): Promise<RecoveryEvent[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('v_recovery_summary')
    .select('*')
    .eq('location_id', locationId)
    .order('started_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as RecoveryEvent[];
}

// ----------------------------------------------------------------
// scanStaleBatches
// ----------------------------------------------------------------

/**
 * Detects batches stuck in 'on_route' or 'at_restaurant' for more than
 * `staleMinutes` minutes with no GPS ping — likely orphaned by a crashed driver.
 * Returns a list of batch IDs that were auto-recovered.
 */
export async function scanStaleBatches(staleMinutes = 60): Promise<{
  scanned: number;
  recovered: string[];
}> {
  const sb = createServiceClient();
  const threshold = new Date(Date.now() - staleMinutes * 60_000).toISOString();

  const { data: staleBatches } = await sb
    .from('mise_delivery_batches')
    .select('id, location_id, driver_id, state, updated_at')
    .in('state', ['on_route', 'at_restaurant', 'assigned'])
    .lt('updated_at', threshold)
    .limit(10);

  const recovered: string[] = [];

  for (const batch of staleBatches ?? []) {
    try {
      // Check if driver has a recent GPS ping
      const { data: driver } = await sb
        .from('mise_drivers')
        .select('last_position_at')
        .eq('id', batch.driver_id as string)
        .maybeSingle();

      const lastPing = driver?.last_position_at as string | null;
      const pingAge = lastPing
        ? Date.now() - new Date(lastPing).getTime()
        : Infinity;

      // If no GPS for >staleMinutes, consider orphaned
      if (pingAge > staleMinutes * 60_000) {
        // Cancel the batch
        await sb
          .from('mise_delivery_batches')
          .update({ state: 'cancelled' })
          .eq('id', batch.id as string);

        // Recover orders
        const result = await recoverCancelledBatch(
          batch.id as string,
          'driver_offline_stale',
          true,
        );

        if (!result.error) recovered.push(batch.id as string);

        logDeliveryEvent({
          event_type: 'batch_cancelled',
          location_id: batch.location_id as string,
          payload: {
            batch_id: batch.id,
            reason: 'stale_no_gps',
            stale_minutes: Math.round(pingAge / 60_000),
            orders_recovered: result.orders_recovered,
          },
        }).catch(() => {});
      }
    } catch {
      // Don't let one failed batch block the rest
    }
  }

  return { scanned: staleBatches?.length ?? 0, recovered };
}
