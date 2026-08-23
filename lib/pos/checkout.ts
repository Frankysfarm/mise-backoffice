import { resolveTableOrderItem, roundMoney } from '@/lib/orders/table-order';

export type PosFulfillment = 'table' | 'counter' | 'takeaway';

export type PosMenuItem = {
  id: string;
  name: string;
  preis: number;
  mwst_satz: number | null;
  option_groups: unknown;
};

export type ResolvedPosLine = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  taxRate: 7 | 19;
  note: string | null;
  selections: Record<string, string | string[]>;
};

export type PosCartSummary = {
  items: ResolvedPosLine[];
  subtotal: number;
  tip: number;
  paymentTotal: number;
  net: number;
  tax: number;
  tax7: number;
  tax19: number;
};

type RawPosLine = {
  id?: unknown;
  qty?: unknown;
  selections?: unknown;
  note?: unknown;
};

export function resolvePosCart(input: {
  rawItems: unknown;
  menuItems: PosMenuItem[];
  fulfillment: PosFulfillment;
  tip?: unknown;
}): PosCartSummary {
  if (!Array.isArray(input.rawItems) || input.rawItems.length < 1 || input.rawItems.length > 100) {
    throw new Error('Ungültiger POS-Warenkorb');
  }

  const rawItems = input.rawItems as RawPosLine[];
  const requestedIds = [...new Set(rawItems.map((line) => String(line?.id ?? '')).filter(Boolean))];
  const menuMap = new Map(input.menuItems.map((item) => [item.id, item]));
  if (requestedIds.length < 1 || requestedIds.some((id) => !menuMap.has(id))) {
    throw new Error('POS-Warenkorb enthält nicht verfügbare Artikel');
  }

  const items = rawItems.map((raw) => {
    const item = menuMap.get(String(raw.id ?? ''));
    if (!item) throw new Error('POS-Artikel ist nicht verfügbar');
    const resolved = resolveTableOrderItem({
      item: {
        id: item.id,
        name: item.name,
        price: item.preis,
        optionGroups: item.option_groups,
      },
      quantity: raw.qty,
      selections: raw.selections,
      note: raw.note,
    });
    return {
      ...resolved,
      taxRate: resolveTaxRate(input.fulfillment, item.mwst_satz),
      selections: isSelectionMap(raw.selections) ? raw.selections : {},
    } satisfies ResolvedPosLine;
  });

  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
  const tip = roundMoney(Number(input.tip ?? 0));
  if (!Number.isFinite(tip) || tip < 0 || tip > 500) throw new Error('Ungültiges Trinkgeld');
  const paymentTotal = roundMoney(subtotal + tip);
  if (subtotal < 0.5 || paymentTotal > 10_000) throw new Error('Ungültige POS-Summe');

  let tax7 = 0;
  let tax19 = 0;
  for (const item of items) {
    const gross = roundMoney(item.unitPrice * item.quantity);
    const tax = roundMoney(gross - gross / (1 + item.taxRate / 100));
    if (item.taxRate === 7) tax7 = roundMoney(tax7 + tax);
    else tax19 = roundMoney(tax19 + tax);
  }
  const tax = roundMoney(tax7 + tax19);
  const net = roundMoney(subtotal - tax);
  return { items, subtotal, tip, paymentTotal, net, tax, tax7, tax19 };
}

function resolveTaxRate(fulfillment: PosFulfillment, configuredRate: number | null): 7 | 19 {
  if (fulfillment === 'table' || fulfillment === 'counter') return 19;
  return Number(configuredRate) === 7 ? 7 : 19;
}

function isSelectionMap(value: unknown): value is Record<string, string | string[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every((entry) => (
    typeof entry === 'string'
    || (Array.isArray(entry) && entry.every((item) => typeof item === 'string'))
  ));
}
