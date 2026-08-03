import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const clientPath = 'app/(admin)/dispatch/client.tsx';
const routePath = 'app/api/delivery/admin/manual-assign/route.ts';

test('Dispatcher UI has one fail-closed manual assignment boundary', async () => {
  const source = await readFile(clientPath, 'utf8');
  assert.match(source, /fetch\('\/api\/delivery\/admin\/manual-assign'/);
  assert.doesNotMatch(source, /rpc\('assign_to_driver'/);
  assert.doesNotMatch(source, /from\('delivery_batches'\)[\s\S]{0,250}\.insert\(/);
  assert.match(source, /manualAssignKeysRef/);
  assert.match(source, /Promise<boolean>/);
  assert.match(source, /if \(await onAssign\(orderIds, bestDriver\.employee_id\)\) setDismissed/);
  assert.match(source, /if \(await onAssign\(\[topOrder!\.id\], bestDriver\.employee_id\)\)/);
  assert.equal((source.match(/return await assignToDriver\(driverId, orderIds\)/g) ?? []).length, 0,
    'removed diagnostic assignment adapters must not remain in the startup board');
  assert.match(source, /onAssign=\{\(\) => assignToDriver\(d\.employee_id\)\}/,
    'canonical driver row must retain the single manual-assignment boundary');
  assert.doesNotMatch(source, /DispatchPhase1223FahrerEinsatzPlaner|DispatchPhase1838FreierFahrerSofortZuweisung|DispatchBatchReassignDialog/);
});

test('manual assignment route requires tenant role and atomic-v2 writer', async () => {
  const source = await readFile(routePath, 'utf8');
  assert.match(source, /getAdminContext\(\)/);
  assert.match(source, /ASSIGN_ROLES/);
  assert.match(source, /selectedDispatchWriter\(service, context\.tenant_id\) !== 'atomic_v2'/);
  assert.doesNotMatch(source, /claimAtomicWriterV2/);
  assert.match(source, /from\('dispatch_writer_gates'\)/);
  assert.match(source, /ACTIVE_WRITER_LEASE_REQUIRED/);
  assert.match(source, /canonicalOrderIds.*sort/);
  assert.match(source, /\.order\('id', \{ ascending: true \}\)/);
  assert.match(source, /from\('dispatch_assignment_requests_v2'\)/);
  assert.match(source, /IDEMPOTENCY_REPLAY_IDENTITY_MISMATCH/);
  assert.ok(source.indexOf("from('dispatch_assignment_requests_v2')") < source.indexOf('selectedDispatchWriter(service'));
  assert.match(source, /createAtomicAssignmentV2/);
  assert.match(source, /if \(!result\.ok\) return rejectAtomicDecision/);
  assert.match(source, /ok: false, reason_code: reason, retryable: true/);
  assert.doesNotMatch(source, /mock-fallback|ok:\s*true.*catch/s);
});

test('unsafe legacy assignment endpoints are fail-closed tombstones', async () => {
  for (const path of [
    'app/api/delivery/admin/batch-assign/route.ts',
    'app/api/delivery/admin/auto-zuweisung/route.ts',
    'app/api/delivery/admin/batch-reassign/route.ts',
  ]) {
    const source = await readFile(path, 'utf8');
    assert.match(source, /status: 410/);
    assert.doesNotMatch(source, /createServiceClient|\.update\(|\.insert\(|mock-fallback|erfolg:\s*true/);
  }
});
