import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import test from "node:test"
import { assertTestLabEnvironment } from "../support/environment"

const environment = assertTestLabEnvironment()
const appUrl = process.env.MISE_TEST_LAB_APP_URL
if (!appUrl || new URL(appUrl).hostname !== "127.0.0.1") {
  throw new Error("MISE_TEST_LAB_APP_URL must target 127.0.0.1")
}

function scalar(sql: string): string {
  return execFileSync("psql", [environment.databaseUrl.toString(), "-X", "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8" }).trim()
}

test("real HTTP -> Next API -> PostgREST -> PostgreSQL creates one idempotent storefront order", async () => {
  const key = "30000000-0000-4000-8000-000000000001"
  const body = {
    location_id: "10000000-0000-4000-8000-000000000001",
    items: [{ id: "20000000-0000-4000-8000-000000000001", qty: 2 }],
    customer: { name: "Testkunde", phone: "+491000000", address: "Testweg 1" },
    type: "lieferung",
    payment_method: "bar",
  }
  const send = () => fetch(`${appUrl}/api/delivery/orders`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": key },
    body: JSON.stringify(body),
  })

  const first = await send()
  if (first.status !== 201) assert.fail(`unexpected create response ${first.status}: ${await first.text()}`)
  const created = await first.json() as { order_id: string; idempotent_replay: boolean }
  assert.match(created.order_id, /^[0-9a-f-]{36}$/)
  assert.equal(created.idempotent_replay, false)

  const replay = await send()
  if (replay.status !== 200) assert.fail(`unexpected replay response ${replay.status}: ${await replay.text()}`)
  const replayed = await replay.json() as { order_id: string; idempotent_replay: boolean }
  assert.equal(replayed.order_id, created.order_id)
  assert.equal(replayed.idempotent_replay, true)

  assert.equal(scalar("select count(*) from customer_orders"), "1")
  assert.equal(scalar("select count(*) from order_items"), "1")
  assert.equal(scalar("select menge||':'||gesamtpreis from order_items"), "2:25.00")
  assert.equal(scalar("select count(*) from storefront_order_requests_v1"), "1")
})
