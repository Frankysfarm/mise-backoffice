export const KITCHEN_ITEM_STATUSES = ['queued', 'preparing', 'ready', 'cancelled'] as const;
export type KitchenItemStatus = typeof KITCHEN_ITEM_STATUSES[number];
export type KitchenTargetStatus = Exclude<KitchenItemStatus, 'queued'>;

const ALLOWED: Record<KitchenItemStatus, readonly KitchenTargetStatus[]> = {
  queued: ['preparing', 'ready', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: [],
  cancelled: [],
};

export function isKitchenTargetStatus(value: unknown): value is KitchenTargetStatus {
  return value === 'preparing' || value === 'ready' || value === 'cancelled';
}

export function canAdvanceKitchenItem(from: KitchenItemStatus, to: KitchenTargetStatus) {
  return from === to || ALLOWED[from].includes(to);
}

export function toLegacyStationStatus(status: KitchenItemStatus) {
  switch (status) {
    case 'queued': return 'offen';
    case 'preparing': return 'in_arbeit';
    case 'ready': return 'fertig';
    case 'cancelled': return 'storniert';
  }
}

export function kitchenTransitionError(error: { message?: string } | null | undefined) {
  const message = error?.message ?? '';
  if (message.includes('outside tenant, location or station')) return { status: 404, error: 'Küchenposition nicht gefunden' };
  if (message.includes('status transition is not allowed')) return { status: 409, error: 'Dieser Küchenstatus ist nicht mehr aktuell' };
  if (message.includes('actor is outside')) return { status: 403, error: 'Keine Berechtigung für diese Filiale' };
  return { status: 500, error: 'Küchenstatus konnte nicht gespeichert werden' };
}
