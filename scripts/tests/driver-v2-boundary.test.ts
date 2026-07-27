import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DRIVER_EXCEPTION_KINDS, realtimeRequiresReload, statusForDriverV2Reason,
  resolveSingleOrderItems, validateDriverV2ActionEnvelope, validateDriverV2Envelope,
} from '../../lib/delivery/driver-v2-contract';

const actionId = '10000000-0000-4000-8000-000000000001';
const valid = {
  action_id: actionId,
  expected_state: 'assigned',
  expected_versions: { driver: 4, assignment: 2, trip: 7, route: 3, order: 9, stop: 1 },
  payload: {},
};

assert.equal(validateDriverV2Envelope(valid).action_id, actionId);
validateDriverV2ActionEnvelope('resolve_items', validateDriverV2Envelope(valid));
assert.throws(() => validateDriverV2ActionEnvelope('arrive', validateDriverV2Envelope({
  ...valid, expected_versions: { driver: 4, trip: 7, stop: 1 },
})), /EXPECTED_ROUTE_VERSION_REQUIRED/);
assert.throws(() => validateDriverV2Envelope({ ...valid, action_id: 'x' }), /ACTION_ID_REQUIRED/);
assert.throws(() => validateDriverV2Envelope({ ...valid, expected_versions: { driver: -1 } }), /EXPECTED_DRIVER_VERSION/);
assert.equal(statusForDriverV2Reason('TENANT_OR_ACTOR_AUTHORITY_MISMATCH'), 403, 'other-driver is forbidden');
assert.equal(statusForDriverV2Reason('EXPECTED_VERSION_CONFLICT'), 409, 'stale version conflicts');
assert.equal(statusForDriverV2Reason('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'), 409, 'duplicate mismatch conflicts');
assert.equal(realtimeRequiresReload('snapshot-7', 'snapshot-9'), true, 'Realtime gap invalidates');
assert.equal(realtimeRequiresReload('snapshot-9', 'snapshot-9'), false, 'same snapshot does not reload');
assert.equal(realtimeRequiresReload('snapshot-9', 'snapshot-8'), true, 'out-of-order/different projection reloads');
assert.equal(realtimeRequiresReload('snapshot-9', null), true, 'unknown Supabase event version reloads');
let itemRequestCalls = 0;
assert.throws(() => resolveSingleOrderItems([
  { order_id: 'order-a', id: 'item-a' },
  { order_id: 'order-b', id: 'item-b' },
], async () => { itemRequestCalls += 1; }), /MULTI_ORDER_LIFECYCLE_DEFAULT_OFF/);
assert.equal(itemRequestCalls, 0, 'multi-order is rejected before every resolve-items request');
assert.ok(DRIVER_EXCEPTION_KINDS.includes('medical_safety_emergency'), 'safety exception is enumerated');

const server = readFileSync('lib/delivery/driver-v2-server.ts', 'utf8');
const migration = readFileSync('scripts/migrations/278_driver_v2_api_boundary.sql', 'utf8');
const client = readFileSync('app/fahrer/app/client.tsx', 'utf8');
const deliveryView = readFileSync('app/fahrer/app/delivery-view.tsx', 'utf8');
const decline = readFileSync('app/api/driver/v1/offers/transition/route.ts', 'utf8');
const oldAccept = readFileSync('app/api/driver/v1/_lib/accept-as-ack.ts', 'utf8');

assert.match(server, /loadDriverV2Snapshot\(client, driverId, correlationId\)/, 'every action reloads snapshot with the handler correlation id');
assert.match(server, /GPS_MONOTONIC_PERSISTENCE_T06_DEFAULT_OFF/, 'GPS boundary does not invent T06 persistence');
assert.match(migration, /action_id uuid NOT NULL UNIQUE/, 'exception action replay is unique');
assert.match(migration, /request_fingerprint/, 'item action replay fingerprint is stored');
assert.match(migration, /completed_at timestamptz NOT NULL DEFAULT now\(\)/, 'global registry records completion');
assert.match(migration, /old\.action<>'depart'/, 'depart coordinates through the global registry');
assert.match(migration, /old\.action<>'complete'/, 'complete coordinates through the global registry');
assert.match(migration, /driver_exceptions_v2/, 'safety exception is durably audited');
assert.match(migration, /REVOKE UPDATE \(status, dispatch_version/, 'direct order lifecycle writes denied');
assert.match(migration, /driver_api_compatibility_events_v2/, 'old/new compatibility telemetry exists');
assert.match(decline, /NORMAL_DECLINE_NOT_ALLOWED/, 'normal decline is rejected');
assert.match(oldAccept, /fn_driver_accept_ack_compat_v2/, 'old accept maps only to atomic technical ACK + telemetry');
assert.doesNotMatch(oldAccept, /\.update\(/, 'old accept cannot change lifecycle state');
assert.doesNotMatch(client, /from\('driver_status'\)\.update\(\{\s*last_lat/, 'GPS current state is not directly written');
assert.doesNotMatch(client, /from\('delivery_batch_stops'\)\s*\.update\(\{ geliefert_am/, 'delivery is not directly written');
assert.match(client, /reloadDriverV2Snapshot\(\)\.catch/, 'restart loads server snapshot');
assert.match(client, /window\.addEventListener\('online', reconnect\)/, 'reconnect reloads snapshot');
assert.match(client, /if \(state === 'SUBSCRIBED'\) reloadDriverV2Snapshot/, 'Realtime reconnect unconditionally replaces snapshot');
assert.doesNotMatch(client, /<TourStopQuickActions|<TourStopSchnellQuittierung|<TourStopImpulseKarte|<FahrerPhase2200SmartStoppNaviCockpit|<FahrerPhase2605TourStoppGpsKommandoPro|<FahrerPhase2610TourNavigatorGpsFinal|<Phase2630SmartTourStoppNavigatorUltimateFinal|<FahrerPhase2780TourStoppNavigationsFinalHub|<FahrerPhase2785SmartTourStopsNavigatorPro|<FahrerPhase3200TourStoppSmartKommandoUltra|<FahrerPhase3327TourStopsNaviFinalHub/,
  'active mount oracle excludes legacy critical quick-action widgets');
assert.doesNotMatch(deliveryView, /\.from\('(delivery_batch_stops|mise_delivery_batch_stops|customer_orders|mise_delivery_batches|mise_drivers|driver_status)'\)\s*\.update/,
  'mounted DeliveryView has no canonical direct-write capability');

console.log('driver-v2 boundary tests: ok');
