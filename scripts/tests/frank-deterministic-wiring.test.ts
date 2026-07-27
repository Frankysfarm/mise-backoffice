import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('lib/frank.ts', 'utf8');

assert.match(source, /selectedWriter === 'atomic_v2' && atomicAssignmentV2Enabled/);
assert.match(source, /T07_CANONICAL_WRITER_REQUIRED/);
assert.match(source, /deterministicPolicy\.continueIncumbent/);
assert.doesNotMatch(source, /deterministicMode === 'shadow'\)\s*return 'held'/);
assert.match(source, /T07_CANDIDATE_SELECTED_PENDING_CAS/);
assert.match(source, /deterministicActionId \?\? undefined/);
assert.match(source, /const decisionId = actionId \?\? randomUUID\(\)/);
assert.match(source, /T07_ASSIGNMENT_COMMITTED/);
assert.match(source, /correlationId: created\.correlationId/);
assert.match(source, /T07_ATOMIC_CAS_REJECTED/);
assert.match(source, /activeStopsByDriver/);
assert.match(source, /\.limit\(500\)/);
assert.match(source, /\.limit\(2000\)/);
assert.match(source, /\.limit\(5000\)/);
const finishDeclaration = source.indexOf('const finish = async');
assert.ok(finishDeclaration > 0);
assert.doesNotMatch(source.slice(0, finishDeclaration), /\bfinish\(/);
assert.doesNotMatch(
  source.slice(
    source.indexOf("if (!addr)"),
    source.indexOf("try {", source.indexOf("if (!addr)")),
  ),
  /\bfinish\(/,
);
const intelligentFailure = source.slice(
  source.indexOf('if (detailsError || recentError || tenantError || deadlineError)'),
  source.indexOf('const recentRows'),
);
assert.match(
  intelligentFailure,
  /return finish\('held', null, 'INTELLIGENT_INPUT_LOAD_FAILED'\)/,
);

console.log('frank deterministic wiring tests: PASS');
