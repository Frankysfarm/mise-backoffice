import assert from 'node:assert/strict';
import {
  decideIntelligentDispatch,
  normalizeIntelligentDispatchConfig,
  type IntelligentDispatchDriver,
} from '../../lib/delivery/intelligent-dispatch';

const now = new Date('2026-07-24T12:00:00.000Z');
const pickup = { lat: 52.52, lng: 13.405 };
const baseDriver: IntelligentDispatchDriver = {
  id: 'driver-b',
  vehicle: 'car',
  state: 'idle',
  position: { lat: 52.52, lng: 13.405 },
  lastPositionAt: '2026-07-24T11:59:00.000Z',
  activeStops: 0,
  maxCapacity: 4,
  assignmentsLastHour: 0,
  lastAssignedAt: null,
};

assert.equal(normalizeIntelligentDispatchConfig({ maxDeliveryKm: 99 }).maxDeliveryKm, 15);

const outside = decideIntelligentDispatch(
  {
    id: 'outside',
    pickup,
    dropoff: { lat: 52.52, lng: 13.64 },
    deadlineAt: null,
  },
  [baseDriver],
  { maxDeliveryKm: 15 },
  now,
);
assert.equal(outside.winnerDriverId, null);
assert.equal(outside.candidates[0].reasonCodes[0], 'OUTSIDE_DELIVERY_RADIUS');

const missing = decideIntelligentDispatch(
  { id: 'missing', pickup, dropoff: { lat: null, lng: null }, deadlineAt: null },
  [baseDriver],
  {},
  now,
);
assert.equal(missing.candidates[0].reasonCodes[0], 'MISSING_DROPOFF_COORDINATES');

const stale = decideIntelligentDispatch(
  {
    id: 'stale',
    pickup,
    dropoff: { lat: 52.53, lng: 13.42 },
    deadlineAt: null,
  },
  [{ ...baseDriver, lastPositionAt: '2026-07-24T11:40:00.000Z' }],
  {},
  now,
);
assert.equal(stale.candidates[0].reasonCodes[0], 'DRIVER_GPS_STALE');

const capacity = decideIntelligentDispatch(
  {
    id: 'capacity',
    pickup,
    dropoff: { lat: 52.53, lng: 13.42 },
    deadlineAt: null,
  },
  [{ ...baseDriver, activeStops: 4, maxCapacity: 4 }],
  {},
  now,
);
assert.equal(capacity.candidates[0].reasonCodes[0], 'DRIVER_CAPACITY_EXCEEDED');

const deadline = decideIntelligentDispatch(
  {
    id: 'deadline',
    pickup,
    dropoff: { lat: 52.57, lng: 13.48 },
    deadlineAt: '2026-07-24T12:05:00.000Z',
  },
  [baseDriver],
  { deadlineSafetyMinutes: 5 },
  now,
);
assert.equal(deadline.candidates[0].reasonCodes[0], 'DEADLINE_INFEASIBLE');

const fairness = decideIntelligentDispatch(
  {
    id: 'fairness',
    pickup,
    dropoff: { lat: 52.53, lng: 13.42 },
    deadlineAt: '2026-07-24T13:00:00.000Z',
  },
  [
    { ...baseDriver, id: 'driver-a', assignmentsLastHour: 5 },
    { ...baseDriver, id: 'driver-b', assignmentsLastHour: 0 },
  ],
  {},
  now,
);
assert.equal(fairness.winnerDriverId, 'driver-b');
assert.equal(fairness.approximation, 'haversine_static_speed');

const tie = decideIntelligentDispatch(
  {
    id: 'tie',
    pickup,
    dropoff: { lat: 52.53, lng: 13.42 },
    deadlineAt: null,
  },
  [
    { ...baseDriver, id: 'driver-z' },
    { ...baseDriver, id: 'driver-a' },
  ],
  {},
  now,
);
assert.equal(tie.winnerDriverId, 'driver-a');

console.log('intelligent-dispatch tests: PASS');
