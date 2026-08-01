import assert from 'node:assert/strict';
import test from 'node:test';
import { solveDispatchOracle } from './dispatch-oracle';
import { minimizeArrayFailure, seededRandom } from './property-support';
import type { OracleDriver, OracleInput, OracleOrder } from './types';

const order = (id: string, overrides: Partial<OracleOrder> = {}): OracleOrder => ({
  id, tenantId: 'test-lab-tenant', storeId: 'store-a', pickupNode: 'store-a', dropoffNode: `drop-${id}`,
  state: 'candidate', createdMinute: 0, readyMinute: 2, deadlineMinute: 80,
  serviceMinutes: 1, loadUnits: 1, ...overrides,
});
const driver = (id: string, overrides: Partial<OracleDriver> = {}): OracleDriver => ({
  id, tenantId: 'test-lab-tenant', positionNode: `pos-${id}`, online: true, sessionActive: true,
  gpsFresh: true, routeFeasible: true, capacityUnits: 4, currentLoadUnits: 0,
  assignmentsLastHour: 0, shiftEndsMinute: 240, ...overrides,
});
function fixture(orders: OracleOrder[], drivers: OracleDriver[]): OracleInput {
  const nodes = [...drivers.map(({ positionNode }) => positionNode), 'store-a', ...orders.map(({ dropoffNode }) => dropoffNode)];
  const travelMinutes: Record<string, number> = {};
  for (const from of nodes) for (const to of nodes) if (from !== to) travelMinutes[`${from}->${to}`] = 5;
  return { nowMinute: 10, tenantId: 'test-lab-tenant', orders, drivers, travelMinutes,
    pickupServiceMinutes: 2, maxBundleOrders: 4, maxDriverWaitMinutes: 20 };
}

test('enumerates globally and uses a stable driver/order tie-break', () => {
  const input = fixture([order('a'), order('b')], [driver('driver-b'), driver('driver-a')]);
  const result = solveDispatchOracle(input);
  assert.equal(result.objective.assignedOrders, 2);
  assert.equal(result.assignments[0].driverId, 'driver-a');
  assert.deepEqual(result.assignments.flatMap(({ orderIds }) => orderIds).sort(), ['a', 'b']);
  assert.deepEqual(solveDispatchOracle(input), result);
});

test('terminal and cross-tenant orders never enter the candidate set', () => {
  const result = solveDispatchOracle(fixture([
    order('active'), order('terminal', { state: 'terminal' }), order('foreign', { tenantId: 'other-test-tenant' }),
  ], [driver('d')]));
  assert.deepEqual(result.assignments.flatMap(({ orderIds }) => orderIds), ['active']);
  assert.equal(result.unassignedOrderIds.includes('terminal'), false);
});

test('all picked-at-one-store route keeps pickup before every drop-off', () => {
  const result = solveDispatchOracle(fixture([order('a'), order('b'), order('c')], [driver('d')]));
  assert.equal(result.assignments[0].route.nodes[0], 'store-a');
  assert.equal(result.assignments[0].route.nodes.length, 4);
});

test('metamorphic: adding an ineligible order cannot degrade an existing solution', () => {
  const base = fixture([order('a')], [driver('d')]);
  const before = solveDispatchOracle(base);
  const after = solveDispatchOracle({ ...base, orders: [...base.orders, order('x', { state: 'terminal' })] });
  assert.deepEqual(after.assignments, before.assignments);
});

test('metamorphic: a later deadline cannot make an order infeasible', () => {
  const input = fixture([order('a', { deadlineMinute: 18 })], [driver('d')]);
  const late = solveDispatchOracle(input);
  const later = solveDispatchOracle({ ...input, orders: [order('a', { deadlineMinute: 40 })] });
  assert.ok(later.objective.assignedOrders >= late.objective.assignedOrders);
});

