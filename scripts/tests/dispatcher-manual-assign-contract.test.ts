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
});

test('manual assignment route requires tenant role and atomic-v2 writer', async () => {
  const source = await readFile(routePath, 'utf8');
  assert.match(source, /getAdminContext\(\)/);
  assert.match(source, /ASSIGN_ROLES/);
  assert.match(source, /selectedDispatchWriter\(service, context\.tenant_id\) !== 'atomic_v2'/);
  assert.match(source, /claimAtomicWriterV2/);
  assert.match(source, /createAtomicAssignmentV2/);
  assert.doesNotMatch(source, /mock-fallback|ok:\s*true.*catch/s);
});
