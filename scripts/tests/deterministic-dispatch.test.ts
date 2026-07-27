import assert from 'node:assert/strict';
import {
  canonicalShiftEligible,
  decideDeterministicDispatch,
  deterministicScanStatuses,
  deterministicModePolicy,
  executeDeterministicDecision,
  normalizeDeterministicDispatchConfig,
  preDecisionHold,
  snapshotPageSaturated,
  replayDeterministicDispatch,
  type DeterministicDriverSnapshot,
  type DeterministicOrderSnapshot,
} from '../../lib/delivery/deterministic-dispatch';

const now = new Date('2026-07-27T10:00:00.000Z');
const order: DeterministicOrderSnapshot = {
  id: 'order-1', tenantId: 'tenant-a',
  pickup: { lat: 50.7753, lng: 6.0839 },
  dropoff: { lat: 50.80, lng: 6.10 },
  deliveryDeadlineAt: '2026-07-27T11:00:00.000Z',
};
const driver: DeterministicDriverSnapshot = {
  id: 'driver-b', tenantMembershipActive: true, shiftActive: true, active: true,
  state: 'available', vehicle: 'car', maxRadiusKm: 30,
  currentCapacity: 0, maxCapacity: 4, activeRouteStops: 0,
  blockingException: false, assignmentsLastHour: 0, lastAssignedAt: null,
  gps: {
    latitude: 50.7753, longitude: 6.0839,
    captured_at: '2026-07-27T09:59:30.000Z',
    received_at: '2026-07-27T09:59:31.000Z',
    accuracy_m: 10, quality_flags: [], operational_state: 'available',
  },
};

assert.equal(normalizeDeterministicDispatchConfig({ maxDeliveryKm: 100 }).maxDeliveryKm, 100);
assert.equal(canonicalShiftEligible(true, 'available'), true);
assert.equal(canonicalShiftEligible(true, 'assigned'), false);
assert.equal(canonicalShiftEligible(false, 'available'), false);
assert.deepEqual(deterministicScanStatuses('shadow'), deterministicScanStatuses('off'));
assert.deepEqual(deterministicScanStatuses('active'), ['fertig', 'ready']);
assert.deepEqual(deterministicModePolicy('shadow'), {
  mode: 'shadow',
  evaluate: true,
  mayInvokeAtomicWriter: false,
  continueIncumbent: true,
  scanStatuses: ['neu', 'in_zubereitung', 'fertig'],
});
assert.equal(snapshotPageSaturated(499, 500), false);
assert.equal(snapshotPageSaturated(500, 500), true);
assert.equal(preDecisionHold(), 'held');
assert.equal(decideDeterministicDispatch(order, [], {}, now).winnerDriverId, null);
assert.equal(decideDeterministicDispatch(order, [driver], {}, now).winnerDriverId, 'driver-b');
assert.equal(decideDeterministicDispatch(order, [
  { ...driver, id: 'driver-z' }, { ...driver, id: 'driver-a' },
], {}, now).winnerDriverId, 'driver-a', 'stable lexical tie-break');

const stale = decideDeterministicDispatch(order, [{
  ...driver, gps: { ...driver.gps!, captured_at: '2026-07-27T09:50:00.000Z' },
}], {}, now);
assert.deepEqual(stale.candidates[0].exclusions, ['GPS_STALE']);

assert.deepEqual(
  decideDeterministicDispatch(order, [{ ...driver, gps: null }], {}, now)
    .candidates[0].exclusions,
  ['GPS_MISSING'],
);
assert.deepEqual(
  decideDeterministicDispatch(order, [{
    ...driver, gps: { ...driver.gps!, accuracy_m: 500, quality_flags: ['inaccurate'] },
  }], {}, now).candidates[0].exclusions,
  ['GPS_UNTRUSTED'],
);
assert.deepEqual(
  decideDeterministicDispatch(order, [{
    ...driver, gps: { ...driver.gps!, quality_flags: ['delayed'] },
  }], {}, now).candidates[0].exclusions,
  ['GPS_UNTRUSTED'],
);

