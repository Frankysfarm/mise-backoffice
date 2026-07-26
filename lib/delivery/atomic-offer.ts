import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export const ATOMIC_OFFER_ALGORITHM_VERSION = 'atomic-single-order-v1';
export const ATOMIC_ASSIGNMENT_ALGORITHM_VERSION = 'atomic-v2-canonical';
export type DispatchWriter =
  | 'legacy_db'
  | 'frank_db'
  | 'frank_js'
  | 'atomic_v1'
  | 'atomic_v2';

export interface AtomicOfferInput {
  tenantId: string;
  orderId: string;
  driverId: string;
  expectedOrderVersion: number;
  decisionId: string;
  idempotencyKey: string;
  offerTtlSeconds: number;
  pickup: { lat: number; lng: number; address: string };
  dropoff: { lat: number; lng: number; address: string };
  push: { title: string; body: string };
}

export interface AtomicOfferResult {
  ok: boolean;
  reason_code?: string;
  idempotent_replay?: boolean;
  assignment_id?: string;
  offer_id?: string;
  assignment_version?: number;
  batch_id?: string;
  state?: string;
  lease_expires_at?: string;
  order_version?: number;
  current_order_version?: number;
  assignment_ids?: string[];
  order_ids?: string[];
  driver_version?: number;
  correlation_id?: string;
}

export function atomicOfferEnabled(): boolean {
  return process.env.P0_ATOMIC_OFFER_ENABLED === 'true';
}

export function atomicAssignmentV2Enabled(): boolean {
  return process.env.T02_ATOMIC_V2_ENABLED === 'true';
}

/**
 * Returns null for the compatibility/default-off state. Callers must preserve
 * their historic behaviour for null; an explicit writer row is authoritative.
 */
export async function selectedDispatchWriter(
  client: SupabaseClient,
  tenantId: string,
): Promise<DispatchWriter | null> {
  let response = await client.rpc('fn_dispatch_writer_for_tenant_v2', {
    p_tenant_id: tenantId,
  });
  if (
    response.error &&
    (response.error.code === 'PGRST202' ||
      response.error.message?.includes('fn_dispatch_writer_for_tenant_v2'))
  ) {
    response = await client.rpc('fn_dispatch_writer_for_tenant_v1', {
      p_tenant_id: tenantId,
    });
  }
  const { data, error } = response;
  if (error) {
    // Before either additive migration exists, default-off remains compatible.
    if (
      error.code === 'PGRST202' ||
      error.message?.includes('fn_dispatch_writer_for_tenant_v1')
    ) return null;
    throw new Error(`DISPATCH_WRITER_GATE_READ_FAILED:${error.code ?? 'unknown'}`);
  }
  if (data == null) return null;
  if (
    data !== 'legacy_db' &&
    data !== 'frank_db' &&
    data !== 'frank_js' &&
    data !== 'atomic_v1' &&
    data !== 'atomic_v2'
  ) {
    throw new Error('DISPATCH_WRITER_GATE_INVALID');
  }
  return data;
}

export interface AtomicWriterLease {
  ok: boolean;
  reason_code?: string;
  writer_id?: string;
  writer_epoch?: number;
  lease_expires_at?: string;
}

