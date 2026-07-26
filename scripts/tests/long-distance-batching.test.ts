import assert from 'node:assert/strict';
import {
  decideLongDistanceHold,
  evaluateCorridorBundle,
  type LongDistanceOrder,
} from '../../lib/delivery/long-distance-batching';

const now = new Date('2026-07-25T12:00:00.000Z');
const order = (lng: number, overrides: Partial<LongDistanceOrder> = {}): LongDistanceOrder => ({
  id: 'o',
  pickup: { lat: 0, lng: 0 },
  dropoff: { lat: 0, lng },
  createdAt: '2026-07-25T11:59:00.000Z',
  deadlineAt: '2026-07-25T14:00:00.000Z',
  ...overrides,
});

assert.equal(decideLongDistanceHold(order(0.02), now).reasonCode, 'LOCAL_NO_HOLD');
assert.equal(decideLongDistanceHold(order(0.12), now).action, 'hold');
assert.equal(
  decideLongDistanceHold(order(0.12, { createdAt: '2026-07-25T11:50:00.000Z' }), now).reasonCode,
  'HOLD_DEADLINE_REACHED',
);
assert.equal(
  decideLongDistanceHold(order(0.12, { deadlineAt: '2026-07-25T12:20:00.000Z' }), now).reasonCode,
  'DELIVERY_DEADLINE_OVERRIDE',
);
assert.equal(decideLongDistanceHold(order(0.18077), now).reasonCode, 'OUTSIDE_20KM_HARD_CAP');

const compatible = evaluateCorridorBundle({
  routeStart: { lat: 0, lng: 0 },
  routeEnd: { lat: 0, lng: 0.15 },
  candidate: order(0.12),
  existingAdditionalOrders: 1,
  activeStops: 2,
  maxCapacity: 5,
}, now);
assert.equal(compatible.compatible, true);
assert.equal(compatible.reasonCode, 'BUNDLE_COMPATIBLE');

const opposite = evaluateCorridorBundle({
  routeStart: { lat: 0, lng: 0 },
  routeEnd: { lat: 0, lng: 0.15 },
  candidate: order(-0.08),
  existingAdditionalOrders: 0,
  activeStops: 1,
  maxCapacity: 5,
}, now);
assert.equal(opposite.compatible, false);
assert.equal(opposite.reasonCode, 'OPPOSITE_DIRECTION');

const deadlineBundle = evaluateCorridorBundle({
  routeStart: { lat: 0, lng: 0 },
  routeEnd: { lat: 0, lng: 0.15 },
  candidate: order(0.12, { deadlineAt: '2026-07-25T12:10:00.000Z' }),
  existingAdditionalOrders: 0,
  activeStops: 1,
  maxCapacity: 5,
}, now);
assert.equal(deadlineBundle.reasonCode, 'BUNDLE_DEADLINE_INFEASIBLE');

console.log('long-distance batching tests: PASS');
