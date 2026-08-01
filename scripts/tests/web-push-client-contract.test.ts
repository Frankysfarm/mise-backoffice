import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MAX_PROCESSED_NOTIFICATION_IDS,
  PUSH_PROCESSED_KEY,
  isDriverPushExpired,
  parseDriverPushNotification,
  readNotificationIds,
  rememberProcessedNotification,
} from '../../app/fahrer/app/push-notification-contract';

const future = new Date(Date.now() + 60_000).toISOString();
const valid = parseDriverPushNotification({
  data: {
    notification_id: 'notification-1',
    assignment_id: 'assignment-1',
    assignment_version: 4,
    expires_at: future,
  },
});
assert.deepEqual(valid, {
  notificationId: 'notification-1', assignmentId: 'assignment-1',
  assignmentVersion: 4, expiresAt: future,
});
assert.equal(parseDriverPushNotification({ notification_id: 'notification-1' }), null);
assert.equal(parseDriverPushNotification({
  notification_id: 'notification-1', assignment_id: 'assignment-1', assignment_version: 0,
}), null);
assert.equal(isDriverPushExpired({ ...valid!, expiresAt: new Date(Date.now() - 1).toISOString() }), true);

const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value); },
};
for (let i = 0; i < MAX_PROCESSED_NOTIFICATION_IDS + 20; i++) {
  rememberProcessedNotification(storage, `notification-${i}`);
}
const ids = readNotificationIds(storage, PUSH_PROCESSED_KEY);
assert.equal(ids.length, MAX_PROCESSED_NOTIFICATION_IDS);
assert.equal(ids.at(-1), `notification-${MAX_PROCESSED_NOTIFICATION_IDS + 19}`);

const sw = readFileSync('public/sw.js', 'utf8');
const register = readFileSync('app/fahrer/app/push-register.tsx', 'utf8');
assert.match(sw, /notification_id/);
assert.match(sw, /assignment_version/);
assert.match(sw, /claimDriverPush/);
assert.match(sw, /previousVersion >= payload\.assignment_version/);
assert.match(sw, /Date\.parse\(payload\.expires_at\) <= Date\.now\(\)/);
assert.ok(sw.indexOf('claimDriverPush(payload)') < sw.indexOf('showNotification(payload.title'));
assert.match(sw, /DRAIN_DRIVER_PUSHES/);
assert.match(register, /DRIVER_PUSH_RECEIVED/);
assert.ok(register.indexOf('accessToken = await reconcileSnapshot()') < register.indexOf("fetch('/api/driver/v2/notifications/ack'"));
assert.match(register, /rememberProcessedNotification/);

console.log('web push client contract tests passed');
