import { describe, expect, it } from 'vitest';
import { resolveTableOrderItem } from '@/lib/orders/table-order';

const item = {
  id: 'pizza-1',
  name: 'Pizza',
  price: 10,
  optionGroups: [
    {
      id: 'size', name: 'Größe', type: 'single', required: true,
      options: [
        { id: 'normal', name: 'Normal', priceDelta: 0 },
        { id: 'large', name: 'Groß', priceDelta: 2.5 },
      ],
    },
    {
      id: 'extras', name: 'Extras', type: 'multi', max: 2,
      options: [
        { id: 'cheese', name: 'Käse', priceDelta: 1.2 },
        { id: 'olives', name: 'Oliven', priceDelta: 0.8 },
      ],
    },
  ],
};

describe('table order price resolution', () => {
  it('calculates configured item prices exclusively from stored options', () => {
    expect(resolveTableOrderItem({
      item,
      quantity: 2,
      selections: { size: 'large', extras: ['cheese', 'olives'] },
      note: ' Ohne Zwiebel ',
    })).toEqual({
      id: 'pizza-1',
      name: 'Pizza · Groß, Käse, Oliven',
      quantity: 2,
      unitPrice: 14.5,
      note: 'Ohne Zwiebel',
    });
  });

  it('rejects missing required, unknown and excessive option selections', () => {
    expect(() => resolveTableOrderItem({ item, quantity: 1, selections: {}, note: '' })).toThrow(/fehlt/);
    expect(() => resolveTableOrderItem({ item, quantity: 1, selections: { size: 'fake' }, note: '' })).toThrow(/Unbekannte/);
    expect(() => resolveTableOrderItem({
      item,
      quantity: 1,
      selections: { size: 'normal', extras: ['cheese', 'olives', 'fake'] },
      note: '',
    })).toThrow(/Zu viele/);
  });

  it('rejects invalid quantities and client-invented option groups', () => {
    expect(() => resolveTableOrderItem({ item, quantity: 0, selections: { size: 'normal' }, note: '' })).toThrow(/Bestellmenge/);
    expect(() => resolveTableOrderItem({
      item,
      quantity: 1,
      selections: { size: 'normal', surcharge: '999' },
      note: '',
    })).toThrow(/Unbekannte Artikelauswahl/);
  });
});