test('metamorphic: more capacity cannot reduce the feasible assigned count', () => {
  const orders = [order('a'), order('b'), order('c')];
  const small = solveDispatchOracle(fixture(orders, [driver('d', { capacityUnits: 1 })]));
  const large = solveDispatchOracle(fixture(orders, [driver('d', { capacityUnits: 3 })]));
  assert.ok(large.objective.assignedOrders >= small.objective.assignedOrders);
});

test('metamorphic: moving a driver farther away cannot improve travel time', () => {
  const input = fixture([order('a')], [driver('d')]);
  const near = solveDispatchOracle(input);
  const farTravel = { ...input.travelMinutes, 'pos-d->store-a': 25 };
  const far = solveDispatchOracle({ ...input, travelMinutes: farTravel });
  assert.ok(far.assignments.length === 0 || far.objective.totalTravelMinutes >= near.objective.totalTravelMinutes);
});

test('metamorphic: increased prep time predictably increases wait or makes route infeasible', () => {
  const input = fixture([order('a', { readyMinute: 12 })], [driver('d')]);
  const early = solveDispatchOracle(input);
  const delayed = solveDispatchOracle({ ...input, orders: [order('a', { readyMinute: 25 })] });
  assert.ok(delayed.assignments.length === 0 || delayed.objective.totalWaitMinutes >= early.objective.totalWaitMinutes);
});

test('metamorphic: removing an order leaves a precedence-valid remaining route', () => {
  const input = fixture([order('a'), order('b'), order('c')], [driver('d')]);
  const reduced = solveDispatchOracle({ ...input, orders: input.orders.filter(({ id }) => id !== 'b') });
  assert.equal(reduced.objective.assignedOrders, 2);
  assert.equal(reduced.assignments[0].route.nodes[0], 'store-a');
  assert.equal(reduced.assignments[0].orderIds.includes('b'), false);
});

test('500 seeded property cases are deterministic and obey hard constraints', () => {
  for (let seed = 1; seed <= 500; seed += 1) {
    const random = seededRandom(seed);
    const count = 1 + Math.floor(random() * 4);
    const orders = Array.from({ length: count }, (_, index) => order(`o${index}`, {
      createdMinute: -Math.floor(random() * 30), readyMinute: Math.floor(random() * 12),
      deadlineMinute: 28 + Math.floor(random() * 70), loadUnits: 1 + Math.floor(random() * 2),
      maxMinutesAfterPickup: 20 + Math.floor(random() * 40),
    }));
    const drivers = [driver('a', { capacityUnits: 1 + Math.floor(random() * 5) }),
      driver('b', { capacityUnits: 1 + Math.floor(random() * 5), assignmentsLastHour: 1 })];
    const input = fixture(orders, drivers);
    const first = solveDispatchOracle(input); const second = solveDispatchOracle(input);
    try {
      assert.deepEqual(first, second);
      const assigned = first.assignments.flatMap(({ orderIds }) => orderIds);
      assert.equal(new Set(assigned).size, assigned.length);
      for (const assignment of first.assignments) {
        const assignedOrders = orders.filter(({ id }) => assignment.orderIds.includes(id));
        const assignedDriver = drivers.find(({ id }) => id === assignment.driverId)!;
        assert.ok(assignedOrders.reduce((sum, item) => sum + item.loadUnits, 0) <= assignedDriver.capacityUnits);
        assert.ok(Object.values(assignment.route.slackByOrder).every((slack) => slack >= 0));
      }
    } catch (error) {
      const minimalOrders = minimizeArrayFailure(orders, (candidate) => {
        try { const result = solveDispatchOracle(fixture(candidate, drivers));
          return new Set(result.assignments.flatMap(({ orderIds }) => orderIds)).size !== result.assignments.flatMap(({ orderIds }) => orderIds).length;
        } catch { return true; }
      });
      throw new Error(`ORACLE_PROPERTY_SEED=${seed} MINIMAL=${JSON.stringify(minimalOrders)}`, { cause: error });
    }
  }
});

test('shrinker minimizes a reproducible failing sequence', () => {
  const minimized = minimizeArrayFailure([1, 2, 3, 4, 5], (values) => values.includes(3));
  assert.deepEqual(minimized, [3]);
});
