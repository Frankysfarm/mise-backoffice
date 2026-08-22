type RawOption = {
  id?: unknown;
  name?: unknown;
  priceDelta?: unknown;
};

type RawOptionGroup = {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  required?: unknown;
  max?: unknown;
  options?: unknown;
};

export type TableOrderSelection = Record<string, string | string[]>;

export type ResolvedTableOrderItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  note: string | null;
};

export function resolveTableOrderItem(input: {
  item: { id: string; name: string; price: number; optionGroups: unknown };
  quantity: unknown;
  selections: unknown;
  note: unknown;
}): ResolvedTableOrderItem {
  const quantity = Math.trunc(Number(input.quantity));
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
    throw new Error('Ungültige Bestellmenge');
  }

  const basePrice = Number(input.item.price);
  if (!Number.isFinite(basePrice) || basePrice < 0) {
    throw new Error('Ungültiger Artikelpreis');
  }

  const selections = isSelectionMap(input.selections) ? input.selections : {};
  const groups = Array.isArray(input.item.optionGroups)
    ? input.item.optionGroups as RawOptionGroup[]
    : [];
  const allowedGroupIds = new Set(groups.map((group) => String(group.id ?? '')).filter(Boolean));
  if (Object.keys(selections).some((groupId) => !allowedGroupIds.has(groupId))) {
    throw new Error('Unbekannte Artikelauswahl');
  }

  const selectionLabels: string[] = [];
  let optionPrice = 0;
  for (const group of groups) {
    const groupId = String(group.id ?? '');
    if (!groupId) continue;
    const selected = selections[groupId];
    const selectedIds = selected === undefined
      ? []
      : Array.isArray(selected)
        ? selected
        : [selected];
    const uniqueSelectedIds = [...new Set(selectedIds.map(String).filter(Boolean))];
    const groupType = group.type === 'multi' ? 'multi' : 'single';
    const max = Number.isFinite(Number(group.max)) ? Math.max(0, Math.trunc(Number(group.max))) : null;

    if (group.required && uniqueSelectedIds.length === 0) {
      throw new Error(`Auswahl „${String(group.name ?? groupId)}“ fehlt`);
    }
    if (groupType === 'single' && uniqueSelectedIds.length > 1) {
      throw new Error('Zu viele Optionen ausgewählt');
    }
    if (groupType === 'multi' && max !== null && uniqueSelectedIds.length > max) {
      throw new Error('Zu viele Optionen ausgewählt');
    }

    const options = Array.isArray(group.options) ? group.options as RawOption[] : [];
    const optionMap = new Map(options.map((option) => [String(option.id ?? ''), option]));
    for (const optionId of uniqueSelectedIds) {
      const option = optionMap.get(optionId);
      if (!option) throw new Error('Unbekannte Artikeloption');
      const priceDelta = Number(option.priceDelta ?? 0);
      if (!Number.isFinite(priceDelta) || priceDelta < 0) throw new Error('Ungültiger Optionspreis');
      optionPrice += priceDelta;
      selectionLabels.push(String(option.name ?? optionId).slice(0, 80));
    }
  }

  const unitPrice = roundMoney(basePrice + optionPrice);
  const name = selectionLabels.length
    ? `${input.item.name} · ${selectionLabels.join(', ')}`.slice(0, 255)
    : input.item.name.slice(0, 255);
  const note = String(input.note ?? '').trim().slice(0, 500) || null;

  return { id: input.item.id, name, quantity, unitPrice, note };
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isSelectionMap(value: unknown): value is TableOrderSelection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every((entry) => (
    typeof entry === 'string'
    || (Array.isArray(entry) && entry.every((item) => typeof item === 'string'))
  ));
}
