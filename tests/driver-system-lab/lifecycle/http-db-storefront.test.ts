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

test("real Kitchen token route advances the routed item and atomically makes the order ready", async () => {
  const itemId = scalar("select id from order_items limit 1")
  const endpoint = `${appUrl}/kitchen/display/testlab-kitchen-token/items/${itemId}/advance`
  const advance = async (expected_status: string, target_status: string) => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expected_status, target_status }),
    })
    const body = await response.json() as { ok?: boolean; order_ready?: boolean; idempotent_replay?: boolean; reason_code?: string }
    assert.equal(response.status, 200, JSON.stringify(body))
    assert.equal(body.ok, true)
    return body
  }

  const started = await advance("offen", "in_arbeit")
  assert.equal(started.order_ready, false)
  assert.equal(scalar("select station_status from order_items where id='" + itemId + "'"), "in_arbeit")
  assert.equal(scalar("select status from customer_orders limit 1"), "in_zubereitung")

  const finished = await advance("in_arbeit", "fertig")
  assert.equal(finished.order_ready, true)
  assert.equal(finished.idempotent_replay, false)
  assert.equal(scalar("select station_status from order_items where id='" + itemId + "'"), "fertig")
  assert.equal(scalar("select status||':'||(fertig_am is not null) from customer_orders limit 1"), "fertig:true")

  const replay = await advance("in_arbeit", "fertig")
  assert.equal(replay.order_ready, true)
  assert.equal(replay.idempotent_replay, true)
})

test("Kitchen HTTP boundary rejects invalid transitions, unknown tokens and cross-station items", async () => {
  const itemId = scalar("select id from order_items limit 1")
  const request = (token: string, body: unknown) => fetch(`${appUrl}/kitchen/display/${token}/items/${itemId}/advance`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  assert.equal((await request("testlab-kitchen-token", { expected_status: "fertig", target_status: "offen" })).status, 400)
  assert.equal((await request("unknown-token", { expected_status: "in_arbeit", target_status: "fertig" })).status, 404)
  const crossStation = await request("testlab-other-kitchen-token", { expected_status: "in_arbeit", target_status: "fertig" })
  assert.equal(crossStation.status, 409)
  assert.equal((await crossStation.json() as { reason_code: string }).reason_code, "ITEM_NOT_FOUND")
  assert.equal(scalar("select status from customer_orders limit 1"), "fertig")
})

test("concurrent final Kitchen items serialize and make the order ready exactly once", async () => {
  const create = await fetch(`${appUrl}/api/delivery/orders`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": "30000000-0000-4000-8000-000000000002" },
    body: JSON.stringify({
      location_id: "10000000-0000-4000-8000-000000000001",
      items: [
        { id: "20000000-0000-4000-8000-000000000001", qty: 1 },
        { id: "20000000-0000-4000-8000-000000000002", qty: 1 },
      ],
      customer: { name: "Parallel", phone: "+492000000", address: "Testweg 2" },
      type: "lieferung",
      payment_method: "bar",
    }),
  })
  if (create.status !== 201) assert.fail(`unexpected concurrent fixture response ${create.status}: ${await create.text()}`)
  const orderId = scalar("select id from customer_orders where kunde_name='Parallel'")
  const itemIds = scalar(`select string_agg(id::text,',') from order_items where order_id='${orderId}' order by 1`).split(',')
  assert.equal(itemIds.length, 2)
  const advance = (itemId: string, expected_status: string, target_status: string) => fetch(
    `${appUrl}/kitchen/display/testlab-kitchen-token/items/${itemId}/advance`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expected_status, target_status }) },
  )
  for (const itemId of itemIds) assert.equal((await advance(itemId, "offen", "in_arbeit")).status, 200)
  const finished = await Promise.all(itemIds.map((itemId) => advance(itemId, "in_arbeit", "fertig")))
  assert.deepEqual(finished.map((response) => response.status), [200, 200])
  assert.equal(scalar(`select status||':'||(fertig_am is not null) from customer_orders where id='${orderId}'`), "fertig:true")
  assert.equal(scalar(`select count(*) from order_items where order_id='${orderId}' and station_status='fertig'`), "2")
})
