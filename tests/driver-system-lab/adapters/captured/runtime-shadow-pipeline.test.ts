import assert from 'node:assert/strict';
import test from 'node:test';
import { captureAdaptiveDispatchRuntimeShadow, type RuntimeDispatchSnapshot, type RuntimeStop } from '../../../../lib/delivery/adaptive-dispatch-runtime-shadow';
import { compareProductionDecisionToOracle } from '../production-oracle-comparison';
import type { OracleInput } from '../../oracle/types';

const evaluatedAt = '2026-08-04T10:00:00.000Z';
const ids = (prefix: string, count: number) => Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`);

function subsets(values: readonly string[], maximum: number): string[][] {
  const result: string[][] = [];
  const visit = (offset: number, selected: string[]) => {
    if (selected.length) result.push([...selected]);
    if (selected.length === maximum) return;
    for (let index = offset; index < values.length; index += 1) visit(index + 1, [...selected, values[index]]);
  };
  visit(0, []);
  return result;
}

function stops(storeId: string, orderIds: readonly string[], existing: readonly RuntimeStop[] = []): RuntimeStop[] {
  return [
    ...existing.map((stop, index) => ({ ...stop, sequence: index + 1 })),
    { kind: 'pickup', orderId: orderIds[0], storeId, sequence: existing.length + 1 },
    ...orderIds.map((orderId, index) => ({ kind: 'dropoff' as const, orderId, storeId, sequence: existing.length + index + 2 })),
  ];
}

function snapshot(driverCount: 2 | 4): RuntimeDispatchSnapshot {
  const storeA = ids('a', 4); const storeB = ids('b', 2);
  const orders = [...storeA.map((id, index) => ({
    id, storeId: 'store-a', pickup: { lat: 52.5, lng: 13.4 }, dropoff: { lat: 52.51 + index * .001, lng: 13.41 },
    readyAt: new Date(Date.parse(evaluatedAt) + index * 60_000).toISOString(),
    deadlineAt: new Date(Date.parse(evaluatedAt) + (index === 0 ? 24 : 70) * 60_000).toISOString(),
    serviceMinutes: 1, routeFeasible: true, endangered: index === 0,
  })), ...storeB.map((id, index) => ({
    id, storeId: 'store-b', pickup: { lat: 52.6, lng: 13.5 }, dropoff: { lat: 52.61 + index * .001, lng: 13.51 },
    readyAt: new Date(Date.parse(evaluatedAt) + (8 + index) * 60_000).toISOString(),
    deadlineAt: new Date(Date.parse(evaluatedAt) + 80 * 60_000).toISOString(),
    serviceMinutes: 1, routeFeasible: true, endangered: false,
  }))];
  const drivers: Array<RuntimeDispatchSnapshot['drivers'][number]> = [
    { id: 'car-primary', vehicle: 'car', online: true, sessionActive: true, gps: { lat: 52.5, lng: 13.4 }, gpsAgeSeconds: 5, gpsAccuracyM: 4, load: 0, capacity: 4, radiusKm: 25, routeFeasible: true, batteryPct: 80, network: 'good', assignmentsLastHour: 0, existingStops: [] },
    { id: 'bike-primary', vehicle: 'bike', online: true, sessionActive: true, gps: { lat: 52.6, lng: 13.5 }, gpsAgeSeconds: 8, gpsAccuracyM: 5, load: 1, capacity: 2, radiusKm: 12, routeFeasible: true, batteryPct: 70, network: 'good', assignmentsLastHour: 0, existingStops: [{ kind: 'dropoff', orderId: 'incumbent-bike', storeId: 'store-b', sequence: 1 }] },
  ];
  if (driverCount === 4) drivers.push(
    { id: 'car-offline', vehicle: 'car', online: false, sessionActive: false, gps: { lat: 52.5, lng: 13.4 }, gpsAgeSeconds: 5, gpsAccuracyM: 4, load: 0, capacity: 4, radiusKm: 25, routeFeasible: true, batteryPct: 80, network: 'offline', assignmentsLastHour: 0, existingStops: [] },
    { id: 'bike-existing-route', vehicle: 'bike', online: true, sessionActive: true, gps: { lat: 52.55, lng: 13.45 }, gpsAgeSeconds: 5, gpsAccuracyM: 4, load: 2, capacity: 2, radiusKm: 12, routeFeasible: true, batteryPct: 40, network: 'poor', assignmentsLastHour: 2, existingStops: [{ kind: 'dropoff', orderId: 'incumbent-1', storeId: 'store-a', sequence: 1 }] },
  );
  const estimates = [
    ...subsets(storeA, 4).map((orderIds) => ({ driverId: 'car-primary', orderIds, storeId: 'store-a', etaMinutes: 8 + orderIds.reduce((sum, id) => sum + storeA.indexOf(id), 0), detourMinutes: orderIds.length - 1, routeFeasible: true, trafficMatrixVersion: 'traffic-20260804-a', stopSequence: stops('store-a', orderIds) })),
    ...subsets(storeB, 2).map((orderIds) => ({ driverId: 'bike-primary', orderIds, storeId: 'store-b', etaMinutes: 14 + orderIds.reduce((sum, id) => sum + storeB.indexOf(id), 0), detourMinutes: orderIds.length - 1, routeFeasible: true, trafficMatrixVersion: 'traffic-20260804-b', stopSequence: stops('store-b', orderIds, drivers[1].existingStops) })),
  ];
  return { captureId: `tl_runtime_${driverCount}`, evaluatedAt, orders, drivers, routeEstimates: estimates };
}

function oracleInput(runtime: RuntimeDispatchSnapshot, maxBundleOrders: number): OracleInput {
  const travelMinutes: Record<string, number> = {};
  const nodes = [...runtime.drivers.map(({ id }) => `position-${id}`), ...runtime.orders.flatMap(({ storeId, id }) => [storeId, id])];
  for (const from of nodes) for (const to of nodes) if (from !== to) travelMinutes[`${from}->${to}`] = 3;
  delete travelMinutes['position-car-primary->store-b'];
  delete travelMinutes['position-bike-primary->store-a'];
  return {
    nowMinute: 600, tenantId: 'testlab-runtime', pickupServiceMinutes: 1, maxBundleOrders, maxDriverWaitMinutes: 15,
    orders: runtime.orders.map((order, index) => ({ id: order.id, tenantId: 'testlab-runtime', storeId: order.storeId, pickupNode: order.storeId, dropoffNode: order.id, state: 'candidate', createdMinute: order.endangered ? 500 : 550 + index, readyMinute: 600 + (Date.parse(order.readyAt) - Date.parse(evaluatedAt)) / 60_000, deadlineMinute: 600 + (Date.parse(order.deadlineAt) - Date.parse(evaluatedAt)) / 60_000, serviceMinutes: order.serviceMinutes, loadUnits: 1 })),
    drivers: runtime.drivers.map((driver) => ({ id: driver.id, tenantId: 'testlab-runtime', positionNode: `position-${driver.id}`, online: driver.online, sessionActive: driver.sessionActive, gpsFresh: driver.gpsAgeSeconds < 180 && driver.gpsAccuracyM < 200, routeFeasible: driver.routeFeasible, capacityUnits: Math.min(driver.capacity, driver.vehicle === 'bike' ? 2 : 4), currentLoadUnits: driver.load, assignmentsLastHour: driver.assignmentsLastHour, shiftEndsMinute: 800 })),
    travelMinutes,
  };
}

test('runtime shadow compares independent persisted stops across 2/4-driver captures and bundles 1-4', () => {
  for (const driverCount of [2, 4] as const) for (let bundleSize = 1; bundleSize <= 4; bundleSize += 1) {
    const runtime = snapshot(driverCount);
    const expectedOrders = {
      1: { 'car-primary': ['a-1'], 'bike-primary': ['b-1'] },
      2: { 'car-primary': ['a-1', 'a-2'], 'bike-primary': ['b-1'] },
      3: { 'car-primary': ['a-1', 'a-2', 'a-3'], 'bike-primary': ['b-1'] },
      4: { 'car-primary': ['a-1', 'a-2', 'a-3', 'a-4'], 'bike-primary': ['b-1'] },
    }[bundleSize] as Record<string, string[]>;
    // This is the independently retained persisted readback fixture. It is
    // intentionally not derived from the optimizer plan.
    const persisted = { assignments: Object.entries(expectedOrders).map(([driverId, orderIds]) => ({
      driverId,
      orderIds,
      // Model a separately queried persistence rowset. Do not reuse the
      // route-estimate stopSequence that the shadow comparison validates.
      stops: driverId === 'bike-primary'
        ? [
            { kind: 'dropoff' as const, orderId: 'incumbent-bike', storeId: 'store-b', sequence: 1 },
            { kind: 'pickup' as const, orderId: orderIds[0], storeId: 'store-b', sequence: 2 },
            ...orderIds.map((orderId, index) => ({ kind: 'dropoff' as const, orderId, storeId: 'store-b', sequence: index + 3 })),
          ]
        : [
            { kind: 'pickup' as const, orderId: orderIds[0], storeId: 'store-a', sequence: 1 },
            ...orderIds.map((orderId, index) => ({ kind: 'dropoff' as const, orderId, storeId: 'store-a', sequence: index + 2 })),
          ],
    })) };
    const capture = captureAdaptiveDispatchRuntimeShadow(true, runtime, persisted, bundleSize);
    assert.deepEqual(capture.comparison, { assignmentMatch: true, stopSequenceMatch: true, violations: [] });
    assert.equal(capture.runtimeInput.drivers.length, driverCount);
    assert.deepEqual(new Set(capture.runtimeInput.drivers.map(({ vehicle }) => vehicle)), new Set(['bike', 'car']));
    assert.ok(capture.runtimeInput.orders.some(({ endangered }) => endangered));
    assert.ok(capture.runtimeInput.orders.some(({ readyAt }) => readyAt !== evaluatedAt));
    assert.ok(capture.runtimeInput.drivers.some(({ existingStops }) => existingStops.length > 0) || driverCount === 2);
    assert.deepEqual(new Set(capture.runtimeInput.orders.map(({ storeId }) => storeId)), new Set(['store-a', 'store-b']));
    assert.deepEqual(new Set(capture.runtimeInput.routeEstimates.map(({ trafficMatrixVersion }) => trafficMatrixVersion)), new Set(['traffic-20260804-a', 'traffic-20260804-b']));
    const oracle = compareProductionDecisionToOracle(oracleInput(runtime, bundleSize), {
      algorithmVersion: capture.plan.algorithmVersion, assignments: capture.persisted.assignments,
      unassignedOrderIds: capture.plan.unassignedOrderIds,
    }, { maxTravelExcessMinutes: 100, maxWaitExcessMinutes: 100, maxWorstSlackLossMinutes: 100, maxFairnessExcess: 100 });
    assert.equal(oracle.verdict, 'EXACT_MATCH');
    for (const assignment of oracle.oracle.assignments) {
      const persistedAssignment = capture.persisted.assignments.find(({ driverId }) => driverId === assignment.driverId);
      assert.ok(persistedAssignment);
      assert.deepEqual(
        persistedAssignment.stops
          .filter(({ kind, orderId }) => kind === 'dropoff' && assignment.orderIds.includes(orderId))
          .map(({ orderId }) => orderId),
        assignment.route.orderIds,
      );
    }
    assert.deepEqual(captureAdaptiveDispatchRuntimeShadow(true, runtime, persisted, bundleSize), capture);
  }
});

test('runtime shadow is default-off and detects persisted assignment/stop drift', () => {
  const runtime = snapshot(4);
  assert.throws(() => captureAdaptiveDispatchRuntimeShadow(false, runtime, { assignments: [] }, 4), /RUNTIME_CAPTURE_DISABLED/);
  const capture = captureAdaptiveDispatchRuntimeShadow(true, runtime, { assignments: [{ driverId: 'car-primary', orderIds: ['a-1'], stops: [{ kind: 'dropoff', orderId: 'a-1', storeId: 'store-a', sequence: 1 }] }] }, 4);
  assert.equal(capture.comparison.assignmentMatch, false);
  assert.equal(capture.comparison.stopSequenceMatch, false);

  const stopOnlyDrift = captureAdaptiveDispatchRuntimeShadow(true, runtime, {
    assignments: [
      { driverId: 'car-primary', orderIds: ['a-1', 'a-2', 'a-3', 'a-4'], stops: [
        { kind: 'pickup', orderId: 'a-1', storeId: 'store-a', sequence: 1 },
        { kind: 'dropoff', orderId: 'a-2', storeId: 'store-a', sequence: 2 },
        { kind: 'dropoff', orderId: 'a-1', storeId: 'store-a', sequence: 3 },
        { kind: 'dropoff', orderId: 'a-3', storeId: 'store-a', sequence: 4 },
        { kind: 'dropoff', orderId: 'a-4', storeId: 'store-a', sequence: 5 },
      ] },
      { driverId: 'bike-primary', orderIds: ['b-1'], stops: [
        { kind: 'dropoff', orderId: 'incumbent-bike', storeId: 'store-b', sequence: 1 },
        { kind: 'pickup', orderId: 'b-1', storeId: 'store-b', sequence: 2 },
        { kind: 'dropoff', orderId: 'b-1', storeId: 'store-b', sequence: 3 },
      ] },
    ],
  }, 4);
  assert.equal(stopOnlyDrift.comparison.assignmentMatch, true);
  assert.equal(stopOnlyDrift.comparison.stopSequenceMatch, false);
  assert.deepEqual(stopOnlyDrift.comparison.violations, ['PERSISTED_STOP_SEQUENCE_MISMATCH:car-primary']);
});
