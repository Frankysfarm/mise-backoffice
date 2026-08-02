import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const route = readFileSync('app/api/delivery/orders/route.ts', 'utf8')
const client = readFileSync('app/biss-app/[slug]/client.tsx', 'utf8')

test('storefront route delegates its only persistence boundary to the atomic RPC', () => {
  assert.match(route, /\.rpc\('fn_storefront_create_order_v1'/)
  assert.doesNotMatch(route, /\.from\('customer_orders'\)/)
  assert.doesNotMatch(route, /\.from\('order_items'\)/)
  assert.match(route, /idempotency-key/)
  assert.match(route, /createHash\('sha256'\)/)
})

test('storefront client reuses a payload-bound idempotency key', () => {
  assert.match(client, /requestRef\.current\.payload !== orderPayload/)
  assert.match(client, /crypto\.randomUUID\(\)/)
  assert.match(client, /'Idempotency-Key': requestRef\.current\.key/)
})
