import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DRIVER_EXCEPTION_KINDS, DRIVER_V2_API_VERSION, type DriverV2Action,
  type DriverV2Envelope, type DriverV2Snapshot, validateDriverV2ActionEnvelope,
} from './driver-v2-contract';

type DbResult<T> = { data: T | null; error: { message: string } | null };
function checked<T>(result: DbResult<T>, label: string): T | null {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

export async function loadDriverV2Snapshot(
  client: SupabaseClient,
  driverId: string,
  correlationId: string = randomUUID(),
): Promise<DriverV2Snapshot> {
  const driver = checked(await client.from('mise_drivers')
    .select('id,state,state_version,active').eq('id', driverId).maybeSingle(), 'DRIVER_SNAPSHOT') as any;
  if (!driver) throw new Error('DRIVER_NOT_FOUND');
  const assignment = checked(await client.from('dispatch_offer_assignments')
    .select('id,tenant_id,state,assignment_version,batch_id,order_id,received_by_app_at')
    .eq('driver_id', driverId).in('state', ['assigned', 'picked_up', 'in_progress'])
    .order('updated_at', { ascending: false }).limit(1).maybeSingle(), 'ASSIGNMENT_SNAPSHOT') as any;
  let trip: any = null;
  let stops: any[] = [];
  let orders: any[] = [];
  let items: any[] = [];
  let assignments: any[] = [];
  if (assignment) {
    trip = checked(await client.from('mise_delivery_batches')
      .select('id,state,state_version,route_version').eq('id', assignment.batch_id).maybeSingle(), 'TRIP_SNAPSHOT');
    stops = (checked(await client.from('mise_delivery_batch_stops')
      .select('id,order_id,type,state,stop_version,sequence,address,lat,lng,arrived_at,completed_at').eq('batch_id', assignment.batch_id)
      .order('sequence'), 'STOP_SNAPSHOT') as any[]) ?? [];
    const ids = [...new Set(stops.map((s) => s.order_id))];
    assignments = (checked(await client.from('dispatch_offer_assignments')
      .select('id,order_id,tenant_id,state,assignment_version').eq('batch_id', assignment.batch_id),
      'ASSIGNMENTS_SNAPSHOT') as any[]) ?? [];
    if (ids.length) orders = (checked(await client.from('customer_orders')
      .select('id,status,dispatch_version,bestellnummer,kunde_name,kunde_adresse,kunde_plz,kunde_lat,kunde_lng,gesamtbetrag').in('id', ids), 'ORDER_SNAPSHOT') as any[]) ?? [];
    if (ids.length) items = (checked(await client.from('order_items')
      .select('id,order_id,name,menge').in('order_id', ids), 'ITEM_SNAPSHOT') as any[]) ?? [];
    if (ids.length) {
      const outcomes = (checked(await client.from('driver_item_outcomes_v2')
        .select('item_id,outcome,evidence').in('order_id', ids), 'ITEM_OUTCOME_SNAPSHOT') as any[]) ?? [];
      const outcomeByItem = new Map(outcomes.map((row) => [row.item_id, row]));
      items = items.map((row) => ({ ...row, outcome: outcomeByItem.get(row.id)?.outcome ?? null,
        evidence: outcomeByItem.get(row.id)?.evidence ?? {} }));
    }
  }
  const exception = checked(await client.from('driver_exceptions_v2')
    .select('id,kind,state,exception_version').eq('driver_id', driverId)
    .not('state', 'in', '("resolved","closed")').order('created_at', { ascending: false })
    .limit(1).maybeSingle(), 'EXCEPTION_SNAPSHOT') as any;
  const projection = JSON.stringify({
    d: [driver.state, driver.state_version], a: assignment && [assignment.id, assignment.state, assignment.assignment_version],
    t: trip && [trip.id, trip.state, trip.state_version, trip.route_version],
    o: orders.map((o) => [o.id, o.status, o.dispatch_version]).sort(),
    s: stops.map((s) => [s.id, s.state, s.stop_version]).sort(),
    e: exception && [exception.id, exception.state, exception.exception_version],
  });
  return {
    api_version: DRIVER_V2_API_VERSION,
    correlation_id: correlationId,
    snapshot_version: createHash('sha256').update(projection).digest('hex').slice(0, 24),
    generated_at: new Date().toISOString(),
    driver: { id: driver.id, state: driver.state, version: driver.state_version, active: driver.active },
    assignment: assignment ? { id: assignment.id, tenant_id: assignment.tenant_id, state: assignment.state, version: assignment.assignment_version, received_by_app_at: assignment.received_by_app_at } : null,
    assignments: assignments.map((row) => ({ id: row.id, order_id: row.order_id,
      tenant_id: row.tenant_id, state: row.state, version: row.assignment_version })),
    trip: trip ? { id: trip.id, state: trip.state, version: trip.state_version, route_version: trip.route_version } : null,
    orders: orders.map((o) => ({ id: o.id, state: o.status, version: o.dispatch_version, bestellnummer: o.bestellnummer, kunde_name: o.kunde_name, kunde_adresse: o.kunde_adresse, kunde_plz: o.kunde_plz, kunde_lat: o.kunde_lat, kunde_lng: o.kunde_lng, gesamtbetrag: o.gesamtbetrag })),
    items: items.map((i) => ({ id: i.id, order_id: i.order_id, name: i.name, menge: i.menge,
      outcome: i.outcome, evidence: i.evidence })),
    stops: stops.map((s) => ({ id: s.id, order_id: s.order_id, type: s.type, state: s.state, version: s.stop_version, sequence: s.sequence, address: s.address, lat: s.lat, lng: s.lng, arrived_at: s.arrived_at, completed_at: s.completed_at })),
    exception: exception ? { id: exception.id, kind: exception.kind, state: exception.state, version: exception.exception_version } : null,
    gps_transport: { persistence: 't06_default_off', accepted: false },
  };
}

const RPC: Partial<Record<DriverV2Action, string>> = {
  start_shift: 'fn_driver_session_v2', end_shift: 'fn_driver_session_v2',
  ack_receipt: 'fn_driver_accept_ack_compat_v2', arrive: 'fn_driver_arrive_v2',
  resolve_items: 'fn_driver_resolve_items_v2', confirm_pickup: 'fn_driver_pickup_v2',
  depart_pickup: 'fn_driver_depart_v2', complete_stop: 'fn_driver_complete_v2',
  report_exception: 'fn_driver_report_exception_v2',
};

export async function executeDriverV2Action(
  client: SupabaseClient, driverId: string, action: DriverV2Action, envelope: DriverV2Envelope,
  correlationId: string,
) {
  const before = await loadDriverV2Snapshot(client, driverId, correlationId);
  validateDriverV2ActionEnvelope(action, envelope);
  if (before.driver.state !== envelope.expected_state) {
    return { ok: false, reason_code: 'EXPECTED_STATE_CONFLICT', correlation_id: correlationId, snapshot: before };
  }
  if (before.driver.version !== envelope.expected_versions.driver) {
    return { ok: false, reason_code: 'EXPECTED_VERSION_CONFLICT', correlation_id: correlationId, snapshot: before };
  }
  if (action === 'upload_gps') {
    const gps = envelope.payload ?? {};
    const lat = Number(gps.latitude);
    const lng = Number(gps.longitude);
    const accuracy = Number(gps.accuracy_m);
    const sequence = Number(gps.sequence);
    if (typeof gps.session_id !== 'string'
      || !Number.isSafeInteger(sequence) || sequence < 0
      || !Number.isFinite(lat) || lat < -90 || lat > 90
      || !Number.isFinite(lng) || lng < -180 || lng > 180
      || !Number.isFinite(accuracy) || accuracy < 0
      || typeof gps.captured_at !== 'string' || !Number.isFinite(Date.parse(gps.captured_at))) {
      return {
        ok: false, reason_code: 'INVALID_GPS_EVENT',
        correlation_id: correlationId, snapshot: before,
      };
    }
    return {
      ok: false, reason_code: 'GPS_MONOTONIC_PERSISTENCE_T06_DEFAULT_OFF',
      correlation_id: correlationId, snapshot: before,
    };
  }
  if (action === 'report_exception' && !DRIVER_EXCEPTION_KINDS.includes(envelope.payload?.kind as any)) {
    return { ok: false, reason_code: 'INVALID_EXCEPTION_KIND', correlation_id: correlationId, snapshot: before };
  }
  let tenantQuery = client.from('mise_driver_tenants').select('tenant_id')
    .eq('driver_id', driverId).eq('status', 'active');
  const targetTenant = before.assignment?.tenant_id ?? envelope.payload?.tenant_id;
  if (typeof targetTenant === 'string') tenantQuery = tenantQuery.eq('tenant_id', targetTenant);
  const tenantRow = checked(await tenantQuery.limit(1).maybeSingle(), 'TENANT_LOOKUP') as any;
  if (!tenantRow) return { ok: false, reason_code: 'DRIVER_TENANT_FORBIDDEN', correlation_id: correlationId, snapshot: before };
  const order = before.orders.find((row) => row.id === envelope.payload?.order_id)
    ?? (before.orders.length === 1 ? before.orders[0] : undefined);
  const stop = before.stops.find((s) => s.id === envelope.payload?.stop_id)
    ?? (before.stops.length === 1 ? before.stops[0] : undefined);
  if (envelope.expected_versions.order != null && order?.version !== envelope.expected_versions.order) {
    return { ok: false, reason_code: 'EXPECTED_ORDER_VERSION_CONFLICT', correlation_id: correlationId, snapshot: before };
  }
  if (envelope.expected_versions.stop != null && stop?.version !== envelope.expected_versions.stop) {
    return { ok: false, reason_code: 'EXPECTED_STOP_VERSION_CONFLICT', correlation_id: correlationId, snapshot: before };
  }
  if (envelope.expected_versions.assignment != null && before.assignment?.version !== envelope.expected_versions.assignment) {
    return { ok: false, reason_code: 'EXPECTED_ASSIGNMENT_VERSION_CONFLICT', correlation_id: correlationId, snapshot: before };
  }
  if (envelope.expected_versions.trip != null && before.trip?.version !== envelope.expected_versions.trip) {
    return { ok: false, reason_code: 'EXPECTED_TRIP_VERSION_CONFLICT', correlation_id: correlationId, snapshot: before };
  }
  if (envelope.expected_versions.route != null && before.trip?.route_version !== envelope.expected_versions.route) {
    return { ok: false, reason_code: 'EXPECTED_ROUTE_VERSION_CONFLICT', correlation_id: correlationId, snapshot: before };
  }
  const common = {
    p_tenant_id: tenantRow.tenant_id, p_actor_driver_id: driverId, p_action_id: envelope.action_id,
    p_expected_driver_version: envelope.expected_versions.driver, p_correlation_id: correlationId,
  };
  const lifecycle = {
    ...common,
    p_order_id: (envelope.payload?.order_id as string) ?? order?.id,
    p_expected_order_version: envelope.expected_versions.order,
    p_expected_assignment_version: envelope.expected_versions.assignment,
    p_expected_batch_version: envelope.expected_versions.trip,
  };
  let args: Record<string, unknown>;
  if (action === 'start_shift' || action === 'end_shift') {
    args = { ...common, p_online: action === 'start_shift' };
  } else if (action === 'ack_receipt') {
    args = {
      p_tenant_id: tenantRow.tenant_id, p_assignment_id: before.assignment?.id,
      p_driver_id: driverId, p_snapshot_version: envelope.expected_versions.assignment,
      p_receipt_key: envelope.action_id,
      p_correlation_id: correlationId,
      p_metadata: { snapshot_version: before.snapshot_version, occurred_at: envelope.occurred_at ?? null },
      p_api_version: 'driver-v2',
    };
  } else if (action === 'arrive') {
    args = {
      ...common, p_stop_id: (envelope.payload?.stop_id as string) ?? stop?.id,
      p_expected_stop_version: envelope.expected_versions.stop,
      p_expected_batch_version: envelope.expected_versions.trip,
      p_expected_route_version: envelope.expected_versions.route,
    };
  } else if (action === 'resolve_items') {
    args = {
      ...lifecycle, p_items: envelope.payload?.items ?? [],
      p_expected_stop_version: envelope.expected_versions.stop,
      p_expected_route_version: envelope.expected_versions.route,
    };
  } else if (action === 'report_exception') {
    args = { ...common, p_kind: envelope.payload?.kind, p_note: envelope.payload?.note ?? null };
  } else if (action === 'confirm_pickup') {
    args = {
      ...lifecycle, p_expected_stop_version: envelope.expected_versions.stop,
      p_expected_route_version: envelope.expected_versions.route,
    };
  } else if (action === 'depart_pickup' || action === 'complete_stop') {
    args = {
      ...lifecycle, p_stop_id: envelope.payload?.stop_id,
      p_expected_stop_version: envelope.expected_versions.stop,
      p_expected_route_version: envelope.expected_versions.route,
    };
  } else {
    args = lifecycle;
  }
  const rpc = RPC[action]!;
  const result = checked(await client.rpc(rpc, args), `DRIVER_ACTION_${action}`) as any;
  const snapshot = await loadDriverV2Snapshot(client, driverId, correlationId);
  return { ...(result ?? { ok: false, reason_code: 'EMPTY_RPC_RESULT' }), correlation_id: correlationId, snapshot };
}
