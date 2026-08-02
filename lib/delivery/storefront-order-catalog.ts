export type StorefrontRequestedItem = { id: unknown; qty: unknown }
export type StorefrontCatalogItem = { id: string; name: string; preis: unknown; location_id: string; verfuegbar: boolean }
export type CanonicalStorefrontItem = { id: string; name: string; qty: number; price: number }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function validateRequestedItems(value: unknown): { ok: true; items: Array<{ id: string; qty: number }> } | { ok: false; reason: string } {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) return { ok: false, reason: 'INVALID_ITEMS' }
  const seen = new Set<string>()
  const items: Array<{ id: string; qty: number }> = []
  for (const raw of value as StorefrontRequestedItem[]) {
    if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !UUID_RE.test(raw.id)) return { ok: false, reason: 'INVALID_ITEM_ID' }
    if (!Number.isInteger(raw.qty) || (raw.qty as number) < 1 || (raw.qty as number) > 99) return { ok: false, reason: 'INVALID_ITEM_QUANTITY' }
    if (seen.has(raw.id)) return { ok: false, reason: 'DUPLICATE_ITEM' }
    seen.add(raw.id)
    items.push({ id: raw.id, qty: raw.qty as number })
  }
  return { ok: true, items }
}

export function canonicalizeStorefrontItems(
  requested: Array<{ id: string; qty: number }>,
  catalog: StorefrontCatalogItem[],
  locationId: string,
): { ok: true; items: CanonicalStorefrontItem[] } | { ok: false; reason: string } {
  const byId = new Map(catalog.map((item) => [item.id, item]))
  const result: CanonicalStorefrontItem[] = []
  for (const request of requested) {
    const item = byId.get(request.id)
    const price = Number(item?.preis)
    if (!item || item.location_id !== locationId || item.verfuegbar !== true || !Number.isFinite(price) || price < 0 || price > 100_000) {
      return { ok: false, reason: 'ITEM_NOT_AVAILABLE' }
    }
    result.push({ id: item.id, name: item.name, qty: request.qty, price })
  }
  return { ok: true, items: result }
}
