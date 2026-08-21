export const DELIVERY_ORDER_STATUSES = [
  'neu',
  'bestätigt',
  'in_zubereitung',
  'fertig',
  'unterwegs',
  'geliefert',
  'abgeholt',
  'storniert',
] as const;

export type DeliveryOrderStatus = typeof DELIVERY_ORDER_STATUSES[number];

const TRANSITIONS: Record<DeliveryOrderStatus, readonly DeliveryOrderStatus[]> = {
  neu: ['bestätigt', 'storniert'],
  'bestätigt': ['in_zubereitung', 'storniert'],
  in_zubereitung: ['fertig', 'storniert'],
  fertig: ['unterwegs', 'abgeholt', 'storniert'],
  unterwegs: ['geliefert', 'storniert'],
  geliefert: [],
  abgeholt: [],
  storniert: [],
};

export function isDeliveryOrderStatus(value: string): value is DeliveryOrderStatus {
  return (DELIVERY_ORDER_STATUSES as readonly string[]).includes(value);
}

export function canTransitionDeliveryOrder(
  current: DeliveryOrderStatus,
  next: DeliveryOrderStatus,
  orderType: string | null | undefined,
): boolean {
  if (!TRANSITIONS[current].includes(next)) return false;
  if (orderType === 'lieferung' && next === 'abgeholt') return false;
  if (orderType !== 'lieferung' && (next === 'unterwegs' || next === 'geliefert')) return false;
  return true;
}
