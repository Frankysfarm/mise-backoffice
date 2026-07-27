import { gpsDispatchTrust } from './gps-transport';

export type DispatchGpsCandidate = {
  captured_at: string;
  received_at: string;
  accuracy_m: number;
  quality_flags: readonly string[];
  operational_state: string;
};

export function gpsEligibleForNewAssignment(
  position: DispatchGpsCandidate | null,
  options: { nowMs: number; staleSeconds: number; maxAccuracyM: number },
) {
  if (!position) return { eligible: false, reason: 'gps_missing' } as const;
  const trust = gpsDispatchTrust({
    receivedAt: position.received_at, capturedAt: position.captured_at,
    accuracyM: position.accuracy_m, qualityFlags: position.quality_flags,
    operationalState: position.operational_state,
  }, options.nowMs, options.staleSeconds <= 90);
  const ageMs = options.nowMs - Date.parse(position.captured_at);
  if (ageMs > options.staleSeconds * 1000) return { eligible: false, reason: 'gps_stale', ageMs } as const;
  if (position.accuracy_m > options.maxAccuracyM || !trust.trusted) {
    return { eligible: false, reason: 'gps_untrusted', ageMs } as const;
  }
  return { eligible: true, reason: 'gps_trusted', ageMs } as const;
}
