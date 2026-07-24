export type ClientOfferAction =
  | 'accept'
  | 'decline'
  | 'picked_up'
  | 'in_progress'
  | 'complete'
  | 'cancel';

export interface CanonicalClientOffer {
  offerId: string;
  assignmentVersion: number;
  batchId?: string;
  transitionKeys: Partial<Record<ClientOfferAction, string>>;
}

export const CANONICAL_OFFER_STORAGE_KEY = 'mise-driver:canonical-offer:v1';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseCanonicalOffer(value: unknown): CanonicalClientOffer | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.offerId !== 'string' ||
    !UUID.test(row.offerId) ||
    !Number.isSafeInteger(row.assignmentVersion) ||
    Number(row.assignmentVersion) < 1
  ) return null;
  const keys: Partial<Record<ClientOfferAction, string>> = {};
  if (row.transitionKeys && typeof row.transitionKeys === 'object') {
    for (const action of [
      'accept', 'decline', 'picked_up', 'in_progress', 'complete', 'cancel',
    ] as ClientOfferAction[]) {
      const key = (row.transitionKeys as Record<string, unknown>)[action];
      if (typeof key === 'string' && UUID.test(key)) keys[action] = key;
    }
  }
  return {
    offerId: row.offerId,
    assignmentVersion: Number(row.assignmentVersion),
    batchId: typeof row.batchId === 'string' ? row.batchId : undefined,
    transitionKeys: keys,
  };
}

export function integrateCanonicalOffer(
  previous: CanonicalClientOffer | null,
  incoming: { offerId: string; assignmentVersion: number; batchId?: string },
): CanonicalClientOffer | null {
  const parsed = parseCanonicalOffer({
    offerId: incoming.offerId,
    assignmentVersion: incoming.assignmentVersion,
    batchId: incoming.batchId,
    transitionKeys:
      previous?.offerId === incoming.offerId ? previous.transitionKeys : {},
  });
  if (!parsed) return previous;
  if (
    previous?.offerId === parsed.offerId &&
    previous.assignmentVersion > parsed.assignmentVersion
  ) return previous;
  return parsed;
}

export function prepareClientTransition(
  offer: CanonicalClientOffer,
  action: ClientOfferAction,
  createUuid: () => string,
): { offer: CanonicalClientOffer; payload: {
  offer_id: string;
  assignment_version: number;
  transition_key: string;
} } {
  const transitionKey = offer.transitionKeys[action] ?? createUuid();
  const next = {
    ...offer,
    transitionKeys: { ...offer.transitionKeys, [action]: transitionKey },
  };
  return {
    offer: next,
    payload: {
      offer_id: next.offerId,
      assignment_version: next.assignmentVersion,
      transition_key: transitionKey,
    },
  };
}

export function applySuccessfulClientTransition(
  offer: CanonicalClientOffer,
  action: ClientOfferAction,
  response: unknown,
): CanonicalClientOffer | null {
  if (!response || typeof response !== 'object') return offer;
  const row = response as Record<string, unknown>;
  if (
    row.ok !== true ||
    typeof row.offer_id !== 'string' ||
    row.offer_id !== offer.offerId ||
    !Number.isSafeInteger(row.assignment_version) ||
    Number(row.assignment_version) <= offer.assignmentVersion
  ) return offer;
  if (action === 'decline' || action === 'complete' || action === 'cancel') {
    return null;
  }
  return {
    ...offer,
    assignmentVersion: Number(row.assignment_version),
  };
}
