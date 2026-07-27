import type { DriverV2Snapshot } from '@/lib/delivery/driver-v2-contract';

export function applyValidatedDriverSnapshotEvent(
  event: Event,
  driverId: string,
  apply: (snapshot: DriverV2Snapshot) => void,
): boolean {
  const snapshot = (event as CustomEvent<DriverV2Snapshot>).detail;
  if (snapshot?.api_version !== 'driver-v2' || snapshot.driver?.id !== driverId) return false;
  apply(snapshot);
  return true;
}
