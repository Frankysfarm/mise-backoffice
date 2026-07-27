import 'server-only';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DriverV2Envelope } from './driver-v2-contract';
import { loadDriverV2Snapshot } from './driver-v2-server';

export async function executeAtomicPickup(
  client: SupabaseClient, driverId: string, envelope: DriverV2Envelope,
  correlationId: string = randomUUID(),
) {
  const before = await loadDriverV2Snapshot(client, driverId, correlationId);
  if (envelope.action !== 'atomic_pickup') {
    return { ok: false, reason_code: 'ATOMIC_PICKUP_ACTION_REQUIRED', correlation_id: correlationId, snapshot: before };
  }
  if (!before.trip || before.driver.version !== envelope.expected_versions.driver
    || before.trip.version !== envelope.expected_versions.trip
    || before.trip.route_version !== envelope.expected_versions.route) {
    return { ok: false, reason_code: 'EXPECTED_VERSION_CONFLICT', correlation_id: correlationId, snapshot: before };
  }
  const tenantId = before.assignments[0]?.tenant_id;
  if (!tenantId || before.assignments.some((row) => row.tenant_id !== tenantId)) {
    return { ok: false, reason_code: 'TENANT_OR_ACTOR_AUTHORITY_MISMATCH', correlation_id: correlationId, snapshot: before };
  }
  const result = await client.rpc('fn_driver_pickup_batch_v2', {
    p_tenant_id: tenantId, p_batch_id: before.trip.id,
    p_expected_batch_version: envelope.expected_versions.trip,
    p_expected_route_version: envelope.expected_versions.route,
    p_expected_driver_version: envelope.expected_versions.driver,
    p_actor_driver_id: driverId, p_action_id: envelope.action_id,
    p_manifest: envelope.payload?.manifest ?? [], p_correlation_id: correlationId,
  });
  if (result.error) throw new Error(`ATOMIC_PICKUP_RPC: ${result.error.message}`);
  return { ...(result.data as Record<string, unknown>), correlation_id: correlationId,
    snapshot: await loadDriverV2Snapshot(client, driverId, correlationId) };
}
