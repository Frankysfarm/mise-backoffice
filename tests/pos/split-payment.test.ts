import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createProviderCheckout,
  mapSplitState,
  parseSplitScope,
  requirePositiveCents,
  verifyProviderCheckout,
} from '@/lib/pos/split-payment';

describe('POS split payment helpers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('accepts only positive integer cents', () => {
    expect(requirePositiveCents(123)).toBe(123);
    for (const value of [0, -1, 1.5, Number.NaN, 1_000_001]) {
      expect(() => requirePositiveCents(value)).toThrow(/positiver Cent-Betrag/);
    }
  });

  it('normalizes amount, item and seat scopes without duplicate allocations', () => {
    expect(parseSplitScope({ mode: 'amount', amountCents: 321 })).toEqual({
      type: 'amount', requestedCents: 321, itemIds: [], seatNo: null,
    });
    expect(parseSplitScope({
      mode: 'items',
      itemIds: ['00000000-0000-4000-8000-000000000101'],
    })).toEqual({
      type: 'items', requestedCents: null,
      itemIds: ['00000000-0000-4000-8000-000000000101'], seatNo: null,
    });
    expect(parseSplitScope({ mode: 'seat', seat: 4 })).toEqual({
      type: 'seat', requestedCents: null, itemIds: [], seatNo: 4,
    });
    expect(() => parseSplitScope({
      mode: 'items',
      itemIds: [
        '00000000-0000-4000-8000-000000000101',
        '00000000-0000-4000-8000-000000000101',
      ],
    })).toThrow(/doppelte/);
  });

  it('maps database cents and ledger rows without floating point conversion', () => {
    expect(mapSplitState({
      split_session_id: 'session',
      total_cents: 1001,
      paid_cents: 333,
      remaining_cents: 668,
      status: 'open',
      line_items: [{ id: 'line', totalCents: 1001 }],
      payments: [{ id: 'pay', amountCents: 333 }],
    })).toMatchObject({
      splitSessionId: 'session',
      totalCents: 1001,
      paidCents: 333,
      remainingCents: 668,
      completed: false,
    });
  });

  it('creates SumUp from server-bound cents and verifies every provider field', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'sumup-checkout', status: 'PENDING' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'sumup-checkout',
          status: 'PAID',
          amount: 3.21,
          currency: 'EUR',
          checkout_reference: 'split-00000000-0000-4000-8000-000000000201',
          merchant_code: 'merchant',
        }),
      });
    vi.stubGlobal('fetch', fetchMock);
    const tenant = {
      name: 'QA',
      sumup_api_key: 'test-key',
      sumup_merchant_code: 'merchant',
      stripe_secret_key: null,
    };
    const created = await createProviderCheckout({
      provider: 'sumup',
      tenant,
      amountCents: 321,
      attemptId: '00000000-0000-4000-8000-000000000201',
      tenantId: '00000000-0000-4000-8000-000000000001',
      orderNumber: 'QA-1',
      origin: 'https://example.test',
    });
    expect(created.reference).toBe('sumup-checkout');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      amount: 3.21,
      currency: 'EUR',
      checkout_reference: 'split-00000000-0000-4000-8000-000000000201',
    });
    expect(fetchMock.mock.calls[0][1].headers['Idempotency-Key'])
      .toBe('00000000-0000-4000-8000-000000000201');

    await expect(verifyProviderCheckout({
      provider: 'sumup',
      tenant,
      reference: 'sumup-checkout',
      amountCents: 321,
      attemptId: '00000000-0000-4000-8000-000000000201',
      tenantId: '00000000-0000-4000-8000-000000000001',
    })).resolves.toEqual({ state: 'paid', paymentId: 'sumup-checkout' });
  });

  it('fails closed when a paid SumUp amount does not match exact cents', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'sumup-checkout', status: 'PAID', amount: 3.22, currency: 'EUR',
        checkout_reference: 'split-00000000-0000-4000-8000-000000000201',
        merchant_code: 'merchant',
      }),
    }));
    await expect(verifyProviderCheckout({
      provider: 'sumup',
      tenant: {
        name: 'QA', sumup_api_key: 'test-key',
        sumup_merchant_code: 'merchant', stripe_secret_key: null,
      },
      reference: 'sumup-checkout',
      amountCents: 321,
      attemptId: '00000000-0000-4000-8000-000000000201',
      tenantId: '00000000-0000-4000-8000-000000000001',
    })).resolves.toMatchObject({ state: 'failed' });
  });
});
