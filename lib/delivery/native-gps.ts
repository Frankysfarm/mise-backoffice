export const GPS_MAX_FUTURE_SKEW_MS = 60_000;
export const GPS_MAX_HISTORY_AGE_MS = 24 * 60 * 60_000;

export const GPS_OPERATIONAL_STATES = [
  'available',
  'assigned',
  'at_pickup',
  'delivering',
  'returning',
] as const;

export type NativeDriverState = typeof GPS_OPERATIONAL_STATES[number] | 'offline' | 'exception';

export interface CanonicalGpsEvent {
  action_id: string;
  installation_id: string;
  session_id: string;
  sequence: number;
  captured_at: string;
  latitude: number;
  longitude: number;
  accuracy_m: number;
  speed_mps?: number | null;
  heading_deg?: number | null;
  altitude_m?: number | null;
  app_version: string;
  app_build?: string | null;
  platform: 'ios' | 'android' | 'web';
  app_state: 'foreground' | 'background' | 'locked' | 'unknown';
  permission_state: 'always' | 'while_in_use' | 'approximate' | 'denied' | 'restricted' | 'unknown';
  network_state: 'online' | 'offline' | 'unknown';
  tracking_mode: 'continuous' | 'significant_change' | 'foreground_only';
  battery_state?: {
    level?: number | null;
    charging?: boolean | null;
    low_power_mode?: boolean | null;
  };
  capability_flags?: Record<string, boolean>;
}
export interface NativeGpsEnvelope {
  action_id: string;
  expected_state: NativeDriverState;
  expected_versions: { driver: number };
  payload: CanonicalGpsEvent;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function mapBackendDriverState(state: string): NativeDriverState {
  switch (state) {
    case 'idle': return 'available';
    case 'assigned': return 'assigned';
    case 'at_restaurant': return 'at_pickup';
    case 'picked_up':
    case 'in_progress':
    case 'en_route': return 'delivering';
    case 'returning': return 'returning';
    case 'exception': return 'exception';
    default: return 'offline';
  }
}

function isFiniteOptional(value: unknown): value is number | null | undefined {
  return value == null || (typeof value === 'number' && Number.isFinite(value));
}

export function validateNativeGpsEnvelope(value: unknown, nowMs = Date.now()): NativeGpsEnvelope {
  if (!value || typeof value !== 'object') throw new Error('INVALID_GPS_ENVELOPE');
  const envelope = value as NativeGpsEnvelope;
  const event = envelope.payload;
  if (!UUID.test(envelope.action_id) || !event || typeof event !== 'object'
    || envelope.action_id !== event.action_id) throw new Error('INVALID_ACTION_ID');
  if (!(GPS_OPERATIONAL_STATES as readonly string[]).includes(envelope.expected_state)
    || !envelope.expected_versions || !Number.isSafeInteger(envelope.expected_versions.driver)
    || envelope.expected_versions.driver < 0) throw new Error('INVALID_EXPECTATION');
  if (!UUID.test(event.installation_id) || !UUID.test(event.session_id)
    || !Number.isSafeInteger(event.sequence) || event.sequence < 0) throw new Error('INVALID_GPS_ORDERING');

  const capturedMs = Date.parse(event.captured_at);
  if (!Number.isFinite(capturedMs) || capturedMs > nowMs + GPS_MAX_FUTURE_SKEW_MS
    || capturedMs < nowMs - GPS_MAX_HISTORY_AGE_MS) throw new Error('INVALID_GPS_CAPTURE_TIME');
  if (!Number.isFinite(event.latitude) || event.latitude < -90 || event.latitude > 90
    || !Number.isFinite(event.longitude) || event.longitude < -180 || event.longitude > 180) {
    throw new Error('INVALID_GPS_COORDINATES');
  }
  if (!Number.isFinite(event.accuracy_m) || event.accuracy_m < 0 || event.accuracy_m > 10_000
    || !isFiniteOptional(event.speed_mps) || !isFiniteOptional(event.heading_deg)
    || !isFiniteOptional(event.altitude_m)) throw new Error('INVALID_GPS_MEASUREMENT');
  if (!['ios', 'android', 'web'].includes(event.platform)
    || !['foreground', 'background', 'locked', 'unknown'].includes(event.app_state)
    || !['continuous', 'significant_change', 'foreground_only'].includes(event.tracking_mode)
    || !['always', 'while_in_use', 'approximate', 'denied', 'restricted', 'unknown'].includes(event.permission_state)
    || !['online', 'offline', 'unknown'].includes(event.network_state)
    || typeof event.app_version !== 'string' || event.app_version.length < 1 || event.app_version.length > 64) {
    throw new Error('INVALID_GPS_CLIENT');
  }
  if (event.battery_state?.level != null && (!Number.isFinite(event.battery_state.level)
    || event.battery_state.level < 0 || event.battery_state.level > 1)) throw new Error('INVALID_GPS_BATTERY');
  return envelope;
}
