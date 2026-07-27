export const GPS_OFFLINE_QUEUE_LIMIT = 100;
export const GPS_MAX_FUTURE_SKEW_MS = 60_000;
export const GPS_MAX_HISTORY_AGE_MS = 24 * 60 * 60_000;
export const GPS_MAX_ACCURACY_M = 200;

export const GPS_OPERATIONAL_STATES = [
  'available', 'assigned', 'at_pickup', 'delivering', 'returning',
] as const;

export type GpsPlatform = 'ios' | 'android' | 'web';
export type GpsAppState = 'foreground' | 'background' | 'locked' | 'unknown';

export type CanonicalGpsEvent = {
  session_id: string;
  sequence: number;
  captured_at: string;
  latitude: number;
  longitude: number;
  accuracy_m: number;
  speed_mps?: number | null;
  heading_deg?: number | null;
  app_version: string;
  app_build?: string | null;
  platform: GpsPlatform;
  app_state: GpsAppState;
  permission_state: 'always' | 'while_in_use' | 'approximate' | 'denied' | 'restricted' | 'unknown';
  network_state: 'online' | 'offline' | 'unknown';
  capability_flags?: Record<string, boolean>;
};

export type QueuedGpsEvent = CanonicalGpsEvent & { action_id: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateCanonicalGpsEvent(value: unknown, nowMs = Date.now()): CanonicalGpsEvent {
  if (!value || typeof value !== 'object') throw new Error('INVALID_GPS_EVENT');
  const event = value as CanonicalGpsEvent;
  const capturedMs = Date.parse(event.captured_at);
  if (!UUID.test(event.session_id) || !Number.isSafeInteger(event.sequence) || event.sequence < 0) throw new Error('INVALID_GPS_ORDERING');
  if (!Number.isFinite(capturedMs) || capturedMs > nowMs + GPS_MAX_FUTURE_SKEW_MS || capturedMs < nowMs - GPS_MAX_HISTORY_AGE_MS) throw new Error('INVALID_GPS_CAPTURE_TIME');
  if (!Number.isFinite(event.latitude) || event.latitude < -90 || event.latitude > 90
    || !Number.isFinite(event.longitude) || event.longitude < -180 || event.longitude > 180) throw new Error('INVALID_GPS_COORDINATES');
  if (!Number.isFinite(event.accuracy_m) || event.accuracy_m < 0 || event.accuracy_m > 10_000) throw new Error('INVALID_GPS_ACCURACY');
  if (!['ios', 'android', 'web'].includes(event.platform)
    || !['foreground', 'background', 'locked', 'unknown'].includes(event.app_state)
    || typeof event.app_version !== 'string' || event.app_version.length < 1 || event.app_version.length > 64) throw new Error('INVALID_GPS_CLIENT');
  return event;
}

export function appendBoundedGpsEvent(queue: readonly QueuedGpsEvent[], incoming: QueuedGpsEvent): QueuedGpsEvent[] {
  const deduped = queue.filter((event) =>
    event.action_id !== incoming.action_id
    && !(event.session_id === incoming.session_id && event.sequence === incoming.sequence));
  return [...deduped, incoming]
    .sort((a, b) => Date.parse(a.captured_at) - Date.parse(b.captured_at)
      || a.sequence - b.sequence || a.action_id.localeCompare(b.action_id))
    .slice(-GPS_OFFLINE_QUEUE_LIMIT);
}

export function gpsDispatchTrust(input: {
  receivedAt: string;
  capturedAt: string;
  accuracyM: number;
  qualityFlags: readonly string[];
  operationalState: string;
}, nowMs = Date.now(), activeWork = false) {
  const ageMs = nowMs - Date.parse(input.capturedAt);
  const staleAfterMs = (activeWork ? 90 : 180) * 1_000;
  const blocking = input.qualityFlags.some((flag) =>
    ['delayed', 'inaccurate', 'implausible_jump', 'permission_denied', 'permission_restricted'].includes(flag));
  const operational = (GPS_OPERATIONAL_STATES as readonly string[]).includes(input.operationalState);
  return {
    trusted: operational && ageMs >= 0 && ageMs <= staleAfterMs
      && input.accuracyM <= GPS_MAX_ACCURACY_M && !blocking,
    age_ms: ageMs,
    stale_after_ms: staleAfterMs,
    reason: !operational ? 'operational_state_not_trackable'
      : ageMs > staleAfterMs ? 'stale'
        : blocking || input.accuracyM > GPS_MAX_ACCURACY_M ? 'untrusted_quality'
          : 'trusted',
  } as const;
}
