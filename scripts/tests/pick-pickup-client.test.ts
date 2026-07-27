import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildAtomicPickupManifest } from '../../lib/delivery/driver-v2-pick-contract';
import type { DriverV2Snapshot } from '../../lib/delivery/driver-v2-contract';

const snapshot = {
  trip: { id: 'batch', state: 'at_pickup', version: 5, route_version: 2 },
  orders: [
    { id: 'order-b', state: 'assigned', version: 3 },
    { id: 'order-a', state: 'assigned', version: 4 },
    { id: 'order-cancelled', state: 'cancelled', version: 6 },
  ],
  assignments: [
    { id: 'assignment-b', order_id: 'order-b', tenant_id: 'tenant', state: 'assigned', version: 1 },
    { id: 'assignment-a', order_id: 'order-a', tenant_id: 'tenant', state: 'assigned', version: 2 },
    { id: 'assignment-cancelled', order_id: 'order-cancelled', tenant_id: 'tenant', state: 'cancelled', version: 3 },
  ],
  stops: [
    { id: 'stop-b', order_id: 'order-b', type: 'pickup', version: 8 },
    { id: 'stop-a', order_id: 'order-a', type: 'pickup', version: 7 },
    { id: 'stop-cancelled', order_id: 'order-cancelled', type: 'pickup', version: 2 },
  ],
  items: [
    { id: 'item-b', order_id: 'order-b' },
    { id: 'item-a', order_id: 'order-a' },
    { id: 'item-cancelled', order_id: 'order-cancelled' },
  ],
} as unknown as DriverV2Snapshot;

const manifest = buildAtomicPickupManifest(snapshot, [
  { id: 'item-b', order_id: 'order-b', outcome: 'substituted_approved', evidence: { approval: 'kitchen' } },
  { id: 'item-a', order_id: 'order-a', outcome: 'present_confirmed' },
  { id: 'item-cancelled', order_id: 'order-cancelled', outcome: 'unresolved' },
]);
assert.deepEqual(manifest.map((row) => row.order_id), ['order-a', 'order-b'],
  'server identity determines stable order; driver gets no ordering choice');
assert.equal(manifest[1].items[0].outcome, 'substituted_approved');
assert.equal(manifest.some((row) => row.order_id === 'order-cancelled'), false,
  'reloaded client manifest filters now-cancelled orders and items');
assert.throws(() => buildAtomicPickupManifest(snapshot, [
  { id: 'item-a', order_id: 'order-a', outcome: 'present_confirmed' },
]), /REQUIRED_ITEM_SET_MISMATCH/, 'partial/offline payload cannot omit an assigned item');
assert.throws(() => buildAtomicPickupManifest(snapshot, [
  { id: 'item-a', order_id: 'order-a', outcome: 'present_confirmed' },
  { id: 'item-x', order_id: 'order-b', outcome: 'present_confirmed' },
]), /REQUIRED_ITEM_SET_MISMATCH/, 'data mismatch cannot fabricate an item');
const dialog = readFileSync('app/fahrer/app/pick-dialog.tsx', 'utf8');
const oldConfirm = readFileSync('app/api/driver/v2/pickup/confirm/route.ts', 'utf8');
const oldDepart = readFileSync('app/api/driver/v2/pickup/depart/route.ts', 'utf8');
const atomicRoute = readFileSync('app/api/driver/v2/pickup/atomic/route.ts', 'utf8');
const atomicServer = readFileSync('lib/delivery/driver-v2-pick.ts', 'utf8');
assert.doesNotMatch(dialog, />\\s*Fehlt\\s*</, 'driver has no normal missing-resolution choice');
assert.match(oldConfirm, /LEGACY_SINGLE_ORDER_PICKUP_DISABLED_T04/);
assert.match(oldDepart, /LEGACY_SINGLE_ORDER_DEPART_DISABLED_T04/);
assert.match(atomicRoute, /envelope\.action !== 'atomic_pickup'/);
assert.match(atomicServer, /envelope\.action !== 'atomic_pickup'/);
console.log('T04 pick/pickup client tests: PASS');
