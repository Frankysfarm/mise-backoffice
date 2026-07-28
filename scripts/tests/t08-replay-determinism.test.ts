import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decideKitchenHold, evaluateBestInsertion } from '../../lib/delivery/route-batching-hold';

const fixture = JSON.parse(readFileSync(
  'scripts/tests/fixtures/t08_dispatch_replay.json', 'utf8',
)) as { dataset_version: string; scenarios: Array<{ id: string; expected: string }> };
assert.equal(fixture.dataset_version, 't08-replay-v1');
assert.equal(fixture.scenarios.length, 10);

const routeInput = {
  now: '2026-07-28T10:00:00.000Z',
  start: { id: 'driver', lat: 50, lng: 6 },
  existingStops: [{
    id: 'old-drop', orderId: 'old', kind: 'dropoff' as const,
    point: { id: 'old-drop', lat: 50.02, lng: 6.02 }, serviceMinutes: 2,
    deadlineAt: '2026-07-28T11:00:00.000Z',
  }],
  candidatePickup: {
    id: 'new-pick', orderId: 'new', kind: 'pickup' as const,
    point: { id: 'new-pick', lat: 50, lng: 6 }, serviceMinutes: 2,
  },
  candidateDropoff: {
    id: 'new-drop', orderId: 'new', kind: 'dropoff' as const,
    point: { id: 'new-drop', lat: 50.03, lng: 6.03 }, serviceMinutes: 2,
    deadlineAt: '2026-07-28T11:00:00.000Z',
  },
  existingStoreId: 'store-a',
  candidateStoreId: 'store-a',
  matrix: {},
  config: {
    capacity: 4, maxAddedDetourMinutes: 20,
    maxExistingCustomerDelayMinutes: 8, deadlineSafetyMinutes: 3,
    allowMultiStore: false,
  },
};
const first = evaluateBestInsertion(routeInput);
for (let i = 0; i < 100; i++) {
  assert.deepEqual(evaluateBestInsertion(routeInput), first);
}
assert.equal(first.compatible, true);
assert.equal(first.matrixFallbackUsed, true);
assert.equal(evaluateBestInsertion({
  ...routeInput, candidateStoreId: 'store-b',
}).reasonCode, 'MULTI_STORE_NOT_ALLOWED');

const holdInput = {
  orderId: 'kitchen-delay',
  now: '2026-07-28T10:00:00.000Z',
  createdAt: '2026-07-28T09:55:00.000Z',
  deliveryDeadlineAt: '2026-07-28T10:35:00.000Z',
  prepMinutes: 10, kitchenQueueMinutes: 20, driverEtaToPickupMinutes: 30,
  pickupToCustomerMinutes: 10, serviceMinutes: 2,
  configuredMaxHoldMinutes: 15, confidenceMarginMinutes: 5, inputVersion: 3,
};
const hold = decideKitchenHold(holdInput);
for (let i = 0; i < 100; i++) assert.deepEqual(decideKitchenHold(holdInput), hold);
assert.equal(hold.reasonCode, 'DEADLINE_OVERRIDE');

console.log('T08 deterministic replay dataset: PASS');
