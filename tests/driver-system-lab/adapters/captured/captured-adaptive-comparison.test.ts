import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  ADAPTIVE_DISPATCH_VERSION,
  optimizeAdaptiveDispatch,
  type AdaptiveDriver,
  type AdaptiveOrder,
  type BundleEstimate,
} from '../../../../lib/delivery/adaptive-dispatch-optimizer';
import type { OracleInput } from '../../oracle/types';
import { compareProductionDecisionToOracle } from '../production-oracle-comparison';

type NeutralOrder = {
  id: string;
  ageMinutes: number;
  dropoff: { lat: number; lng: number };
};

type CapturedRow = {
  bundleSize: number;
  algorithmVersion: string;
  productionAssignments: string[];
  oracleAssignments: string[];
  verdict: string;
  assignedOrderGap: number | null;
};

const evaluatedAt = '2026-08-01T10:00:00.000Z';
const neutralFixture = {
  tenantId: 'test-lab-captured',
  store: { id: 'store-1', lat: 50, lng: 6 },
  orders: [
    { id: 'order-a', ageMinutes: 40, dropoff: { lat: 50.010, lng: 6.001 } },
    { id: 'order-b', ageMinutes: 30, dropoff: { lat: 50.011, lng: 6.002 } },
    { id: 'order-c', ageMinutes: 20, dropoff: { lat: 50.012, lng: 6.003 } },
    { id: 'order-d', ageMinutes: 10, dropoff: { lat: 50.013, lng: 6.004 } },
  ] satisfies NeutralOrder[],
} as const;

function subsets<T>(values: readonly T[], maximum: number): T[][] {
  const result: T[][] = [];
  const visit = (offset: number, selected: T[]) => {
    if (selected.length) result.push([...selected]);
    if (selected.length === maximum) return;
    for (let index = offset; index < values.length; index += 1) visit(index + 1, [...selected, values[index]]);
  };
  visit(0, []);
  return result;
}

function captureProduction(bundleSize: number) {
  const orders: AdaptiveOrder[] = neutralFixture.orders.map((order) => ({
    id: order.id,
    pickup: { lat: neutralFixture.store.lat, lng: neutralFixture.store.lng },
    dropoff: order.dropoff,
    deadlineAt: '2026-08-01T12:00:00.000Z',
    serviceMinutes: 1,
    routeFeasible: true,
  }));
  const driver: AdaptiveDriver = {
    id: 'driver-1', online: true, sessionActive: true,
    gps: { lat: neutralFixture.store.lat, lng: neutralFixture.store.lng },
    gpsAgeSeconds: 5, gpsAccuracyM: 4, capacity: 4, load: 0, radiusKm: 20,
    routeFeasible: true, batteryPct: 80, network: 'good', assignmentsLastHour: 0,
  };
  const rank = new Map(neutralFixture.orders.map((order, index) => [order.id, index]));
  const estimates: BundleEstimate[] = subsets(orders, bundleSize).map((bundle) => ({
    driverId: driver.id,
    orderIds: bundle.map(({ id }) => id),
    // The captured provider estimate deliberately favors the oldest feasible
    // subset, matching the neutral fixture's age ordering without sharing any
    // oracle objective implementation.
    etaMinutes: 5 + bundle.reduce((sum, { id }) => sum + (rank.get(id) ?? 99), 0),
    detourMinutes: 0,
    routeFeasible: true,
  }));
  return optimizeAdaptiveDispatch({
    orders, drivers: [driver], estimates, evaluatedAt,
    config: { maxEnumeratedBundleSize: bundleSize },
  });
}

function oracleInput(bundleSize: number): OracleInput {
  const nodes = ['store-1', ...neutralFixture.orders.map(({ id }) => id)];
  const travelMinutes: Record<string, number> = { 'driver-position->store-1': 0 };
  for (const from of nodes) for (const to of nodes) {
    if (from !== to) travelMinutes[`${from}->${to}`] = 2;
  }
  return {
    nowMinute: 600,
    tenantId: neutralFixture.tenantId,
    orders: neutralFixture.orders.map((order) => ({
      id: order.id, tenantId: neutralFixture.tenantId, storeId: neutralFixture.store.id,
      pickupNode: neutralFixture.store.id, dropoffNode: order.id, state: 'candidate',
      createdMinute: 600 - order.ageMinutes, readyMinute: 600, deadlineMinute: 720,
      serviceMinutes: 1, loadUnits: 1,
    })),
    drivers: [{
      id: 'driver-1', tenantId: neutralFixture.tenantId, positionNode: 'driver-position',
      online: true, sessionActive: true, gpsFresh: true, routeFeasible: true,
      capacityUnits: 4, currentLoadUnits: 0, assignmentsLastHour: 0, shiftEndsMinute: 780,
    }],
    travelMinutes, pickupServiceMinutes: 1, maxBundleOrders: bundleSize, maxDriverWaitMinutes: 10,
  };
}

test('captured pure production optimizer decisions match the independent oracle for dynamic bundle sizes', () => {
  const captured: CapturedRow[] = [];
  for (let bundleSize = 1; bundleSize <= neutralFixture.orders.length; bundleSize += 1) {
    const production = captureProduction(bundleSize);
    assert.equal(production.algorithmVersion, ADAPTIVE_DISPATCH_VERSION);
    const comparison = compareProductionDecisionToOracle(oracleInput(bundleSize), {
      algorithmVersion: production.algorithmVersion,
      assignments: production.assignments,
      unassignedOrderIds: production.unassignedOrderIds,
    });
    captured.push({
      bundleSize,
      algorithmVersion: production.algorithmVersion,
      productionAssignments: comparison.normalizedProductionAssignments,
      oracleAssignments: comparison.normalizedOracleAssignments,
      verdict: comparison.verdict,
      assignedOrderGap: comparison.objectiveDelta?.assignedOrderGap ?? null,
    });
  }
  const retained = JSON.parse(readFileSync(join(
    process.cwd(), 'tests/driver-system-lab/adapters/captured/adaptive-capture.expected.json',
  ), 'utf8'));
  assert.deepEqual(captured, retained);
  assert.ok(captured.every(({ verdict }) => verdict === 'EXACT_MATCH'));
});
