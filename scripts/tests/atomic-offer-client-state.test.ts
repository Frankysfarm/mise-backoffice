import assert from 'node:assert/strict';
import {
  applySuccessfulClientTransition,
  integrateCanonicalOffer,
  parseCanonicalOffer,
  prepareClientTransition,
} from '../../app/fahrer/app/atomic-offer-client-state';

const offerId = '11111111-1111-4111-8111-111111111111';
const transitionKey = '22222222-2222-4222-8222-222222222222';
const initial = integrateCanonicalOffer(null, {
  offerId,
  assignmentVersion: 1,
  batchId: 'batch-1',
});
assert.ok(initial);

let uuidCalls = 0;
const first = prepareClientTransition(initial, 'accept', () => {
  uuidCalls += 1;
  return transitionKey;
});
const retry = prepareClientTransition(first.offer, 'accept', () => {
  uuidCalls += 1;
  return '33333333-3333-4333-8333-333333333333';
});
assert.equal(first.payload.transition_key, transitionKey);
assert.equal(retry.payload.transition_key, transitionKey);
assert.equal(uuidCalls, 1, 'retry must reuse the persisted transition key');
assert.equal(retry.payload.assignment_version, 1);

const accepted = applySuccessfulClientTransition(first.offer, 'accept', {
  ok: true,
  offer_id: offerId,
  assignment_version: 2,
});
assert.ok(accepted);
assert.equal(accepted.assignmentVersion, 2);

const failed = applySuccessfulClientTransition(accepted, 'picked_up', {
  ok: false,
  offer_id: offerId,
  assignment_version: 3,
});
assert.deepEqual(failed, accepted, 'failed responses must not advance local version');

const wrongOffer = applySuccessfulClientTransition(accepted, 'picked_up', {
  ok: true,
  offer_id: '44444444-4444-4444-8444-444444444444',
  assignment_version: 3,
});
assert.deepEqual(wrongOffer, accepted);

const completed = applySuccessfulClientTransition(accepted, 'complete', {
  ok: true,
  offer_id: offerId,
  assignment_version: 3,
});
assert.equal(completed, null, 'terminal success must clear canonical offer state');

const newer = integrateCanonicalOffer(accepted, {
  offerId,
  assignmentVersion: 1,
});
assert.equal(newer?.assignmentVersion, 2, 'stale push must not roll version backwards');

assert.equal(parseCanonicalOffer({
  offerId,
  assignmentVersion: 1,
  transitionKeys: { accept: 'not-a-uuid' },
})?.transitionKeys.accept, undefined);
assert.equal(parseCanonicalOffer({ offerId: 'bad', assignmentVersion: 1 }), null);

console.log('atomic offer client state tests: PASS');
