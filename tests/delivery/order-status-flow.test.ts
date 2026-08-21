import { describe, expect, it } from 'vitest';
import {
  canTransitionDeliveryOrder,
  type DeliveryOrderStatus,
} from '@/lib/delivery/order-status';

describe('delivery order status flow', () => {
  it('drives a delivery through the complete operational status sequence', () => {
    let current: DeliveryOrderStatus = 'neu';
    const sequence: DeliveryOrderStatus[] = [
      'bestätigt',
      'in_zubereitung',
      'fertig',
      'unterwegs',
      'geliefert',
    ];

    for (const next of sequence) {
      expect(canTransitionDeliveryOrder(current, next, 'lieferung')).toBe(true);
      current = next;
    }
    expect(current).toBe('geliefert');
  });

  it.each([
    ['neu', 'geliefert'],
    ['bestätigt', 'unterwegs'],
    ['in_zubereitung', 'geliefert'],
    ['geliefert', 'neu'],
    ['storniert', 'bestätigt'],
  ] as Array<[DeliveryOrderStatus, DeliveryOrderStatus]>)('rejects invalid jump %s → %s', (current, next) => {
    expect(canTransitionDeliveryOrder(current, next, 'lieferung')).toBe(false);
  });

  it('separates delivery from pickup completion', () => {
    expect(canTransitionDeliveryOrder('fertig', 'abgeholt', 'lieferung')).toBe(false);
    expect(canTransitionDeliveryOrder('fertig', 'unterwegs', 'abholung')).toBe(false);
    expect(canTransitionDeliveryOrder('fertig', 'abgeholt', 'abholung')).toBe(true);
  });
});
