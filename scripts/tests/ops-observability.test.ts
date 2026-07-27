import assert from 'node:assert/strict';
import {
  assertTenantMutationEnabled, canReadOperationalResource, createOpsEvent,
  evaluateOpsAlerts, redactOpsAttributes, retentionCutoff, validateManualOverrideEvidence,
} from '../../lib/delivery/ops-observability';

const correlationId = '10000000-0000-4000-8000-000000000001';
const actorId = '20000000-0000-4000-8000-000000000002';
const event = createOpsEvent({
  tenant_id: 'tenant-a',
  correlation_id: correlationId,
  event_type: 'driver.gps.rejected',
  severity: 'warning',
  reason_code: 'STALE_OR_UNTRUSTED_GPS',
  resource_kind: 'gps',
  resource_id: 'gps-row-private',
  actor_role: 'driver',
  actor_id: actorId,
  occurred_at: '2026-07-27T10:00:00.000Z',
  attributes: {
    accuracy_m: 40,
    latitude: 50.775,
    nested: { customer_address: 'Private Street 1', token: 'secret', safe_count: 3 },
    platform: 'ios',
    payload: 'customer data must not escape',
    message: 'Bearer private',
    apiKey: 'private-key',
    details: { harmless_count: 2, free_text: 'Private Street 1' },
  },
});
assert.equal(event.correlation_id, correlationId);
assert.equal(event.attributes.latitude, '[REDACTED]');
assert.deepEqual(event.attributes.nested, {
  customer_address: '[REDACTED]', token: '[REDACTED]', safe_count: 3,
});
assert.notEqual(event.actor_id_hash, actorId);
assert.notEqual(event.resource_id_hash, 'gps-row-private');
assert.equal(event.attributes.platform, 'ios');
assert.equal(event.attributes.payload, '[REDACTED]');
assert.equal(event.attributes.message, '[REDACTED]');
assert.equal(event.attributes.apiKey, '[REDACTED]');
assert.deepEqual(event.attributes.details, { harmless_count: 2, free_text: '[REDACTED]' });
assert.throws(() => createOpsEvent({ ...event as any, correlation_id: 'bad' }), /CORRELATION_ID_INVALID/);
assert.equal(redactOpsAttributes({ authorization: 'Bearer private' }).authorization, '[REDACTED]');
assert.equal(redactOpsAttributes({ customerAddress: 'Private Street 1' }).customerAddress, '[REDACTED]');

const alerts = evaluateOpsAlerts({
  now: '2026-07-27T10:10:00.000Z',
  oldest_unassigned_at: '2026-07-27T10:00:00.000Z',
  duplicate_assignment_attempts: 1,
  dispatch_failures: 2,
  oldest_trusted_gps_at: '2026-07-27T10:08:00.000Z',
  untrusted_gps_events: 3,
  oldest_unacked_push_at: '2026-07-27T10:07:00.000Z',
  overdue_hold_count: 1,
  queue_backlog_count: 30,
  nearest_delivery_deadline_at: '2026-07-27T10:11:00.000Z',
  worker_last_success_at: '2026-07-27T10:05:00.000Z',
  app_errors: 6,
  app_requests: 100,
}, {
  unassigned_order_age_seconds: 300,
  stale_gps_seconds: 90,
  push_ack_seconds: 120,
  queue_backlog_count: 25,
  worker_heartbeat_seconds: 180,
  delivery_risk_seconds: 120,
  app_error_rate: 0.05,
});
assert.deepEqual(new Set(alerts.map((row) => row.reason_code)), new Set([
  'UNASSIGNED_ORDER_AGE', 'DUPLICATE_ASSIGNMENT_ATTEMPT', 'DISPATCH_FAILURE',
  'STALE_OR_UNTRUSTED_GPS', 'PUSH_ACK_OVERDUE', 'HOLD_DEADLINE_OVERDUE',
  'QUEUE_BACKLOG', 'DELIVERY_DEADLINE_RISK', 'WORKER_HEARTBEAT_OVERDUE',
  'APP_VERSION_ERROR_RATE',
]));
assert.equal(alerts.filter((row) => row.reason_code === 'STALE_OR_UNTRUSTED_GPS').length, 2,
  'stale trusted state and rejected/untrusted events are independently observable');
