import assert from 'node:assert/strict';
import {
  atomicTransitionRejectionStatus,
  decideTenantAtomicHandling,
  validateAtomicTransitionInput,
} from '../../lib/delivery/atomic-lifecycle-contract';

const valid = validateAtomicTransitionInput({
  offer_id: '11111111-1111-4111-8111-111111111111',
  assignment_version: 3,
  transition_key: '22222222-2222-4222-8222-222222222222',
});
assert.deepEqual(valid, {
  offerId: '11111111-1111-4111-8111-111111111111',
  assignmentVersion: 3,
  transitionKey: '22222222-2222-4222-8222-222222222222',
});

assert.equal(validateAtomicTransitionInput({
  offer_id: '11111111-1111-4111-8111-111111111111',
  assignment_version: 0,
  transition_key: '22222222-2222-4222-8222-222222222222',
}), null);
assert.equal(validateAtomicTransitionInput({
  offer_id: 'not-an-offer',
  assignment_version: 1,
  transition_key: '22222222-2222-4222-8222-222222222222',
}), null);
assert.equal(validateAtomicTransitionInput({
  offer_id: '11111111-1111-4111-8111-111111111111',
  assignment_version: 1,
}), null);

assert.equal(atomicTransitionRejectionStatus('OFFER_NOT_FOUND'), 404);
assert.equal(atomicTransitionRejectionStatus('ACTOR_DRIVER_MISMATCH'), 403);
assert.equal(atomicTransitionRejectionStatus('SINGLE_WRITER_GATE_CLOSED'), 403);
assert.equal(atomicTransitionRejectionStatus('ASSIGNMENT_VERSION_CONFLICT'), 409);
assert.equal(atomicTransitionRejectionStatus('OFFER_EXPIRED'), 409);
assert.equal(atomicTransitionRejectionStatus('INVALID_ACTION'), 400);

// Mixed-tenant election with the global feature flag conceptually enabled:
// tenant A elected atomic_v1 must provide the exact CAS payload.
assert.equal(
  decideTenantAtomicHandling(true, {}),
  'atomic_input_required',
);
assert.equal(
  decideTenantAtomicHandling(true, {
    offer_id: '11111111-1111-4111-8111-111111111111',
    assignment_version: 3,
    transition_key: '22222222-2222-4222-8222-222222222222',
  }),
  'atomic_ready',
);
// Tenant B remains legacy and falls through even without an atomic payload.
assert.equal(
  decideTenantAtomicHandling(false, {}),
  'legacy_fallback',
);

console.log('atomic lifecycle contract tests: PASS');
