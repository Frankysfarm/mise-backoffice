import assert from 'node:assert/strict';
import {
  decideKitchenHold, evaluateBestInsertion, resolveRouteLeg, type RoutePoint, type RouteStop,
} from '../../lib/delivery/route-batching-hold';

const p = (id: string, lng: number): RoutePoint => ({ id, lat: 0, lng });
const stop = (id: string, orderId: string, kind: 'pickup'|'dropoff', lng: number, deadlineAt?: string): RouteStop =>
  ({ id, orderId, kind, point: p(id, lng), serviceMinutes: 1, deadlineAt });
const now = '2026-07-28T10:00:00.000Z';
const deadline = '2026-07-28T12:00:00.000Z';
const base = {
  now, start: p('start', 0),
  existingStops: [stop('old-drop', 'old', 'dropoff', 0.15, deadline)],
  candidatePickup: stop('new-pick', 'new', 'pickup', 0),
  candidateDropoff: stop('new-drop', 'new', 'dropoff', 0.14, deadline),
  existingStoreId: 'a', candidateStoreId: 'a', matrix: {},
  config: { capacity: 4, maxAddedDetourMinutes: 20, maxExistingCustomerDelayMinutes: 10,
    deadlineSafetyMinutes: 5, allowMultiStore: false },
};
assert.equal(evaluateBestInsertion(base).compatible, true);
assert.equal(evaluateBestInsertion({ ...base,
  candidateDropoff: stop('opposite', 'new', 'dropoff', -0.14, deadline),
  config: { ...base.config, maxAddedDetourMinutes: 5 },
}).compatible, false);
assert.equal(evaluateBestInsertion({ ...base, candidateStoreId: 'b' }).reasonCode, 'MULTI_STORE_NOT_ALLOWED');
assert.equal(evaluateBestInsertion({ ...base, config: { ...base.config, capacity: 1 } }).reasonCode, 'CAPACITY_EXCEEDED');

const oppositeExisting = { ...base,
  existingStops: [stop('old-opposite', 'old', 'dropoff', -.1, deadline)],
  candidateDropoff: stop('new-forward', 'new', 'dropoff', .1, deadline),
  config: { ...base.config, maxExistingCustomerDelayMinutes: 1 },
};
assert.equal(evaluateBestInsertion(oppositeExisting).compatible, false);

const trafficMatrix = {
  'start->new-pick': { distanceKm: 1, durationMinutes: 1, source: 'road_matrix' as const },
  'new-pick->new-drop': { distanceKm: 2, durationMinutes: 90, source: 'road_matrix' as const },
};
assert.equal(evaluateBestInsertion({ ...base, existingStops: [], matrix: trafficMatrix,
  config: { ...base.config, maxAddedDetourMinutes: 30 } }).compatible, false,
  'road traffic ETA must override short Haversine geometry');

const road = resolveRouteLeg(p('a', 0), p('b', .03), {
  'a->b': { distanceKm: 9, durationMinutes: 25, source: 'road_matrix' },
});
assert.equal(road.durationMinutes, 25);
assert.equal(resolveRouteLeg(p('x', 0), p('y', .03), {}).source, 'conservative_fallback');

for (const lng of [.027, .135, .144, .18, .225]) {
  const decision = evaluateBestInsertion({ ...base,
    existingStops: [], candidateDropoff: stop(`d-${lng}`, 'new', 'dropoff', lng, deadline),
    config: { ...base.config, maxAddedDetourMinutes: 200 },
  });
  assert.equal(decision.compatible, true, `configured route ${lng} must not have arbitrary distance cap`);
}

const hold = decideKitchenHold({
  orderId: 'o', now, createdAt: now, deliveryDeadlineAt: deadline,
  prepMinutes: 15, kitchenQueueMinutes: 5, driverEtaToPickupMinutes: 30,
  pickupToCustomerMinutes: 20, serviceMinutes: 3,
  configuredMaxHoldMinutes: 5, confidenceMarginMinutes: 5, inputVersion: 1,
});
assert.equal(hold.action, 'hold');
assert.equal(hold.absoluteDeadlineAt, '2026-07-28T10:05:00.000Z');
assert.deepEqual(decideKitchenHold({
  orderId: 'o', now: '2026-07-28T10:01:00.000Z', createdAt: now,
  deliveryDeadlineAt: deadline, prepMinutes: 15, kitchenQueueMinutes: 5,
  driverEtaToPickupMinutes: 30, pickupToCustomerMinutes: 20, serviceMinutes: 3,
  configuredMaxHoldMinutes: 5, confidenceMarginMinutes: 5, inputVersion: 1,
  previous: { releaseAt: hold.releaseAt, absoluteDeadlineAt: hold.absoluteDeadlineAt, inputVersion: 1 },
}).releaseAt, hold.releaseAt);
assert.equal(decideKitchenHold({
  orderId: 'late', now, createdAt: '2026-07-28T09:50:00.000Z',
  deliveryDeadlineAt: '2026-07-28T10:25:00.000Z', prepMinutes: 15,
  kitchenQueueMinutes: 5, driverEtaToPickupMinutes: 15, pickupToCustomerMinutes: 10,
  serviceMinutes: 3, configuredMaxHoldMinutes: 15, confidenceMarginMinutes: 5, inputVersion: 2,
}).action, 'release_now');

const loadSpike = decideKitchenHold({
  orderId: 'spike', now, createdAt: now, deliveryDeadlineAt: '2026-07-28T10:35:00.000Z',
  prepMinutes: 10, kitchenQueueMinutes: 20, driverEtaToPickupMinutes: 40,
  pickupToCustomerMinutes: 10, serviceMinutes: 2, configuredMaxHoldMinutes: 15,
  confidenceMarginMinutes: 5, inputVersion: 3,
});
assert.equal(loadSpike.action, 'release_now');
assert.equal(loadSpike.reasonCode, 'DEADLINE_OVERRIDE');
assert.throws(() => decideKitchenHold({
  orderId: 'invalid', now: 'not-a-time', createdAt: now, deliveryDeadlineAt: deadline,
  prepMinutes: 1, kitchenQueueMinutes: 1, driverEtaToPickupMinutes: 1,
  pickupToCustomerMinutes: 1, serviceMinutes: 1, configuredMaxHoldMinutes: 1,
  confidenceMarginMinutes: 1, inputVersion: 1,
}), /INVALID_KITCHEN_HOLD_TIME/);

console.log('route batching hold tests: PASS');
