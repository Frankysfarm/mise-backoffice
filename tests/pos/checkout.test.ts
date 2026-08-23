import { describe, expect, it } from 'vitest';
import { resolvePosCart } from '@/lib/pos/checkout';

const menuItems = [
  {
    id: 'food-1', name: 'Bowl', preis: 10, mwst_satz: 7,
    option_groups: [{
      id: 'size', name: 'Größe', type: 'single', required: true,
      options: [
        { id: 'regular', name: 'Normal', priceDelta: 0 },
        { id: 'large', name: 'Groß', priceDelta: 2 },
      ],
    }],
  },
  { id: 'drink-1', name: 'Cola', preis: 3.5, mwst_satz: 19, option_groups: [] },
];

describe('POS checkout resolution', () => {
  it('recalculates prices, options, taxes and tip from stored menu data', () => {
    expect(resolvePosCart({
      rawItems: [
        { id: 'food-1', qty: 2, selections: { size: 'large' } },
        { id: 'drink-1', qty: 1 },
      ],
      menuItems,
      fulfillment: 'takeaway',
      tip: 1.5,
    })).toMatchObject({
      subtotal: 27.5,
      tip: 1.5,
      paymentTotal: 29,
      tax7: 1.57,
      tax19: 0.56,
      tax: 2.13,
      net: 25.37,
    });
  });

  it('uses dine-in VAT for every table line', () => {
    const result = resolvePosCart({
      rawItems: [{ id: 'food-1', qty: 1, selections: { size: 'regular' } }],
      menuItems,
      fulfillment: 'table',
    });
    expect(result.items[0].taxRate).toBe(19);
    expect(result.tax19).toBe(1.6);
    expect(result.tax7).toBe(0);
  });

  it('uses dine-in VAT for counter sales without requiring a table', () => {
    const result = resolvePosCart({
      rawItems: [{ id: 'food-1', qty: 1, selections: { size: 'regular' } }],
      menuItems,
      fulfillment: 'counter',
    });
    expect(result.items[0].taxRate).toBe(19);
    expect(result.tax19).toBe(1.6);
  });
  it('rejects invented items, invalid options, quantities and tips', () => {
    expect(() => resolvePosCart({ rawItems: [{ id: 'fake', qty: 1 }], menuItems, fulfillment: 'table' })).toThrow(/nicht verfügbare/);
    expect(() => resolvePosCart({ rawItems: [{ id: 'food-1', qty: 1, selections: { size: 'fake' } }], menuItems, fulfillment: 'table' })).toThrow(/Unbekannte/);
    expect(() => resolvePosCart({ rawItems: [{ id: 'drink-1', qty: 0 }], menuItems, fulfillment: 'table' })).toThrow(/Bestellmenge/);
    expect(() => resolvePosCart({ rawItems: [{ id: 'drink-1', qty: 1 }], menuItems, fulfillment: 'table', tip: 501 })).toThrow(/Trinkgeld/);
  });
});
