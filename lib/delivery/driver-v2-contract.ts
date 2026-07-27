export const DRIVER_V2_API_VERSION = 'driver-v2';

export const DRIVER_EXCEPTION_KINDS = [
  'medical_safety_emergency',
  'vehicle_failure',
  'accident_road_closure',
  'location_permission_gps_failure',
  'network_device_failure',
  'shift_invalid',
  'dispatcher_authorized_break',
] as const;

export type DriverExceptionKind = (typeof DRIVER_EXCEPTION_KINDS)[number];
export type DriverV2Action =
  | 'start_shift' | 'end_shift' | 'ack_receipt' | 'arrive'
  | 'resolve_items' | 'confirm_pickup' | 'depart_pickup'
  | 'atomic_pickup' | 'complete_stop' | 'report_exception' | 'upload_gps';

export type DriverV2Envelope = {
  action?: DriverV2Action;
  action_id: string;
  expected_state: string;
  expected_versions: {
    order?: number;
    assignment?: number;
    trip?: number;
    route?: number;
    driver: number;
    stop?: number;
  };
  occurred_at?: string;
  payload?: Record<string, unknown>;
};

const ACTION_STATES: Record<DriverV2Action, readonly string[]> = {
  start_shift: ['offline'], end_shift: ['available', 'returning'],
  ack_receipt: ['assigned', 'at_pickup', 'delivering', 'returning'],
  arrive: ['assigned', 'delivering'], resolve_items: ['assigned', 'at_pickup'],
  confirm_pickup: ['assigned', 'at_pickup'], depart_pickup: ['at_pickup'],
  atomic_pickup: ['assigned', 'at_pickup'],
  complete_stop: ['delivering'], report_exception: ['available', 'assigned', 'at_pickup', 'delivering', 'returning'],
  upload_gps: ['offline', 'available', 'assigned', 'at_pickup', 'delivering', 'returning', 'exception'],
};
const REQUIRED: Record<DriverV2Action, readonly string[]> = {
  start_shift: ['driver'], end_shift: ['driver'], ack_receipt: ['driver', 'assignment'],
  arrive: ['driver', 'trip', 'route', 'stop'], resolve_items: ['driver', 'order', 'assignment', 'trip', 'route', 'stop'],
  confirm_pickup: ['driver', 'order', 'assignment', 'trip', 'route', 'stop'],
  depart_pickup: ['driver', 'order', 'assignment', 'trip', 'route', 'stop'],
  atomic_pickup: ['driver', 'trip', 'route'],
  complete_stop: ['driver', 'order', 'assignment', 'trip', 'route', 'stop'],
  report_exception: ['driver'], upload_gps: ['driver'],
};

export function validateDriverV2ActionEnvelope(action: DriverV2Action, envelope: DriverV2Envelope) {
  if (!ACTION_STATES[action].includes(envelope.expected_state)) throw new Error('EXPECTED_STATE_NOT_ALLOWED_FOR_ACTION');
  for (const key of REQUIRED[action]) {
    if (!Number.isSafeInteger(envelope.expected_versions[key as keyof DriverV2Envelope['expected_versions']])) {
      throw new Error(`EXPECTED_${key.toUpperCase()}_VERSION_REQUIRED`);
    }
  }
}

export type DriverV2Snapshot = {
  api_version: typeof DRIVER_V2_API_VERSION;
  correlation_id: string;
  snapshot_version: string;
  generated_at: string;
  driver: { id: string; state: string; version: number; active: boolean };
  assignment: null | { id: string; tenant_id: string; state: string; version: number; received_by_app_at: string | null };
  assignments: Array<{ id: string; order_id: string; tenant_id: string; state: string; version: number }>;
  trip: null | { id: string; state: string; version: number; route_version: number };
  orders: Array<{ id: string; state: string; version: number; bestellnummer: string; kunde_name: string; kunde_adresse: string | null; kunde_plz: string | null; kunde_lat: number | null; kunde_lng: number | null; gesamtbetrag: number }>;
  items: Array<{ id: string; order_id: string; name: string; menge: number; outcome:
    'present_confirmed' | 'substituted_approved' | 'cancelled_refunded' |
    'resolved_missing' | 'unresolved' | null; evidence?: Record<string, unknown> }>;
  stops: Array<{ id: string; order_id: string; type: string; state: string; version: number; sequence: number; address: string | null; lat: number | null; lng: number | null; arrived_at: string | null; completed_at: string | null }>;
  exception: null | { id: string; kind: DriverExceptionKind; state: string; version: number };
  gps_transport: { persistence: 't06_default_off'; accepted: false };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateDriverV2Envelope(value: unknown): DriverV2Envelope {
  if (!value || typeof value !== 'object') throw new Error('INVALID_BODY');
  const body = value as Record<string, unknown>;
  if (typeof body.action_id !== 'string' || !UUID.test(body.action_id)) throw new Error('ACTION_ID_REQUIRED');
  if (typeof body.expected_state !== 'string' || body.expected_state.length === 0) throw new Error('EXPECTED_STATE_REQUIRED');
  if (!body.expected_versions || typeof body.expected_versions !== 'object') throw new Error('EXPECTED_VERSIONS_REQUIRED');
  const versions = body.expected_versions as Record<string, unknown>;
  if (!Number.isSafeInteger(versions.driver) || Number(versions.driver) < 0) throw new Error('EXPECTED_DRIVER_VERSION_REQUIRED');
  for (const key of ['order', 'assignment', 'trip', 'route', 'stop']) {
    if (versions[key] != null && (!Number.isSafeInteger(versions[key]) || Number(versions[key]) < 0)) {
      throw new Error(`INVALID_EXPECTED_${key.toUpperCase()}_VERSION`);
    }
  }
  if (body.occurred_at != null && (typeof body.occurred_at !== 'string' || !Number.isFinite(Date.parse(body.occurred_at)))) {
    throw new Error('INVALID_OCCURRED_AT');
  }
  return body as DriverV2Envelope;
}

export function statusForDriverV2Reason(reason?: string): number {
  if (!reason) return 500;
  if (reason.includes('FORBIDDEN') || reason.includes('AUTHORITY_MISMATCH')) return 403;
  if (reason.includes('VERSION') || reason.includes('STATE') || reason.includes('IDEMPOTENCY')) return 409;
  if (reason.includes('REQUIRED') || reason.includes('INVALID')) return 400;
  return 409;
}

export function realtimeRequiresReload(current: string | null, announced: string | null): boolean {
  return current !== announced;
}

export function resolveSingleOrderItems<T extends { order_id: string }>(
  items: readonly T[],
  resolve: (orderId: string, orderItems: T[]) => Promise<void>,
): Promise<string> {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(item.order_id, [...(groups.get(item.order_id) ?? []), item]);
  if (groups.size !== 1) throw new Error('MULTI_ORDER_LIFECYCLE_DEFAULT_OFF');
  const [orderId, orderItems] = [...groups.entries()][0];
  return resolve(orderId, orderItems).then(() => orderId);
}