const capacity = decideDeterministicDispatch(order, [{
  ...driver, currentCapacity: 4,
}], {}, now);
assert.ok(capacity.candidates[0].exclusions.includes('CAPACITY_EXCEEDED'));

const offline = decideDeterministicDispatch(order, [{
  ...driver, shiftActive: false, state: 'offline', blockingException: true,
}], {}, now);
assert.ok(offline.candidates[0].exclusions.includes('SHIFT_INACTIVE'));
assert.ok(offline.candidates[0].exclusions.includes('BLOCKING_EXCEPTION'));

const impossible = decideDeterministicDispatch({
  ...order, deliveryDeadlineAt: '2026-07-27T10:01:00.000Z',
}, [driver], {}, now);
assert.ok(impossible.candidates[0].exclusions.includes('DEADLINE_INFEASIBLE'));

const workload = decideDeterministicDispatch(order, [
  { ...driver, id: 'busy', activeRouteStops: 2 },
  { ...driver, id: 'free', gps: { ...driver.gps!, latitude: 50.776 } },
], {}, now);
assert.equal(workload.winnerDriverId, 'free');
assert.ok(workload.candidates.find((candidate) => candidate.driverId === 'busy')
  ?.exclusions.includes('ACTIVE_ROUTE_REQUIRES_T08'));

const fairnessTie = decideDeterministicDispatch(order, [
  { ...driver, id: 'used', assignmentsLastHour: 1 },
  { ...driver, id: 'fresh' },
], {}, now);
assert.equal(fairnessTie.winnerDriverId, 'fresh');
const fairnessCannotOverrideRoute = decideDeterministicDispatch(order, [
  { ...driver, id: 'near-used', assignmentsLastHour: 20 },
  {
    ...driver, id: 'far-fresh', assignmentsLastHour: 0,
    gps: { ...driver.gps!, latitude: 50.79, longitude: 6.09 },
  },
], {}, now);
assert.equal(fairnessCannotOverrideRoute.winnerDriverId, 'near-used');

const outside = decideDeterministicDispatch({
  ...order, dropoff: { lat: 51.0, lng: 6.08 },
}, [driver], { maxDeliveryKm: 20 }, now);
assert.ok(outside.candidates[0].exclusions.includes('ORDER_OUTSIDE_DELIVERY_RADIUS'));
const boundary20 = decideDeterministicDispatch({
  ...order,
  pickup: { lat: 0, lng: 0 },
  dropoff: { lat: 0, lng: 0.17985 },
}, [{
  ...driver,
  maxRadiusKm: 30,
  gps: { ...driver.gps!, latitude: 0, longitude: 0 },
}], { maxDeliveryKm: 20 }, now);
assert.equal(boundary20.winnerDriverId, 'driver-b');
const configured25 = decideDeterministicDispatch({
  ...order,
  pickup: { lat: 0, lng: 0 },
  dropoff: { lat: 0, lng: 0.2248 },
}, [{
  ...driver,
  maxRadiusKm: 30,
  gps: { ...driver.gps!, latitude: 0, longitude: 0 },
}], { maxDeliveryKm: 30 }, now);
assert.equal(configured25.winnerDriverId, 'driver-b');

const twoStores = decideDeterministicDispatch({ ...order, tenantId: 'tenant-b' }, [
  { ...driver, id: 'wrong', tenantMembershipActive: false },
  { ...driver, id: 'right' },
], {}, now);
assert.equal(twoStores.winnerDriverId, 'right');

const snapshot = { order, drivers: [driver], evaluatedAt: now.toISOString() };
const replay = replayDeterministicDispatch([snapshot, snapshot]);
assert.deepEqual(replay[0], replay[1], 'same snapshot must replay byte-for-byte');

let writes = 0;
executeDeterministicDecision('shadow', replay[0], async () => ++writes)
  .then(() => {
    assert.equal(writes, 0, 'shadow mode must be structurally read-only');
    return executeDeterministicDecision('active', replay[0], async () => ++writes);
  })
  .then(() => {
    assert.equal(writes, 1, 'active mode delegates exactly once to canonical writer');
    console.log('deterministic-dispatch tests: PASS');
  });