export async function claimAtomicWriterV2(
  client: SupabaseClient,
  tenantId: string,
  writerId: string,
): Promise<AtomicWriterLease> {
  if (!atomicAssignmentV2Enabled()) {
    return { ok: false, reason_code: 'FEATURE_DISABLED' };
  }
  const { data, error } = await client.rpc('fn_dispatch_claim_writer_v2', {
    p_tenant_id: tenantId,
    p_writer_id: writerId,
    p_lease_seconds: 30,
  });
  if (error) {
    throw new Error(`fn_dispatch_claim_writer_v2 failed: ${error.message}`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('fn_dispatch_claim_writer_v2 returned an invalid contract');
  }
  return data as AtomicWriterLease;
}

export interface AtomicAssignmentV2Input {
  tenantId: string;
  writerId: string;
  writerEpoch: number;
  driverId: string;
  expectedDriverVersion: number;
  actionId: string;
  orders: Array<{
    orderId: string;
    expectedOrderVersion: number;
    pickup: { lat: number; lng: number; address: string };
    dropoff: { lat: number; lng: number; address: string };
    pickupDeadlineAt: string;
    deliveryDeadlineAt: string;
  }>;
  push: { title: string; body: string };
}

export async function createAtomicAssignmentV2(
  client: SupabaseClient,
  input: AtomicAssignmentV2Input,
): Promise<AtomicOfferResult> {
  if (!atomicAssignmentV2Enabled()) {
    return { ok: false, reason_code: 'FEATURE_DISABLED' };
  }
  const { data, error } = await client.rpc('fn_dispatch_assign_orders_v2', {
    p_tenant_id: input.tenantId,
    p_writer_id: input.writerId,
    p_writer_epoch: input.writerEpoch,
    p_driver_id: input.driverId,
    p_expected_driver_version: input.expectedDriverVersion,
    p_action_id: input.actionId,
    p_algorithm_version: ATOMIC_ASSIGNMENT_ALGORITHM_VERSION,
    p_orders: input.orders.map((order) => ({
      order_id: order.orderId,
      expected_order_version: order.expectedOrderVersion,
      pickup_lat: order.pickup.lat,
      pickup_lng: order.pickup.lng,
      pickup_address: order.pickup.address,
      dropoff_lat: order.dropoff.lat,
      dropoff_lng: order.dropoff.lng,
      dropoff_address: order.dropoff.address,
      pickup_deadline_at: order.pickupDeadlineAt,
      delivery_deadline_at: order.deliveryDeadlineAt,
    })),
    p_push_title: input.push.title,
    p_push_body: input.push.body,
  });
  if (error) {
    throw new Error(`fn_dispatch_assign_orders_v2 failed: ${error.message}`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('fn_dispatch_assign_orders_v2 returned an invalid contract');
  }
  return data as AtomicOfferResult;
}

/**
 * Feature-flagged integration contract only.
 * Callers must keep the existing path while the flag is false.
 */
export async function createAtomicSingleOrderOffer(
  client: SupabaseClient,
  input: AtomicOfferInput,
): Promise<AtomicOfferResult> {
  if (!atomicOfferEnabled()) {
    return { ok: false, reason_code: 'FEATURE_DISABLED' };
  }

  const { data, error } = await client.rpc('fn_dispatch_create_offer_v1', {
    p_tenant_id: input.tenantId,
    p_order_id: input.orderId,
    p_driver_id: input.driverId,
    p_expected_order_version: input.expectedOrderVersion,
    p_decision_id: input.decisionId,
    p_idempotency_key: input.idempotencyKey,
    p_algorithm_version: ATOMIC_OFFER_ALGORITHM_VERSION,
    p_offer_ttl_seconds: input.offerTtlSeconds,
    p_pickup_lat: input.pickup.lat,
    p_pickup_lng: input.pickup.lng,
    p_pickup_address: input.pickup.address,
    p_dropoff_lat: input.dropoff.lat,
    p_dropoff_lng: input.dropoff.lng,
    p_dropoff_address: input.dropoff.address,
    p_push_title: input.push.title,
    p_push_body: input.push.body,
  });

  if (error) {
    throw new Error(`fn_dispatch_create_offer_v1 failed: ${error.message}`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('fn_dispatch_create_offer_v1 returned an invalid contract');
  }
  return data as AtomicOfferResult;
}

export type AtomicOfferAction =
  | 'accept'
  | 'decline'
  | 'expire'
  | 'picked_up'
  | 'in_progress'
  | 'complete'
  | 'cancel';

export async function transitionAtomicOffer(
  client: SupabaseClient,
  input: {
    tenantId: string;
    offerId: string;
    expectedAssignmentVersion: number;
    action: AtomicOfferAction;
    transitionKey: string;
    actorDriverId?: string;
  },
): Promise<AtomicOfferResult> {
  if (!atomicOfferEnabled()) {
    return { ok: false, reason_code: 'FEATURE_DISABLED' };
  }

  const { data, error } = await client.rpc('fn_dispatch_transition_offer_v1', {
    p_tenant_id: input.tenantId,
    p_offer_id: input.offerId,
    p_expected_assignment_version: input.expectedAssignmentVersion,
    p_action: input.action,
    p_transition_key: input.transitionKey,
    p_actor_driver_id: input.actorDriverId ?? null,
  });
  if (error) {
    throw new Error(`fn_dispatch_transition_offer_v1 failed: ${error.message}`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('fn_dispatch_transition_offer_v1 returned an invalid contract');
  }
  return data as AtomicOfferResult;
}

export async function expireAtomicOffers(
  client: SupabaseClient,
  limit = 100,
): Promise<number> {
  if (!atomicOfferEnabled()) return 0;
  const { data, error } = await client.rpc('fn_dispatch_expire_offers_v1', {
    p_limit: limit,
  });
  if (error) {
    throw new Error(`fn_dispatch_expire_offers_v1 failed: ${error.message}`);
  }
  return Number(data ?? 0);
}
