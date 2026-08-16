import { describe, expect, it } from 'vitest';
import { needsCashCollection } from '@/lib/delivery/payment';

describe('delivery cash collection', () => {
  it('never asks to collect a payment that is already marked paid', () => {
    expect(needsCashCollection({ zahlungsart: 'bar', bezahlt: true })).toBe(false);
    expect(needsCashCollection({ zahlungsart: null, bezahlt: true })).toBe(false);
  });

  it('collects unpaid cash and legacy orders without a payment method', () => {
    expect(needsCashCollection({ zahlungsart: 'bar', bezahlt: false })).toBe(true);
    expect(needsCashCollection({ zahlungsart: null, bezahlt: false })).toBe(true);
  });

  it('does not turn an unresolved online payment into a cash collection', () => {
    expect(needsCashCollection({ zahlungsart: 'stripe', bezahlt: false })).toBe(false);
    expect(needsCashCollection({ zahlungsart: 'sumup', bezahlt: null })).toBe(false);
  });
});
