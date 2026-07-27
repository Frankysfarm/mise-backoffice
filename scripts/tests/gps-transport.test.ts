import assert from 'node:assert/strict';
import { appendBoundedGpsEvent, gpsDispatchTrust, validateCanonicalGpsEvent } from '../../lib/delivery/gps-transport';
import { gpsEligibleForNewAssignment } from '../../lib/delivery/gps-dispatch-eligibility';

const now = Date.parse('2026-07-27T12:00:00Z');
const base = {
  action_id: '10000000-0000-4000-8000-000000000001',
  session_id: '20000000-0000-4000-8000-000000000001', sequence: 1,
  captured_at: '2026-07-27T11:59:55Z', latitude: 52.5, longitude: 13.4,
  accuracy_m: 10, app_version: '1.0', platform: 'ios' as const,
  app_state: 'foreground' as const, permission_state: 'always' as const,
  network_state: 'online' as const,
};
assert.equal(validateCanonicalGpsEvent(base, now).sequence, 1);
assert.throws(() => validateCanonicalGpsEvent({ ...base, captured_at: '2026-07-27T12:02:00Z' }, now));
let queue = [] as typeof base[];
for (let sequence=0; sequence<120; sequence++) queue = appendBoundedGpsEvent(queue, { ...base, action_id: `${sequence}`.padStart(8,'0')+'-0000-4000-8000-000000000001', sequence });
assert.equal(queue.length, 100);
assert.equal(queue[0].sequence, 20);
assert.equal(gpsDispatchTrust({ receivedAt:'2026-07-27T11:59:00Z',capturedAt:base.captured_at,accuracyM:10,qualityFlags:[],operationalState:'delivering' },now,true).trusted,true);
assert.equal(gpsDispatchTrust({ receivedAt:'2026-07-27T11:55:00Z',capturedAt:base.captured_at,accuracyM:10,qualityFlags:[],operationalState:'available' },now,false).reason,'trusted');
assert.equal(gpsDispatchTrust({ receivedAt:'2026-07-27T11:59:55Z',capturedAt:base.captured_at,accuracyM:500,qualityFlags:['inaccurate'],operationalState:'delivering' },now,true).trusted,false);
assert.equal(gpsDispatchTrust({ receivedAt:'2026-07-27T12:00:00Z',capturedAt:'2026-07-27T11:55:00Z',accuracyM:10,qualityFlags:[],operationalState:'delivering' },now,true).reason,'stale');
assert.equal(gpsDispatchTrust({ receivedAt:'2026-07-27T12:00:00Z',capturedAt:base.captured_at,accuracyM:10,qualityFlags:['delayed'],operationalState:'delivering' },now,true).trusted,false);
assert.equal(gpsEligibleForNewAssignment({captured_at:base.captured_at,received_at:'2026-07-27T12:00:00Z',accuracy_m:10,quality_flags:[],operational_state:'available'},{nowMs:now,staleSeconds:180,maxAccuracyM:200}).eligible,true);
assert.equal(gpsEligibleForNewAssignment({captured_at:'2026-07-27T11:55:00Z',received_at:'2026-07-27T12:00:00Z',accuracy_m:10,quality_flags:[],operational_state:'available'},{nowMs:now,staleSeconds:180,maxAccuracyM:200}).reason,'gps_stale');
console.log('gps transport tests: PASS');