assert.equal(evaluateOpsAlerts({ now: '2026-07-27T10:10:00.000Z' }, {
  unassigned_order_age_seconds: 300, stale_gps_seconds: 90, push_ack_seconds: 120,
  queue_backlog_count: 25, worker_heartbeat_seconds: 180,
  delivery_risk_seconds: 120, app_error_rate: 0.05,
}).length, 0, 'missing observations do not invent alerts');
assert.throws(() => evaluateOpsAlerts({ now: '2026-07-27T10:10:00.000Z' }, {
  unassigned_order_age_seconds: -1, stale_gps_seconds: 90, push_ack_seconds: 120,
  queue_backlog_count: 25, worker_heartbeat_seconds: 180,
  delivery_risk_seconds: 120, app_error_rate: 0.05,
}), /OPS_THRESHOLDS_INVALID/);

assert.doesNotThrow(() => validateManualOverrideEvidence({
  actor_id: actorId, actor_role: 'dispatcher', reason_code: 'VEHICLE_FAILURE',
  note: 'Driver reported a vehicle failure.', expected_version: 7,
  action_id: '30000000-0000-4000-8000-000000000003', correlation_id: correlationId,
}));
assert.throws(() => validateManualOverrideEvidence({
  actor_id: actorId, actor_role: 'driver' as any, reason_code: 'OTHER',
  note: 'Not authorized.', expected_version: 7,
  action_id: '30000000-0000-4000-8000-000000000003', correlation_id: correlationId,
}), /OVERRIDE_ACTOR_FORBIDDEN/);
assert.throws(() => validateManualOverrideEvidence({
  actor_id: actorId, actor_role: 'admin', reason_code: 'OTHER', note: 'short',
  expected_version: 7, action_id: '30000000-0000-4000-8000-000000000003',
  correlation_id: correlationId,
}), /OVERRIDE_NOTE_INVALID/);

assert.throws(() => assertTenantMutationEnabled('tenant-a', {
  tenant_id: 'tenant-a', dispatch_enabled: false, mutation_enabled: true, observability_enabled: true,
}), /TENANT_DISPATCH_KILL_SWITCH_ACTIVE/);
assert.throws(() => assertTenantMutationEnabled('tenant-a', {
  tenant_id: 'tenant-a', dispatch_enabled: true, mutation_enabled: false, observability_enabled: true,
}), /TENANT_MUTATION_DEFAULT_OFF/);
assert.doesNotThrow(() => assertTenantMutationEnabled('tenant-a', {
  tenant_id: 'tenant-a', dispatch_enabled: true, mutation_enabled: true, observability_enabled: true,
}));
assert.throws(() => assertTenantMutationEnabled('tenant-a', {
  tenant_id: 'tenant-b', dispatch_enabled: true, mutation_enabled: true, observability_enabled: true,
}), /TENANT_POLICY_SCOPE_MISMATCH/);

assert.equal(canReadOperationalResource(
  { role: 'driver', tenant_id: 'tenant-a', driver_id: 'driver-a' },
  { tenant_id: 'tenant-a', kind: 'assignment', driver_id: 'driver-a' },
), true);
assert.equal(canReadOperationalResource(
  { role: 'driver', tenant_id: 'tenant-a', driver_id: 'driver-a' },
  { tenant_id: 'tenant-a', kind: 'assignment', driver_id: 'driver-b' },
), false, 'driver cannot read another driver');
assert.equal(canReadOperationalResource(
  { role: 'dispatcher', tenant_id: 'tenant-a' },
  { tenant_id: 'tenant-b', kind: 'order' },
), false, 'cross-tenant dispatcher access denied');
assert.equal(canReadOperationalResource(
  { role: 'kitchen', tenant_id: 'tenant-a' },
  { tenant_id: 'tenant-a', kind: 'gps', driver_id: 'driver-a' },
), false, 'kitchen cannot read driver location');
assert.equal(canReadOperationalResource(
  { role: 'kitchen', tenant_id: 'tenant-a' },
  { tenant_id: 'tenant-a', kind: 'hold' },
), true);

assert.equal(retentionCutoff('2026-07-27T00:00:00.000Z', 30), '2026-06-27T00:00:00.000Z');
assert.throws(() => retentionCutoff('2026-07-27T00:00:00.000Z', 0), /RETENTION_DAYS_INVALID/);
assert.throws(() => retentionCutoff('2026-07-27T00:00:00.000Z', 366), /RETENTION_DAYS_INVALID/);

console.log('ops observability contract tests: ok');
