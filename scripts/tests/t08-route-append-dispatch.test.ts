import assert from 'node:assert/strict';
import {
  executeRouteAppendDispatch,
  type RouteAppendCandidate,
} from '../../lib/delivery/route-append-dispatch';

const compatible: RouteAppendCandidate = {
  driverId: 'driver-b',
  batchId: 'batch-b',
  expectedDriverVersion: 4,
  expectedRouteVersion: 7,
  input: {},
  decision: {
    compatible: true,
    reasonCode: 'INSERTION_FEASIBLE',
    stops: [],
    totalMinutes: 18,
    addedMinutes: 3,
    matrixFallbackUsed: false,
    arrivals: {},
  },
};
const preferred = {
  ...compatible,
  driverId: 'driver-a',
  batchId: 'batch-a',
  decision: { ...compatible.decision, totalMinutes: 16 },
};

{
  const businessSnapshot = { assignments: 2, stops: 4, pushes: 2, holds: 1, version: 9 };
  const before = JSON.stringify(businessSnapshot);
  let appendCalls = 0;
  let auditCalls = 0;
  const result = await executeRouteAppendDispatch('shadow', {
    loadCandidates: async () => [compatible, preferred],
    append: async () => {
      appendCalls++;
      businessSnapshot.version++;
      return { ok: true };
    },
    audit: async (event) => {
      auditCalls++;
      assert.equal(event.winnerDriverId, 'driver-a');
      assert.equal(event.reasonCode, 'T08_SHADOW_INSERTION_FEASIBLE');
    },
  });
  assert.equal(result.outcome, 'shadow');
  assert.equal(appendCalls, 0);
  assert.equal(auditCalls, 1);
  assert.equal(JSON.stringify(businessSnapshot), before);
}

{
  let loads = 0;
  let appends = 0;
  const result = await executeRouteAppendDispatch('active', {
    loadCandidates: async () => {
      loads++;
      return [preferred];
    },
    append: async () => {
      appends++;
      return appends === 1
        ? { ok: false, reason_code: 'BATCH_ROUTE_VERSION_CONFLICT' }
        : { ok: true, batch_id: 'batch-a' };
    },
    audit: async () => undefined,
  });
  assert.equal(result.outcome, 'appended');
  assert.equal(loads, 2);
  assert.equal(appends, 2);
}

{
  let appends = 0;
  const result = await executeRouteAppendDispatch('active', {
    loadCandidates: async () => [preferred],
    append: async () => {
      appends++;
      return { ok: false, reason_code: 'ORDER_NOT_ASSIGNABLE' };
    },
    audit: async () => undefined,
  });
  assert.equal(result.outcome, 'conflict');
  assert.equal(appends, 1);
}

console.log('T08 route append orchestration and shadow snapshot: PASS');
