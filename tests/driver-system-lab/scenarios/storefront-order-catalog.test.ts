import assert from 'node:assert/strict'
import test from 'node:test'
import { canonicalizeStorefrontItems, validateRequestedItems } from '@/lib/delivery/storefront-order-catalog'

test('uses only canonical catalog name and price despite client tampering', () => {
  const requested = validateRequestedItems([{ id: 'item-1', qty: 2, name: 'Forged', price: 0.01 }])
  assert.equal(requested.ok, true)
  if (!requested.ok) return
  assert.deepEqual(canonicalizeStorefrontItems(requested.items, [
    { id: 'item-1', name: 'Canonical Bowl', preis: 12.5, location_id: 'location-a', verfuegbar: true },
  ], 'location-a'), { ok: true, items: [{ id: 'item-1', name: 'Canonical Bowl', qty: 2, price: 12.5 }] })
})

test('rejects foreign, unavailable and missing catalog items', () => {
  const requested = [{ id: 'item-1', qty: 1 }]
  assert.deepEqual(canonicalizeStorefrontItems(requested, [{ id: 'item-1', name: 'X', preis: 10, location_id: 'location-b', verfuegbar: true }], 'location-a'), { ok: false, reason: 'ITEM_NOT_AVAILABLE' })
  assert.deepEqual(canonicalizeStorefrontItems(requested, [{ id: 'item-1', name: 'X', preis: 10, location_id: 'location-a', verfuegbar: false }], 'location-a'), { ok: false, reason: 'ITEM_NOT_AVAILABLE' })
  assert.deepEqual(canonicalizeStorefrontItems(requested, [], 'location-a'), { ok: false, reason: 'ITEM_NOT_AVAILABLE' })
})

test('rejects duplicate lines and invalid quantities before any catalog access', () => {
  assert.deepEqual(validateRequestedItems([{ id: 'item-1', qty: 1 }, { id: 'item-1', qty: 2 }]), { ok: false, reason: 'DUPLICATE_ITEM' })
  for (const qty of [0, -1, 1.5, 100, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(validateRequestedItems([{ id: 'item-1', qty }]), { ok: false, reason: 'INVALID_ITEM_QUANTITY' })
  }
})
