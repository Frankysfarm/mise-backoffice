export interface AtomicTransitionRequest {
  offer_id?: unknown;
  assignment_version?: unknown;
  transition_key?: unknown;
}

export interface ValidAtomicTransitionInput {
  offerId: string;
  assignmentVersion: number;
  transitionKey: string;
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateAtomicTransitionInput(
  body: AtomicTransitionRequest,
): ValidAtomicTransitionInput | null {
  if (
    typeof body.offer_id !== 'string' ||
    !UUID.test(body.offer_id) ||
    !Number.isSafeInteger(body.assignment_version) ||
    Number(body.assignment_version) < 1 ||
    typeof body.transition_key !== 'string' ||
    !UUID.test(body.transition_key)
  ) return null;
  return {
    offerId: body.offer_id,
    assignmentVersion: Number(body.assignment_version),
    transitionKey: body.transition_key,
  };
}

export function atomicTransitionRejectionStatus(reason?: string): number {
  if (reason === 'OFFER_NOT_FOUND') return 404;
  if (
    reason === 'ACTOR_DRIVER_MISMATCH' ||
    reason === 'TENANT_OFFER_MISMATCH' ||
    reason === 'SINGLE_WRITER_GATE_CLOSED'
  ) return 403;
  if (
    reason === 'ASSIGNMENT_VERSION_CONFLICT' ||
    reason === 'INVALID_STATE_TRANSITION' ||
    reason === 'OFFER_EXPIRED' ||
    reason === 'TRANSITION_KEY_REUSED_WITH_DIFFERENT_REQUEST'
  ) return 409;
  return 400;
}

export function decideTenantAtomicHandling(
  gateEnabled: boolean,
  body: AtomicTransitionRequest,
): 'legacy_fallback' | 'atomic_input_required' | 'atomic_ready' {
  if (!gateEnabled) return 'legacy_fallback';
  return validateAtomicTransitionInput(body)
    ? 'atomic_ready'
    : 'atomic_input_required';
}
