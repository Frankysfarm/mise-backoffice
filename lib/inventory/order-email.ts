export type InventoryOrderPosition = {
  name?: unknown;
  artikelnummer?: unknown;
  menge?: unknown;
  einheit?: unknown;
  preis_pro_einheit?: unknown;
};

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 160) : fallback;
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

const MONEY = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export function normalizeInventoryOrderPositions(value: unknown): Array<{
  name: string;
  articleNumber: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
}> {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 500).map((entry: InventoryOrderPosition) => ({
    name: text(entry?.name, 'Unbenannter Artikel'),
    articleNumber: typeof entry?.artikelnummer === 'string' && entry.artikelnummer.trim()
      ? entry.artikelnummer.trim().slice(0, 100)
      : null,
    quantity: number(entry?.menge),
    unit: text(entry?.einheit, 'Stück'),
    unitPrice: number(entry?.preis_pro_einheit),
  })).filter((entry) => entry.quantity > 0);
}

export function buildInventoryOrderText(input: {
  tenantName: string;
  locationName: string;
  supplierName: string;
  customerNumber?: string | null;
  reference: string;
  positions: unknown;
}): string {
  const positions = normalizeInventoryOrderPositions(input.positions);
  if (positions.length === 0) throw new Error('Bestellliste enthält keine gültigen Positionen.');

  const lines = positions.map((position, index) => {
    const article = position.articleNumber ? ` · Art.-Nr. ${position.articleNumber}` : '';
    const price = position.unitPrice > 0 ? ` · ${MONEY.format(position.unitPrice)} je ${position.unit}` : '';
    return `${index + 1}. ${position.name}${article}\n   ${position.quantity} ${position.unit}${price}`;
  });
  const customer = input.customerNumber ? `Kundennummer: ${input.customerNumber}\n` : '';
  return [
    `Bestellung ${input.reference}`,
    '',
    `Betrieb: ${input.tenantName}`,
    `Standort: ${input.locationName}`,
    `Lieferant: ${input.supplierName}`,
    customer.trimEnd(),
    'Positionen:',
    ...lines,
    '',
    'Bitte bestätigen Sie Verfügbarkeit und voraussichtlichen Liefertermin.',
    '',
    'Diese Bestellung wurde über MISE Gastro erstellt.',
  ].filter((line) => line !== '').join('\n');
}
