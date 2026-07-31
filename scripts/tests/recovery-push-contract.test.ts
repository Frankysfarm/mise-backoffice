import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { snapshotThenTechnicalAck } from '../../app/fahrer/app/push-reconcile';
import { applyValidatedDriverSnapshotEvent } from '../../app/fahrer/app/driver-snapshot-event';

const recovery = readFileSync('lib/delivery/recovery.ts', 'utf8');
const push = readFileSync('app/api/driver/v1/internal/push-flush/route.ts', 'utf8');
const register = readFileSync('app/fahrer/app/push-register.tsx', 'utf8');
const cron = readFileSync('app/api/cron/smart-dispatch/route.ts', 'utf8');
const status = readFileSync('app/api/delivery/tours/[id]/status/route.ts', 'utf8');
const client = readFileSync('app/fahrer/app/client.tsx', 'utf8');
const adminRecovery = readFileSync('app/api/delivery/admin/recovery/route.ts', 'utf8');

assert.doesNotMatch(recovery, /dispatchSingleOrder|state:\s*'cancelled'|mise_driver_id:\s*null/);
assert.match(recovery, /STALE_GPS_ACTIVE_WORK/);
assert.match(push, /wake_only:\s*true/);
assert.doesNotMatch(push, /reason_text:\s*row\.body|title:\s*row\.title|body:\s*row\.body/);
assert.doesNotMatch(push, /sendVoipPush|voip_push_token|apns-voip/);
assert.match(push, /sound:\s*isAssign\s*\?\s*'alarm\.caf'/);
assert.match(push, /interruptionLevel:\s*isAssign\s*\?\s*'time-sensitive'/);
assert.match(register, /pushNotificationReceived/);
assert.match(register, /pushNotificationActionPerformed/);
assert.ok(register.indexOf('/api/driver/v2/snapshot') < register.indexOf('/api/driver/v2/notifications/ack'));
assert.match(register, /mise_pending_notification_acks_v1/);
assert.doesNotMatch(cron, /scanStaleBatches\(60\)\.catch/);
assert.doesNotMatch(status, /recoverCancelledBatch\([^;]+\.catch/);
assert.match(client, /executeDriverV2OrQueue/);
assert.match(client, /DRIVER_V2_ACTION_QUEUED_OFFLINE/);
assert.doesNotMatch(adminRecovery, /events:\s*\[\],\s*count:\s*0/);
assert.match(adminRecovery, /RECOVERY_EVENTS_LOOKUP_FAILED/);
assert.match(adminRecovery, /correlation_id/);

const order: string[] = [];
await snapshotThenTechnicalAck('notification', async () => {
  order.push('snapshot');
}, async () => {
  order.push('ack');
});
assert.deepEqual(order, ['snapshot', 'ack']);
await assert.rejects(
  snapshotThenTechnicalAck('notification', async () => {
    throw new Error('snapshot unavailable');
  }, async () => {
    order.push('must-not-ack');
  }),
);
assert.doesNotMatch(order.join(','), /must-not-ack/);

const mountedSnapshots: unknown[] = [];
const snapshot = {
  api_version: 'driver-v2', driver: { id: 'driver-1' },
} as never;
assert.equal(applyValidatedDriverSnapshotEvent(
  { detail: snapshot } as CustomEvent, 'driver-1', (value) => mountedSnapshots.push(value),
), true);
assert.equal(mountedSnapshots.length, 1, 'mounted reconciliation applies matching push snapshot');
assert.equal(applyValidatedDriverSnapshotEvent(
  { detail: snapshot } as CustomEvent, 'other-driver', (value) => mountedSnapshots.push(value),
), false, 'mounted reconciliation rejects another driver snapshot');

console.log('recovery push contract tests passed');
