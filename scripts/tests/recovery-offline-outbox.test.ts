import assert from 'node:assert/strict';
import {
  enqueueOfflineRequest, executeDriverV2OrQueue, parseOfflineOutbox, readOfflineOutbox,
  replayOfflineOutbox,
} from '../../app/fahrer/app/offline-outbox';

const id1 = '10000000-0000-4000-8000-000000000001';
const action = {
  version: 1, actionId: id1, action: 'complete_stop', endpoint: '/api/driver/v2/stops/complete',
  method: 'POST', body: {
    action_id: id1, expected_state: 'delivering',
    expected_versions: { driver: 7, order: 7, assignment: 7, trip: 7, route: 7, stop: 7 },
  },
  headers: { 'Content-Type': 'application/json' }, createdAt: '2026-07-27T00:00:00.000Z',
  expectedVersion: 7, attempts: 0, terminalResult: null, requestFingerprint: 'bad',
};

assert.equal(parseOfflineOutbox(JSON.stringify({ version: 1, actions: [action] })).actions.length, 0,
  'tampered fingerprint is quarantined');
assert.deepEqual(parseOfflineOutbox('{bad json').actions, []);
assert.deepEqual(parseOfflineOutbox(JSON.stringify([{
  id: 'legacy', url: '/api/driver/v1/orders/accept', method: 'POST',
  body: '{}', headers: {}, queuedAt: '2026-07-27T00:00:00.000Z',
}])).actions, [], 'legacy compatibility replay is bounded and default-off');
assert.equal(parseOfflineOutbox(JSON.stringify([{
  id: 'legacy', url: '/api/driver/v1/orders/accept', method: 'POST',
  body: '{}', headers: {}, queuedAt: '2026-07-27T00:00:00.000Z',
}])).quarantine.length, 1, 'old queue is retained rather than silently deleted');
assert.equal(parseOfflineOutbox(JSON.stringify({ version: 2, actions: [action] })).actions.length, 0);

const memory = new Map<string, string>();
Object.assign(globalThis, {
  window: globalThis,
  localStorage: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
  },
});

const duplicateId = '10000000-0000-4000-8000-000000000002';
enqueueOfflineRequest('/api/driver/v2/stops/complete', 'complete_stop', {
  action_id: duplicateId, expected_state: 'delivering',
  expected_versions: { driver: 4, order: 4, assignment: 4, trip: 4, route: 4, stop: 4 },
});
enqueueOfflineRequest('/api/driver/v2/stops/complete', 'complete_stop', {
  action_id: duplicateId, expected_state: 'delivering',
  expected_versions: { driver: 4, order: 4, assignment: 4, trip: 4, route: 4, stop: 4 },
});
assert.equal(readOfflineOutbox().actions.length, 1, 'duplicate offline action is queued once');
assert.throws(() => enqueueOfflineRequest('/api/driver/v2/stops/complete', 'complete_stop', {
  action_id: duplicateId, expected_state: 'delivering',
  expected_versions: { driver: 5, order: 4, assignment: 4, trip: 4, route: 4, stop: 4 },
}), /DIFFERENT_REQUEST/);
assert.throws(() => enqueueOfflineRequest('https://evil.invalid/replay', 'complete_stop', {
  action_id: crypto.randomUUID(), expected_state: 'delivering', expected_versions: { driver: 1 },
}), /MISMATCH/);

let online = false;
Object.assign(globalThis, {
  fetch: async () => {
    if (!online) throw new Error('offline');
    return new Response(JSON.stringify({
      ok: true, snapshot: { api_version: 'driver-v2', driver: { id: 'driver-1' } },
    }), { status: 200 });
  },
});
await replayOfflineOutbox();
assert.equal(readOfflineOutbox().actions[0].attempts, 1, 'network-offline action remains queued');
online = true;
let appliedReplaySnapshot: unknown = null;
await Promise.all([
  replayOfflineOutbox({ applySnapshot: (snapshot) => { appliedReplaySnapshot = snapshot; } }),
  replayOfflineOutbox(),
]);
const terminal = readOfflineOutbox().actions[0].terminalResult;
assert.equal(terminal?.ok, true, 'duplicate reconnect replay is coalesced and terminal evidence retained');
assert.equal((appliedReplaySnapshot as { api_version?: string } | null)?.api_version, 'driver-v2',
  'successful offline replay applies its canonical response snapshot');

memory.clear();
const reverseId = '10000000-0000-4000-8000-000000000003';
enqueueOfflineRequest('/api/driver/v2/stops/complete', 'complete_stop', {
  action_id: reverseId, expected_state: 'delivering',
  expected_versions: { driver: 6, order: 6, assignment: 6, trip: 6, route: 6, stop: 6 },
});
let reconciled = 0;
Object.assign(globalThis, {
  fetch: async () => new Response(JSON.stringify({ reason_code: 'EXPECTED_VERSION_CONFLICT' }), { status: 409 }),
});
await replayOfflineOutbox({ reconcileSnapshot: async () => { reconciled++; } });
assert.equal(reconciled, 1, 'out-of-order conflict fetches canonical snapshot');
assert.equal(readOfflineOutbox().actions[0].terminalResult?.status, 409);

memory.clear();
Object.assign(globalThis, { fetch: async () => { throw new Error('network'); } });
const queued = await executeDriverV2OrQueue('/api/driver/v2/session/start', 'start_shift', {
  action_id: '10000000-0000-4000-8000-000000000004',
  expected_state: 'offline', expected_versions: { driver: 1 },
}, {});
assert.equal(queued.queued, true, 'integration seam queues canonical v2 network failure');

memory.clear();
Object.assign(globalThis, {
  fetch: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
});
const onlineAttempt = await executeDriverV2OrQueue('/api/driver/v2/session/start', 'start_shift', {
  action_id: '10000000-0000-4000-8000-000000000005',
  expected_state: 'offline', expected_versions: { driver: 1 },
}, {});
assert.equal(onlineAttempt.queued, false, 'online success remains an immediate response');
assert.equal(readOfflineOutbox().actions.length, 0, 'online success is not redundantly queued');

let directConflictReconcile = 0;
Object.assign(globalThis, {
  fetch: async () => new Response(JSON.stringify({ reason_code: 'EXPECTED_VERSION_CONFLICT' }), { status: 409 }),
});
const conflict = await executeDriverV2OrQueue('/api/driver/v2/session/start', 'start_shift', {
  action_id: '10000000-0000-4000-8000-000000000006',
  expected_state: 'offline', expected_versions: { driver: 1 },
}, { reconcileSnapshot: async () => { directConflictReconcile++; } });
assert.equal(conflict.response?.status, 409);
assert.equal(directConflictReconcile, 1, 'online 409 reconciles canonical snapshot before returning');

console.log('recovery offline outbox tests passed');
