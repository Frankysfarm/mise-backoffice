import assert from 'node:assert/strict';
import test from 'node:test';
import { compareProductionDecisionToOracle } from './production-oracle-comparison';
import type { OracleInput } from '../oracle/types';

function input(): OracleInput {
  return {
    nowMinute: 10, tenantId: 'test-lab-tenant', pickupServiceMinutes: 1,
    maxBundleOrders: 2, maxDriverWaitMinutes: 20,
    orders: [
      { id: 'a', tenantId: 'test-lab-tenant', storeId: 's', pickupNode: 's', dropoffNode: 'a', state: 'candidate', createdMinute: 0, readyMinute: 0, deadlineMinute: 80, serviceMinutes: 1, loadUnits: 1 },
      { id: 'b', tenantId: 'test-lab-tenant', storeId: 's', pickupNode: 's', dropoffNode: 'b', state: 'candidate', createdMinute: 1, readyMinute: 0, deadlineMinute: 80, serviceMinutes: 1, loadUnits: 1 },
    ],
    drivers: [
      { id: 'd1', tenantId: 'test-lab-tenant', positionNode: 'p1', online: true, sessionActive: true, gpsFresh: true, routeFeasible: true, capacityUnits: 2, currentLoadUnits: 0, assignmentsLastHour: 0, shiftEndsMinute: 200 },
      { id: 'd2', tenantId: 'test-lab-tenant', positionNode: 'p2', online: true, sessionActive: true, gpsFresh: true, routeFeasible: true, capacityUnits: 2, currentLoadUnits: 0, assignmentsLastHour: 2, shiftEndsMinute: 200 },
    ],
    travelMinutes: {
      'p1->s': 2, 'p2->s': 8, 's->a': 3, 's->b': 4, 'a->b': 2, 'b->a': 2,
    },
  };
}

test('records an exact normalized production/oracle match deterministically', () => {
  const fixture = input();
  const comparison = compareProductionDecisionToOracle(fixture, {
    algorithmVersion: 'captured-production-v1', assignments: [{ driverId: 'd1', orderIds: ['b', 'a'] }], unassignedOrderIds: [],
  });
  assert.equal(comparison.verdict, 'EXACT_MATCH');
  assert.deepEqual(comparison.hardConstraintViolations, []);
  assert.equal(comparison.objectiveDelta?.assignedOrderGap, 0);
  assert.deepEqual(compareProductionDecisionToOracle(fixture, {
    algorithmVersion: 'captured-production-v1', assignments: [{ driverId: 'd1', orderIds: ['b', 'a'] }], unassignedOrderIds: [],
  }), comparison);
});

test('reports a feasible but inferior production decision and its objective gap', () => {
  const comparison = compareProductionDecisionToOracle(input(), {
    algorithmVersion: 'captured-production-v1', assignments: [{ driverId: 'd2', orderIds: ['a', 'b'] }], unassignedOrderIds: [],
  });
  assert.equal(comparison.verdict, 'QUALITY_GAP');
  assert.equal(comparison.hardConstraintViolations.length, 0);
  assert.ok((comparison.objectiveDelta?.travelExcessMinutes ?? 0) > 0);
  assert.ok((comparison.objectiveDelta?.fairnessExcess ?? 0) > 0);
});

test('allows only an explicit quality tolerance', () => {
  const comparison = compareProductionDecisionToOracle(input(), {
    algorithmVersion: 'captured-production-v1', assignments: [{ driverId: 'd2', orderIds: ['a', 'b'] }], unassignedOrderIds: [],
  }, { maxTravelExcessMinutes: 10, maxWorstSlackLossMinutes: 10, maxFairnessExcess: 2 });
  assert.equal(comparison.verdict, 'WITHIN_TOLERANCE');
  assert.equal(comparison.tolerance.maxTravelExcessMinutes, 10);
});

test('fails closed on duplicate order assignment', () => {
  const comparison = compareProductionDecisionToOracle(input(), {
    algorithmVersion: 'captured-production-v1', assignments: [
      { driverId: 'd1', orderIds: ['a'] }, { driverId: 'd2', orderIds: ['a', 'b'] },
    ],
  });
  assert.equal(comparison.verdict, 'HARD_CONSTRAINT_VIOLATION');
  assert.ok(comparison.hardConstraintViolations.some(({ code }) => code === 'DUPLICATE_ORDER'));
  assert.equal(comparison.objectiveDelta, null);
});

test('fails closed when the captured assignment is infeasible', () => {
  const fixture = input();
  const comparison = compareProductionDecisionToOracle({
    ...fixture, drivers: [{ ...fixture.drivers[0], online: false }, fixture.drivers[1]],
  }, {
    algorithmVersion: 'captured-production-v1', assignments: [{ driverId: 'd1', orderIds: ['a'] }], unassignedOrderIds: ['b'],
  });
  assert.equal(comparison.verdict, 'HARD_CONSTRAINT_VIOLATION');
  assert.ok(comparison.hardConstraintViolations.some(({ code }) => code === 'INFEASIBLE_ASSIGNMENT'));
});

test('rejects invalid tolerance and inconsistent unassigned evidence', () => {
  assert.throws(() => compareProductionDecisionToOracle(input(), {
    algorithmVersion: 'x', assignments: [],
  }, { maxAssignedOrderGap: -1 }), /INVALID_COMPARISON_TOLERANCE/);
  const comparison = compareProductionDecisionToOracle(input(), {
    algorithmVersion: 'x', assignments: [{ driverId: 'd1', orderIds: ['a'] }], unassignedOrderIds: [],
  });
  assert.ok(comparison.hardConstraintViolations.some(({ code }) => code === 'UNASSIGNED_SET_MISMATCH'));
});
