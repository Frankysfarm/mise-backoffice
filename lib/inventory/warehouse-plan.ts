export type WarehouseNode = {
  id: string;
  areaId: string;
  parentId: string | null;
  kind: "unit" | "place";
};

export function validateWarehouseHierarchy(nodes: WarehouseNode[]): {
  valid: boolean;
  reason?: string;
} {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const node of nodes) {
    if (node.parentId === node.id)
      return {
        valid: false,
        reason:
          "Ein Lagerplatz kann nicht sein eigener übergeordneter Platz sein.",
      };
    if (!node.parentId) {
      if (node.kind === "place")
        return {
          valid: false,
          reason: "Ein Lagerplatz benötigt ein Regal oder Kühlgerät.",
        };
      continue;
    }
    const parent = byId.get(node.parentId);
    if (!parent || parent.areaId !== node.areaId)
      return {
        valid: false,
        reason: "Übergeordnete Elemente müssen im selben Raum liegen.",
      };
    if (parent.kind !== "unit" || node.kind !== "place")
      return {
        valid: false,
        reason:
          "Nur Lagerplätze dürfen einem Regal oder Kühlgerät untergeordnet werden.",
      };
    const seen = new Set([node.id]);
    let cursor: WarehouseNode | undefined = parent;
    while (cursor) {
      if (seen.has(cursor.id))
        return {
          valid: false,
          reason: "Die Lagerstruktur enthält einen Kreis.",
        };
      seen.add(cursor.id);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
  }
  return { valid: true };
}

export function nextStock(
  current: number,
  amount: number,
  action: "book" | "withdraw" | "count",
): number {
  if (!Number.isFinite(current) || !Number.isFinite(amount) || amount < 0)
    throw new Error("Ungültige Menge");
  if (action === "count") return amount;
  const result = action === "book" ? current + amount : current - amount;
  if (result < 0) throw new Error("Der Bestand darf nicht negativ werden.");
  return result;
}

export function inventoryDeviation(expected: number, counted: number): number {
  if (!Number.isFinite(expected) || !Number.isFinite(counted) || counted < 0)
    throw new Error("Ungültige Zählung");
  return counted - expected;
}

export type ReorderItem = {
  supplierId: string | null;
  supplierName: string | null;
  locationId: string | null;
  target: number;
  current: number;
};
export function groupReorderProposals(items: ReorderItem[]) {
  const groups = new Map<
    string,
    {
      supplierId: string | null;
      supplierName: string;
      locationId: string | null;
      amount: number;
      itemCount: number;
    }
  >();
  for (const item of items) {
    if (item.current >= item.target) continue;
    const key = `${item.locationId}:${item.supplierId ?? item.supplierName ?? "ohne-lieferant"}`;
    const group = groups.get(key) ?? {
      supplierId: item.supplierId,
      supplierName: item.supplierName ?? "Ohne Lieferant",
      locationId: item.locationId,
      amount: 0,
      itemCount: 0,
    };
    group.amount += item.target - item.current;
    group.itemCount += 1;
    groups.set(key, group);
  }
  return [...groups.values()];
}
