import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DriverV2Envelope } from './driver-v2-contract';
import { loadDriverV2Snapshot } from './driver-v2-server';
import { directions } from '@/lib/google-maps';

function stageActionId(actionId: string, stage: 'route' | 'depart') {
  const hex = createHash('sha256').update(`${actionId}:${stage}`).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

async function googleDeparturePlan(client: SupabaseClient, driverId: string,
  stops: Array<{ id: string; lat: number; lng: number }>) {
  const { data: driver, error } = await client.from('mise_drivers')
    .select('last_lat,last_lng,vehicle_type').eq('id', driverId).single();
  if (error || !driver || !Number.isFinite(Number(driver.last_lat))
    || !Number.isFinite(Number(driver.last_lng))) throw new Error('CURRENT_DRIVER_GPS_REQUIRED');
  if (stops.length === 0 || stops.some((stop) => !Number.isFinite(stop.lat) || !Number.isFinite(stop.lng))) {
    throw new Error('ROUTABLE_DROPOFF_SET_REQUIRED');
  }
  const origin = { lat: Number(driver.last_lat), lng: Number(driver.last_lng) };
  const candidates = await Promise.all(stops.map(async (destination) => {
    const intermediates = stops.filter((stop) => stop.id !== destination.id);
    const route = await directions({
      origin, destination, waypoints: intermediates, optimize: intermediates.length > 1,
      mode: driver.vehicle_type === 'bike' ? 'bicycling' : 'driving', departure_time: 'now',
    });
    const ordered = route.optimized_order.map((index) => intermediates[index]?.id)
      .filter((id): id is string => Boolean(id));
    return { route, stopIds: [...ordered, destination.id] };
  }));
  candidates.sort((a, b) => a.route.total_duration_s - b.route.total_duration_s
    || a.route.total_distance_m - b.route.total_distance_m
    || a.stopIds.join(',').localeCompare(b.stopIds.join(',')));
  const winner = candidates[0];
  return {
    provider: 'google', fallback_used: false, polyline: winner.route.polyline,
    distance_m: winner.route.total_distance_m, duration_s: winner.route.total_duration_s,
    stops: winner.stopIds,
  };
}

export async function executeAtomicPickup(
  client: SupabaseClient, driverId: string, envelope: DriverV2Envelope,
  correlationId: string = randomUUID(),
) {
  const before = await loadDriverV2Snapshot(client, driverId, correlationId);
  if (envelope.action !== 'atomic_pickup') {
    return { ok: false, reason_code: 'ATOMIC_PICKUP_ACTION_REQUIRED', correlation_id: correlationId, snapshot: before };
  }
  if (!before.trip) {
    return { ok: false, reason_code: 'EXPECTED_VERSION_CONFLICT', correlation_id: correlationId, snapshot: before };
  }
  const tenantId = before.assignments[0]?.tenant_id;
  if (!tenantId || before.assignments.some((row) => row.tenant_id !== tenantId)) {
    return { ok: false, reason_code: 'TENANT_OR_ACTOR_AUTHORITY_MISMATCH', correlation_id: correlationId, snapshot: before };
  }
  const result = await client.rpc('fn_driver_pickup_ready_v2', {
    p_tenant_id: tenantId, p_batch_id: before.trip.id,
    p_expected_batch_version: envelope.expected_versions.trip,
    p_expected_route_version: envelope.expected_versions.route,
    p_expected_driver_version: envelope.expected_versions.driver,
    p_actor_driver_id: driverId, p_action_id: envelope.action_id,
    p_manifest: envelope.payload?.manifest ?? [], p_correlation_id: correlationId,
  });
  if (result.error) throw new Error(`ATOMIC_PICKUP_RPC: ${result.error.message}`);
  const pickupResult = result.data as Record<string, unknown>;
  if (!pickupResult.ok) {
    return { ...pickupResult, correlation_id: correlationId,
      snapshot: await loadDriverV2Snapshot(client, driverId, correlationId) };
  }

  const { data: existingWorkflow, error: workflowError } = await client
    .from('driver_departure_workflows_v2').select('state,workflow_version,route_version,route_plan')
    .eq('batch_id', before.trip.id).single();
  if (workflowError || !existingWorkflow) throw new Error('ROUTE_WORKFLOW_LOOKUP_FAILED');
  if (existingWorkflow.state === 'departed') {
    return { ok: true, state: 'departed', idempotent_replay: true, correlation_id: correlationId,
      snapshot: await loadDriverV2Snapshot(client, driverId, correlationId) };
  }

  let workflowVersion = Number(existingWorkflow.workflow_version);
  if (existingWorkflow.state === 'route_pending') {
    const afterPickup = await loadDriverV2Snapshot(client, driverId, correlationId);
    const dropoffs = afterPickup.stops.filter((stop) => stop.type === 'dropoff'
      && !['completed', 'cancelled'].includes(stop.state))
      .map((stop) => ({ id: stop.id, lat: Number(stop.lat), lng: Number(stop.lng) }));
    let plan: Awaited<ReturnType<typeof googleDeparturePlan>>;
    try {
      plan = await googleDeparturePlan(client, driverId, dropoffs);
    } catch (error) {
      return { ok: false, reason_code: error instanceof Error ? error.message : 'GOOGLE_ROUTE_REQUIRED',
        state: 'route_pending', pickup_committed: true, correlation_id: correlationId, snapshot: afterPickup };
    }
    const persisted = await client.rpc('fn_persist_google_departure_route_v2', {
      p_tenant_id: tenantId, p_batch_id: before.trip.id, p_driver_id: driverId,
      p_expected_workflow_version: workflowVersion,
      p_expected_route_version: Number(existingWorkflow.route_version), p_plan: plan,
      p_action_id: stageActionId(envelope.action_id, 'route'), p_correlation_id: correlationId,
    });
    if (persisted.error) throw new Error(`GOOGLE_ROUTE_PERSIST_RPC: ${persisted.error.message}`);
    const persistedResult = persisted.data as Record<string, unknown>;
    if (!persistedResult.ok) return { ...persistedResult, pickup_committed: true,
      correlation_id: correlationId, snapshot: await loadDriverV2Snapshot(client, driverId, correlationId) };
    workflowVersion = Number(persistedResult.workflow_version);
  }

  const departed = await client.rpc('fn_driver_depart_routed_v2', {
    p_tenant_id: tenantId, p_batch_id: before.trip.id,
    p_expected_batch_version: Number(pickupResult.batch_version),
    p_expected_driver_version: Number(pickupResult.driver_version),
    p_expected_workflow_version: workflowVersion,
    p_expected_route_version: Number(existingWorkflow.route_version),
    p_actor_driver_id: driverId, p_action_id: stageActionId(envelope.action_id, 'depart'),
    p_correlation_id: correlationId,
  });
  if (departed.error) throw new Error(`ROUTED_DEPART_RPC: ${departed.error.message}`);
  return { ...(departed.data as Record<string, unknown>), pickup_committed: true,
    route_recalculated: true, correlation_id: correlationId,
    snapshot: await loadDriverV2Snapshot(client, driverId, correlationId) };
}
