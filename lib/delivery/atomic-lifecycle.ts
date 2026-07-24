import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  atomicOfferEnabled,
  transitionAtomicOffer,
  type AtomicOfferAction,
  type AtomicOfferResult,
} from './atomic-offer';
import {
  atomicTransitionRejectionStatus,
  decideTenantAtomicHandling,
  validateAtomicTransitionInput,
  type AtomicTransitionRequest,
} from './atomic-lifecycle-contract';

export type AtomicTransitionOutcome =
  | { handled: false }
  | { handled: true; status: number; result: AtomicOfferResult };

/**
 * Executes an exact offer/version CAS only while both the environment feature
 * flag and the offer tenant's atomic single-writer gate are open.
 *
 * When the environment flag is off this returns handled:false so callers keep
 * their existing legacy behavior unchanged.
 */
export async function executeAtomicDriverTransition(
  client: SupabaseClient,
  driverId: string,
  body: AtomicTransitionRequest,
  action: AtomicOfferAction,
  target: { batchId?: string; orderId?: string } = {},
): Promise<AtomicTransitionOutcome> {
  if (!atomicOfferEnabled()) return { handled: false };

  /*
   * Resolve the driver's target before looking at offer_id. This prevents the
   * global environment flag from forcing atomic payloads on legacy tenants and
   * avoids using user-provided offer IDs for cross-tenant election.
   */
  let batchQuery = client
    .from('mise_delivery_batches')
    .select('id,driver_id')
    .eq('driver_id', driverId);
  if (target.batchId) {
    batchQuery = batchQuery.eq('id', target.batchId);
  } else if (target.orderId) {
    const { data: stop, error: stopError } = await client
      .from('mise_delivery_batch_stops')
      .select('batch_id')
      .eq('order_id', target.orderId)
      .maybeSingle();
    if (stopError) throw new Error(`ATOMIC_TARGET_STOP_LOOKUP_FAILED: ${stopError.message}`);
    if (!stop?.batch_id) return { handled: false };
    batchQuery = batchQuery.eq('id', stop.batch_id);
  } else {
    batchQuery = batchQuery
      .not('state', 'in', '("completed","cancelled")')
      .order('created_at', { ascending: false })
      .limit(1);
  }
  const { data: targetBatch, error: batchError } = await batchQuery.maybeSingle();
  if (batchError) throw new Error(`ATOMIC_TARGET_BATCH_LOOKUP_FAILED: ${batchError.message}`);
  if (!targetBatch) return { handled: false };

  const { data: targetStop, error: targetStopError } = await client
    .from('mise_delivery_batch_stops')
    .select('order_id')
    .eq('batch_id', targetBatch.id)
    .order('sequence', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (targetStopError) throw new Error(`ATOMIC_TARGET_ORDER_LOOKUP_FAILED: ${targetStopError.message}`);
  if (!targetStop?.order_id) return { handled: false };

  const { data: targetOrder, error: targetOrderError } = await client
    .from('customer_orders')
    .select('location_id')
    .eq('id', targetStop.order_id)
    .maybeSingle();
  if (targetOrderError) throw new Error(`ATOMIC_TARGET_ORDER_LOOKUP_FAILED: ${targetOrderError.message}`);
  if (!targetOrder?.location_id) return { handled: false };
  const { data: targetLocation, error: targetLocationError } = await client
    .from('locations')
    .select('tenant_id')
    .eq('id', targetOrder.location_id)
    .maybeSingle();
  if (targetLocationError) throw new Error(`ATOMIC_TARGET_TENANT_LOOKUP_FAILED: ${targetLocationError.message}`);
  if (!targetLocation?.tenant_id) return { handled: false };
  const { data: gate, error: gateError } = await client
    .from('dispatch_writer_gates')
    .select('enabled')
    .eq('tenant_id', targetLocation.tenant_id)
    .eq('writer', 'atomic_v1')
    .maybeSingle();
  if (gateError) throw new Error(`ATOMIC_GATE_LOOKUP_FAILED: ${gateError.message}`);

  const election = decideTenantAtomicHandling(Boolean(gate?.enabled), body);
  if (election === 'legacy_fallback') return { handled: false };
  if (election === 'atomic_input_required') {
    return {
      handled: true,
      status: 400,
      result: { ok: false, reason_code: 'ATOMIC_TRANSITION_INPUT_REQUIRED' },
    };
  }
  const input = validateAtomicTransitionInput(body)!;

  const { data: offer, error: offerError } = await client
    .from('dispatch_offer_assignments')
    .select('order_id,driver_id,batch_id')
    .eq('id', input.offerId)
    .maybeSingle();
  if (offerError) throw new Error(`ATOMIC_OFFER_LOOKUP_FAILED: ${offerError.message}`);
  if (!offer) {
    return { handled: true, status: 404, result: { ok: false, reason_code: 'OFFER_NOT_FOUND' } };
  }
  if (offer.driver_id !== driverId) {
    return {
      handled: true,
      status: 403,
      result: { ok: false, reason_code: 'ACTOR_DRIVER_MISMATCH' },
    };
  }
  if (offer.batch_id !== targetBatch.id) {
    return {
      handled: true,
      status: 403,
      result: { ok: false, reason_code: 'OFFER_TARGET_MISMATCH' },
    };
  }

  const { data: order, error: orderError } = await client
    .from('customer_orders')
    .select('location_id')
    .eq('id', offer.order_id)
    .maybeSingle();
  if (orderError) throw new Error(`ATOMIC_ORDER_LOOKUP_FAILED: ${orderError.message}`);
  if (!order?.location_id) {
    return {
      handled: true,
      status: 409,
      result: { ok: false, reason_code: 'ORDER_LOCATION_MISSING' },
    };
  }
  const { data: location, error: locationError } = await client
    .from('locations')
    .select('tenant_id')
    .eq('id', order.location_id)
    .maybeSingle();
  if (locationError) throw new Error(`ATOMIC_TENANT_LOOKUP_FAILED: ${locationError.message}`);
  if (!location?.tenant_id) {
    return {
      handled: true,
      status: 409,
      result: { ok: false, reason_code: 'TENANT_MISSING' },
    };
  }

  if (location.tenant_id !== targetLocation.tenant_id) {
    return {
      handled: true,
      status: 403,
      result: { ok: false, reason_code: 'TENANT_OFFER_MISMATCH' },
    };
  }

  const result = await transitionAtomicOffer(client, {
    tenantId: location.tenant_id,
    offerId: input.offerId,
    expectedAssignmentVersion: input.assignmentVersion,
    action,
    transitionKey: input.transitionKey,
    actorDriverId: driverId,
  });
  return {
    handled: true,
    status: result.ok ? 200 : atomicTransitionRejectionStatus(result.reason_code),
    result,
  };
}
