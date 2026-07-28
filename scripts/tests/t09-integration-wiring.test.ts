import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const overrideApi = readFileSync('app/api/admin/operations/override/route.ts', 'utf8');
const snapshotApi = readFileSync('app/api/admin/operations/snapshot/route.ts', 'utf8');
const tick = readFileSync('app/api/driver/v1/internal/dispatch-tick/route.ts', 'utf8');
const monitor = readFileSync('lib/delivery/ops-monitor-worker.ts', 'utf8');

for (const token of [
  'getAdminContext', 'validateManualOverrideEvidence', 'context.tenant_id',
  'context.employee_id', 'fn_ops_manual_override_v2',
]) assert.ok(overrideApi.includes(token), `override API missing ${token}`);
assert.ok(overrideApi.includes("'OPS_OVERRIDE_RPC_FAILED'"));
assert.ok(!overrideApi.includes('NextResponse.json({ error })'),
  'database error objects must not leak from override API');
for (const token of [
  "eq('tenant_id', context.tenant_id)", 'ops_alert_episodes_v2',
  'ops_manual_override_requests_v2', 'dispatch_kitchen_holds_v2',
  'dispatch_writer_gates',
]) assert.ok(snapshotApi.includes(token), `snapshot API missing ${token}`);
assert.ok(tick.includes('runOpsMonitorWorker'));
for (const token of [
  'overdue_hold_count', 'WRITER_LEASE_LOST',
  'mise_driver_position_current', 'mise_push_outbox',
  'ops_worker_heartbeats_v2', 'fn_ops_record_alert_v2',
]) assert.ok(monitor.includes(token), `monitor missing ${token}`);

console.log('T09 API and monitor wiring: PASS');
