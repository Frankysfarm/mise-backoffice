import { describe, expect, it } from 'vitest';
import { buildInventoryOrderText, normalizeInventoryOrderPositions } from '@/lib/inventory/order-email';

describe('inventory supplier order email', () => {
  it('normalizes unsafe and malformed position data without producing invalid totals', () => {
    expect(normalizeInventoryOrderPositions([
      { name: ' Hafermilch ', artikelnummer: ' H-1 ', menge: '4', einheit: 'Karton', preis_pro_einheit: '12.5' },
      { name: '', menge: -1 },
      { name: 'Kaffee', menge: 'not-a-number' },
    ])).toEqual([
      { name: 'Hafermilch', articleNumber: 'H-1', quantity: 4, unit: 'Karton', unitPrice: 12.5 },
    ]);
  });

  it('builds a deterministic plain-text order with tenant, location and supplier context', () => {
    const body = buildInventoryOrderText({
      tenantName: 'MISE Café',
      locationName: 'Aachen Mitte',
      supplierName: 'Gastro Handel',
      customerNumber: 'KD-42',
      reference: 'LAGER-ABC123',
      positions: [{ name: 'Hafermilch', artikelnummer: 'H-1', menge: 4, einheit: 'Karton', preis_pro_einheit: 12.5 }],
    });
    expect(body).toContain('Bestellung LAGER-ABC123');
    expect(body).toContain('Standort: Aachen Mitte');
    expect(body).toContain('Kundennummer: KD-42');
    expect(body).toContain('4 Karton');
    expect(body).toContain('12,50 €');
  });

  it('rejects empty order lists before any email is sent', () => {
    expect(() => buildInventoryOrderText({
      tenantName: 'MISE', locationName: 'Mitte', supplierName: 'Handel', reference: 'X', positions: [],
    })).toThrow('keine gültigen Positionen');
  });
});
