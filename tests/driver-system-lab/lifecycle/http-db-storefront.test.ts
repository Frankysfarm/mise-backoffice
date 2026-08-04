import assert from "node:assert/strict"
import { execFileSync, spawn } from "node:child_process"
import test from "node:test"
import { assertTestLabEnvironment } from "../support/environment"

const environment = assertTestLabEnvironment()
const configuredAppUrl = process.env.MISE_TEST_LAB_APP_URL
const configuredPostgrestUrl = process.env.MISE_TEST_LAB_POSTGREST_URL
const localServiceKey = process.env.MISE_TEST_LAB_LOCAL_SERVICE_KEY
const localAnonKey = process.env.MISE_TEST_LAB_LOCAL_ANON_KEY
const localAuthenticatedKey = process.env.MISE_TEST_LAB_LOCAL_AUTHENTICATED_KEY
const lifecycleEnabled = Boolean(configuredAppUrl && configuredPostgrestUrl && localServiceKey && localAnonKey && localAuthenticatedKey)
if (configuredAppUrl && new URL(configuredAppUrl).hostname !== "127.0.0.1") {
  throw new Error("MISE_TEST_LAB_APP_URL must target 127.0.0.1")
}
if (configuredPostgrestUrl && new URL(configuredPostgrestUrl).hostname !== "127.0.0.1") {
  throw new Error("MISE_TEST_LAB_POSTGREST_URL must target 127.0.0.1")
}
const appUrl = configuredAppUrl ?? "http://127.0.0.1:1"
const postgrestUrl = configuredPostgrestUrl ?? "http://127.0.0.1:1"
const lifecycleTest = lifecycleEnabled ? test : test.skip
let issuedDriverAccessToken = ""
let issuedAdminCookie = ""

function scalar(sql: string): string {
  return execFileSync("psql", [environment.databaseUrl.toString(), "-X", "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8" }).trim()
}

async function rpc(name: string, payload: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${postgrestUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: localServiceKey!, authorization: `Bearer ${localServiceKey}` },
    body: JSON.stringify(payload),
  })
  return { status: response.status, body: await response.json() as Record<string, unknown> }
}

lifecycleTest("real HTTP -> Next API -> PostgREST -> PostgreSQL creates one idempotent storefront order", async () => {
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

lifecycleTest("real Kitchen token route advances the routed item and atomically makes the order ready", async () => {
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

lifecycleTest("Kitchen HTTP boundary rejects invalid transitions, unknown tokens and cross-station items", async () => {
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

lifecycleTest("real PostgREST Atomic-v2 dispatch creates one assignment, route and push event", async () => {
  const orderId = scalar("select id from customer_orders where kunde_name='Testkunde'")
  const lease = await rpc("fn_dispatch_claim_writer_v2", {
    p_tenant_id: "80000000-0000-4000-8000-000000000001",
    p_writer_id: "91000000-0000-4000-8000-000000000001",
    p_lease_seconds: 120,
  })
  assert.equal(lease.status, 200)
  assert.equal(lease.body.ok, true)
  const writerEpoch = Number(lease.body.writer_epoch)
  assert.equal(Number.isSafeInteger(writerEpoch), true)
  const pickupDeadline = new Date(Date.now() + 20 * 60_000).toISOString()
  const deliveryDeadline = new Date(Date.now() + 50 * 60_000).toISOString()
  const payload = {
    p_tenant_id: "80000000-0000-4000-8000-000000000001",
    p_writer_id: "91000000-0000-4000-8000-000000000001",
    p_writer_epoch: writerEpoch,
    p_driver_id: "90000000-0000-4000-8000-000000000001",
    p_expected_driver_version: 0,
    p_action_id: "92000000-0000-4000-8000-000000000001",
    p_algorithm_version: "testlab-fixture-v1",
    p_orders: [{
      order_id: orderId,
      expected_order_version: 0,
      pickup_lat: 52.5200,
      pickup_lng: 13.4050,
      dropoff_lat: 52.5100,
      dropoff_lng: 13.3900,
      pickup_address: "Testküche",
      dropoff_address: "Testweg 1",
      pickup_deadline_at: pickupDeadline,
      delivery_deadline_at: deliveryDeadline,
    }],
    p_push_title: "Neue Lieferung",
    p_push_body: "Testlab Auftrag",
  }
  const dispatch = () => fetch(`${postgrestUrl}/rest/v1/rpc/fn_dispatch_assign_orders_v2`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: localServiceKey, authorization: `Bearer ${localServiceKey}` },
    body: JSON.stringify(payload),
  })
  const first = await dispatch()
  const assigned = await first.json() as { ok?: boolean; batch_id?: string; idempotent_replay?: boolean; reason_code?: string }
  assert.equal(first.status, 200, JSON.stringify(assigned))
  assert.equal(assigned.ok, true)
  assert.equal(assigned.idempotent_replay, false)

  const replayResponse = await dispatch()
  const replay = await replayResponse.json() as { ok?: boolean; batch_id?: string; idempotent_replay?: boolean }
  assert.equal(replayResponse.status, 200)
  assert.equal(replay.ok, true)
  assert.equal(replay.idempotent_replay, true)
  assert.equal(replay.batch_id, assigned.batch_id)

  assert.equal(scalar(`select status||':'||dispatch_version from customer_orders where id='${orderId}'`), "assigned:1")
  assert.equal(scalar("select count(*) from mise_delivery_batches"), "1")
  assert.equal(scalar("select count(*) from dispatch_offer_assignments"), "1")
  assert.equal(scalar("select string_agg(type||':'||sequence,',' order by sequence) from mise_delivery_batch_stops"), "pickup:0,dropoff:1")
  assert.equal(scalar("select state||':'||state_version||':'||current_capacity from mise_drivers where id='90000000-0000-4000-8000-000000000001'"), "assigned:1:1")
  assert.equal(scalar("select count(*) from mise_push_outbox where type='order_assigned'"), "1")
  assert.equal(scalar("select count(*) from dispatch_assignment_requests_v2 where action='assign'"), "1")

  const conflicting = structuredClone(payload)
  conflicting.p_action_id = "92000000-0000-4000-8000-000000000002"
  const conflictResponse = await fetch(`${postgrestUrl}/rest/v1/rpc/fn_dispatch_assign_orders_v2`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: localServiceKey, authorization: `Bearer ${localServiceKey}` },
    body: JSON.stringify(conflicting),
  })
  const conflict = await conflictResponse.json() as { ok?: boolean; reason_code?: string }
  assert.equal(conflictResponse.status, 200)
  assert.equal(conflict.ok, false)
  assert.equal(conflict.reason_code, "DRIVER_NOT_ELIGIBLE")
  assert.equal(scalar("select count(*) from mise_push_outbox"), "1")
})

lifecycleTest("real Driver lifecycle enforces complete pick manifest and reaches terminal delivery", async () => {
  const tenantId = "80000000-0000-4000-8000-000000000001"
  const driverId = "90000000-0000-4000-8000-000000000001"
  const orderId = scalar("select id from customer_orders where kunde_name='Testkunde'")
  const assignmentId = scalar(`select id from dispatch_offer_assignments where order_id='${orderId}'`)
  const batchId = scalar(`select batch_id from dispatch_offer_assignments where order_id='${orderId}'`)
  const pickupStopId = scalar(`select id from mise_delivery_batch_stops where batch_id='${batchId}' and type='pickup'`)
  const dropoffStopId = scalar(`select id from mise_delivery_batch_stops where batch_id='${batchId}' and type='dropoff'`)
  const itemIds = scalar(`select string_agg(id::text,',' order by id) from order_items where order_id='${orderId}'`).split(',')

  const ack = await rpc("fn_driver_accept_ack_compat_v2", {
    p_tenant_id: tenantId, p_assignment_id: assignmentId, p_driver_id: driverId,
    p_snapshot_version: 1, p_receipt_key: "93000000-0000-4000-8000-000000000001",
    p_metadata: { source: "testlab" }, p_api_version: "driver-v2",
    p_correlation_id: "94000000-0000-4000-8000-000000000001",
  })
  assert.equal(ack.status, 200)
  assert.equal(ack.body.ok, true)
  assert.equal(scalar(`select received_by_app_at is not null from dispatch_offer_assignments where id='${assignmentId}'`), "t")

  const arrivedPickup = await rpc("fn_driver_arrive_v2", {
    p_tenant_id: tenantId, p_stop_id: pickupStopId, p_expected_stop_version: 0,
    p_expected_batch_version: 1, p_expected_route_version: 1, p_expected_driver_version: 1,
    p_actor_driver_id: driverId, p_action_id: "93000000-0000-4000-8000-000000000002",
    p_correlation_id: "94000000-0000-4000-8000-000000000002",
  })
  assert.equal(arrivedPickup.status, 200)
  assert.equal(arrivedPickup.body.ok, true)

  const incompletePickup = await rpc("fn_driver_pickup_batch_v2", {
    p_tenant_id: tenantId, p_batch_id: batchId, p_expected_batch_version: 1,
    p_expected_route_version: 1, p_expected_driver_version: 1, p_actor_driver_id: driverId,
    p_action_id: "93000000-0000-4000-8000-000000000003", p_manifest: [{
      order_id: orderId, assignment_id: assignmentId, assignment_version: 1,
      order_version: 1, stop_id: pickupStopId, stop_version: 1, items: [],
    }], p_correlation_id: "94000000-0000-4000-8000-000000000003",
  })
  assert.equal(incompletePickup.body.ok, false)
  assert.equal(incompletePickup.body.reason_code, "REQUIRED_ITEM_SET_MISMATCH")
  assert.equal(scalar(`select state from mise_delivery_batches where id='${batchId}'`), "assigned")

  const manifest = [{
    order_id: orderId, assignment_id: assignmentId, assignment_version: 1,
    order_version: 1, stop_id: pickupStopId, stop_version: 1,
    items: itemIds.map((id) => ({ id, outcome: "present_confirmed", evidence: {} })),
  }]
  const pickup = await rpc("fn_driver_pickup_batch_v2", {
    p_tenant_id: tenantId, p_batch_id: batchId, p_expected_batch_version: 1,
    p_expected_route_version: 1, p_expected_driver_version: 1, p_actor_driver_id: driverId,
    p_action_id: "93000000-0000-4000-8000-000000000004", p_manifest: manifest,
    p_correlation_id: "94000000-0000-4000-8000-000000000004",
  })
  assert.equal(pickup.status, 200)
  assert.equal(pickup.body.ok, true)
  assert.equal(pickup.body.state, "in_progress")
  assert.equal(scalar(`select status||':'||dispatch_version from customer_orders where id='${orderId}'`), "out_for_delivery:3")
  assert.equal(scalar(`select count(*) from driver_item_outcomes_v2 where order_id='${orderId}' and outcome='present_confirmed'`), String(itemIds.length))

  const arrivedDropoff = await rpc("fn_driver_arrive_v2", {
    p_tenant_id: tenantId, p_stop_id: dropoffStopId, p_expected_stop_version: 0,
    p_expected_batch_version: 3, p_expected_route_version: 1, p_expected_driver_version: 3,
    p_actor_driver_id: driverId, p_action_id: "93000000-0000-4000-8000-000000000005",
    p_correlation_id: "94000000-0000-4000-8000-000000000005",
  })
  assert.equal(arrivedDropoff.body.ok, true)

  const completePayload = {
    p_tenant_id: tenantId, p_order_id: orderId, p_expected_order_version: 3,
    p_expected_assignment_version: 3, p_expected_batch_version: 3, p_expected_driver_version: 3,
    p_actor_driver_id: driverId, p_action_id: "93000000-0000-4000-8000-000000000006",
    p_stop_id: dropoffStopId, p_expected_stop_version: 1, p_expected_route_version: 1,
    p_correlation_id: "94000000-0000-4000-8000-000000000006",
  }
  const completed = await rpc("fn_driver_complete_v2", completePayload)
  assert.equal(completed.status, 200)
  assert.equal(completed.body.ok, true)
  const completeReplay = await rpc("fn_driver_complete_v2", completePayload)
  assert.equal(completeReplay.body.ok, true)
  assert.equal(completeReplay.body.idempotent_replay, true)

  assert.equal(scalar(`select status||':'||dispatch_version||':'||(geliefert_am is not null) from customer_orders where id='${orderId}'`), "delivered:4:true")
  assert.equal(scalar(`select state||':'||assignment_version from dispatch_offer_assignments where id='${assignmentId}'`), "completed:4")
  assert.equal(scalar(`select state||':'||state_version from mise_delivery_batches where id='${batchId}'`), "completed:4")
  assert.equal(scalar(`select state||':'||state_version||':'||current_capacity from mise_drivers where id='${driverId}'`), "returning:4:0")
  assert.equal(scalar(`select string_agg(type||':'||state,',' order by sequence) from mise_delivery_batch_stops where batch_id='${batchId}'`), "pickup:completed,dropoff:completed")
  assert.equal(scalar("select count(*) from mise_push_outbox"), "1")

  const redispatch = await rpc("fn_dispatch_assign_orders_v2", {
    p_tenant_id: tenantId,
    p_writer_id: "91000000-0000-4000-8000-000000000001",
    p_writer_epoch: Number(scalar(`select writer_epoch from dispatch_writer_gates where tenant_id='${tenantId}'`)),
    p_driver_id: driverId,
    p_expected_driver_version: 4,
    p_action_id: "92000000-0000-4000-8000-000000000003",
    p_algorithm_version: "testlab-fixture-v1",
    p_orders: [{
      order_id: orderId, expected_order_version: 4,
      pickup_lat: 52.5200, pickup_lng: 13.4050, dropoff_lat: 52.5100, dropoff_lng: 13.3900,
      pickup_address: "Testküche", dropoff_address: "Testweg 1",
      pickup_deadline_at: new Date(Date.now() + 20 * 60_000).toISOString(),
      delivery_deadline_at: new Date(Date.now() + 50 * 60_000).toISOString(),
    }],
    p_push_title: "Neue Lieferung", p_push_body: "Darf nicht entstehen",
  })
  assert.equal(redispatch.status, 200)
  assert.equal(redispatch.body.ok, false)
  assert.equal(redispatch.body.reason_code, "ORDER_NOT_ASSIGNABLE")
  assert.equal(scalar("select count(*) from mise_delivery_batches"), "1")
  assert.equal(scalar("select count(*) from dispatch_offer_assignments"), "1")
  assert.equal(scalar("select count(*) from mise_push_outbox"), "1")
})

lifecycleTest("concurrent final Kitchen items serialize and make the order ready exactly once", async () => {
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

lifecycleTest("parallel Atomic-v2 writers produce one winner and response-loss retry is idempotent", async () => {
  const tenantId = "80000000-0000-4000-8000-000000000001"
  const writerId = "91000000-0000-4000-8000-000000000001"
  const driverId = "90000000-0000-4000-8000-000000000001"
  const orderId = scalar("select id from customer_orders where kunde_name='Parallel'")
  const lease = await rpc("fn_dispatch_claim_writer_v2", {
    p_tenant_id: tenantId, p_writer_id: writerId, p_lease_seconds: 120,
  })
  assert.equal(lease.body.ok, true)
  const common = {
    p_tenant_id: tenantId, p_writer_id: writerId, p_writer_epoch: Number(lease.body.writer_epoch),
    p_driver_id: driverId, p_expected_driver_version: 4,
    p_algorithm_version: "testlab-race-v1",
    p_orders: [{
      order_id: orderId, expected_order_version: 0,
      pickup_lat: 52.5200, pickup_lng: 13.4050, dropoff_lat: 52.5000, dropoff_lng: 13.3800,
      pickup_address: "Testküche", dropoff_address: "Testweg 2",
      pickup_deadline_at: new Date(Date.now() + 20 * 60_000).toISOString(),
      delivery_deadline_at: new Date(Date.now() + 50 * 60_000).toISOString(),
    }],
    p_push_title: "Neue Lieferung", p_push_body: "Race-Auftrag",
  }
  const firstPayload = { ...common, p_action_id: "92000000-0000-4000-8000-000000000010" }
  const secondPayload = { ...common, p_action_id: "92000000-0000-4000-8000-000000000011" }
  const [first, second] = await Promise.all([
    rpc("fn_dispatch_assign_orders_v2", firstPayload),
    rpc("fn_dispatch_assign_orders_v2", secondPayload),
  ])
  const results = [first.body, second.body]
  assert.equal(results.filter((result) => result.ok === true).length, 1)
  assert.equal(results.filter((result) => result.ok === false).length, 1)
  assert.ok(["DRIVER_NOT_ELIGIBLE", "ORDER_NOT_ASSIGNABLE"].includes(String(results.find((result) => result.ok === false)?.reason_code)))

  const winningPayload = first.body.ok === true ? firstPayload : secondPayload
  const winningBatch = String((first.body.ok === true ? first.body : second.body).batch_id)
  const responseLossRetry = await rpc("fn_dispatch_assign_orders_v2", winningPayload)
  assert.equal(responseLossRetry.body.ok, true)
  assert.equal(responseLossRetry.body.idempotent_replay, true)
  assert.equal(responseLossRetry.body.batch_id, winningBatch)

  assert.equal(scalar(`select count(*) from dispatch_offer_assignments where order_id='${orderId}'`), "1")
  assert.equal(scalar(`select count(*) from mise_delivery_batches where id='${winningBatch}'`), "1")
  assert.equal(scalar(`select count(*) from mise_push_outbox where data->>'batch_id'='${winningBatch}'`), "1")
  assert.equal(scalar(`select status||':'||dispatch_version from customer_orders where id='${orderId}'`), "assigned:1")
  assert.equal(scalar(`select state||':'||state_version||':'||current_capacity from mise_drivers where id='${driverId}'`), "assigned:5:1")
})

lifecycleTest("canonical database snapshot has no lifecycle invariant violations", () => {
  const violations = {
    active_assignment_duplicates: scalar(`select count(*) from (select order_id from dispatch_offer_assignments where state in ('offered','accepted','assigned','picked_up','in_progress') group by order_id having count(*)>1) x`),
    active_batch_duplicates: scalar(`select count(*) from (select driver_id from mise_delivery_batches where state in ('pending_acceptance','assigned','at_pickup','in_progress','on_route') group by driver_id having count(*)>1) x`),
    orphan_assignments: scalar(`select count(*) from dispatch_offer_assignments a left join customer_orders o on o.id=a.order_id left join mise_delivery_batches b on b.id=a.batch_id left join mise_drivers d on d.id=a.driver_id where o.id is null or b.id is null or d.id is null`),
    orphan_stops: scalar(`select count(*) from mise_delivery_batch_stops s left join mise_delivery_batches b on b.id=s.batch_id left join customer_orders o on o.id=s.order_id where b.id is null or o.id is null`),
    capacity_mismatch: scalar(`select count(*) from mise_drivers d where d.current_capacity<>(select count(*) from dispatch_offer_assignments a where a.driver_id=d.id and a.state in ('assigned','picked_up','in_progress'))`),
    terminal_active_assignments: scalar(`select count(*) from customer_orders o join dispatch_offer_assignments a on a.order_id=o.id where o.status in ('delivered','cancelled') and a.state in ('offered','accepted','assigned','picked_up','in_progress')`),
    duplicate_assignment_pushes: scalar(`select count(*) from (select data->>'batch_id' from mise_push_outbox where type='order_assigned' group by data->>'batch_id' having count(*)>1) x`),
    invalid_stop_sequences: scalar(`select count(*) from (select batch_id,min(sequence) lo,max(sequence) hi,count(*) n,count(distinct sequence) dn from mise_delivery_batch_stops group by batch_id having min(sequence)<>0 or max(sequence)<>count(*)-1 or count(*)<>count(distinct sequence)) x`),
  }
  assert.deepEqual(violations, Object.fromEntries(Object.keys(violations).map((key) => [key, "0"])))
})

lifecycleTest("PostgREST restart preserves terminal state and idempotent completion recovery", async () => {
  const container = process.env.MISE_TEST_LAB_POSTGREST_CONTAINER
  if (!container?.startsWith("mise-testlab-postgrest-tl_")) throw new Error("guarded local PostgREST container required")
  execFileSync("docker", ["restart", container], { stdio: "pipe" })
  let ready = false
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${postgrestUrl}/rest/v1/`, {
        headers: { apikey: localServiceKey!, authorization: `Bearer ${localServiceKey}` },
      })
      if (response.ok) { ready = true; break }
    } catch { /* expected while the local service restarts */ }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  assert.equal(ready, true)

  const orderId = scalar("select id from customer_orders where kunde_name='Testkunde'")
  const assignmentId = scalar(`select id from dispatch_offer_assignments where order_id='${orderId}'`)
  const batchId = scalar(`select batch_id from dispatch_offer_assignments where order_id='${orderId}'`)
  const dropoffStopId = scalar(`select id from mise_delivery_batch_stops where batch_id='${batchId}' and type='dropoff'`)
  const replay = await rpc("fn_driver_complete_v2", {
    p_tenant_id: "80000000-0000-4000-8000-000000000001", p_order_id: orderId,
    p_expected_order_version: 3, p_expected_assignment_version: 3,
    p_expected_batch_version: 3, p_expected_driver_version: 3,
    p_actor_driver_id: "90000000-0000-4000-8000-000000000001",
    p_action_id: "93000000-0000-4000-8000-000000000006",
    p_stop_id: dropoffStopId, p_expected_stop_version: 1, p_expected_route_version: 1,
    p_correlation_id: "94000000-0000-4000-8000-000000000006",
  })
  assert.equal(replay.status, 200)
  assert.equal(replay.body.ok, true)
  assert.equal(replay.body.idempotent_replay, true)
  assert.equal(scalar(`select status from customer_orders where id='${orderId}'`), "delivered")
  assert.equal(scalar(`select state from dispatch_offer_assignments where id='${assignmentId}'`), "completed")
  assert.equal(scalar("select count(*) from mise_push_outbox"), "2")
})

lifecycleTest("PostgREST grants and RLS deny browser roles from canonical lifecycle writes", async () => {
  const deniedRpcPayload = {
    p_tenant_id: "80000000-0000-4000-8000-000000000001",
    p_writer_id: "91000000-0000-4000-8000-000000000001", p_writer_epoch: 1,
    p_driver_id: "90000000-0000-4000-8000-000000000001", p_expected_driver_version: 5,
    p_action_id: "92000000-0000-4000-8000-000000000099", p_algorithm_version: "forbidden",
    p_orders: [], p_push_title: "forbidden", p_push_body: "forbidden",
  }
  for (const token of [localAnonKey, localAuthenticatedKey]) {
    const rpcResponse = await fetch(`${postgrestUrl}/rest/v1/rpc/fn_dispatch_assign_orders_v2`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: token!, authorization: `Bearer ${token}` },
      body: JSON.stringify(deniedRpcPayload),
    })
    assert.ok([401, 403, 404].includes(rpcResponse.status), `unexpected browser-role RPC status ${rpcResponse.status}`)

    const directWrite = await fetch(`${postgrestUrl}/rest/v1/customer_orders?id=eq.${scalar("select id from customer_orders limit 1")}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", apikey: token!, authorization: `Bearer ${token}`, prefer: "return=representation" },
      body: JSON.stringify({ status: "delivered" }),
    })
    assert.ok([401, 403, 404].includes(directWrite.status), `unexpected browser-role write status ${directWrite.status}`)
  }
  assert.equal(scalar("select count(*) from dispatch_assignment_requests_v2 where action='forbidden'"), "0")
})

lifecycleTest("GoTrue-issued JWT authenticates the real Driver snapshot boundary and invalid JWT fails closed", async () => {
  const signup = await fetch(`${postgrestUrl}/auth/v1/signup`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: localAnonKey! },
    body: JSON.stringify({ email: "driver-testlab@mise.invalid", password: "Testlab-Driver-Password-2026!" }),
  })
  const auth = await signup.json() as { access_token?: string; user?: { id?: string }; error?: string; msg?: string }
  assert.equal(signup.status, 200, JSON.stringify(auth))
  assert.match(auth.access_token ?? "", /^ey[^.]*\.[^.]+\.[^.]+$/)
  assert.match(auth.user?.id ?? "", /^[0-9a-f-]{36}$/)

  const authUserId = auth.user!.id!
  issuedDriverAccessToken = auth.access_token!
  scalar(`update mise_drivers set auth_user_id='${authUserId}' where id='90000000-0000-4000-8000-000000000001'`)
  assert.equal(scalar(`select count(*) from auth.users where id='${authUserId}' and confirmed_at is not null`), "1")

  const snapshotResponse = await fetch(`${appUrl}/api/driver/v2/snapshot`, {
    headers: { authorization: `Bearer ${auth.access_token}` },
  })
  const snapshot = await snapshotResponse.json() as {
    ok?: boolean
    reason_code?: string
    snapshot?: { driver?: { id?: string }; assignment?: { state?: string } | null }
  }
  assert.equal(snapshotResponse.status, 200, JSON.stringify(snapshot))
  assert.equal(snapshot.ok, true)
  assert.equal(snapshot.snapshot?.driver?.id, "90000000-0000-4000-8000-000000000001")
  assert.equal(snapshot.snapshot?.assignment?.state, "assigned")

  const denied = await fetch(`${appUrl}/api/driver/v2/snapshot`, {
    headers: { authorization: "Bearer eyInvalid.header.signature" },
  })
  const deniedBody = await denied.json() as { ok?: boolean; reason_code?: string }
  assert.equal(denied.status, 401, JSON.stringify(deniedBody))
  assert.equal(deniedBody.ok, false)
  assert.equal(deniedBody.reason_code, "UNAUTHORIZED")
})

lifecycleTest("parallel HTTP requests in the ordered lifecycle deduplicate one Driver event and stale replay preserves canonical state", async () => {
  const actionId = "93000000-0000-4000-8000-000000000023"
  const staleActionId = "93000000-0000-4000-8000-000000000024"
  const activeAssignmentId = scalar(`select id from dispatch_offer_assignments where driver_id='90000000-0000-4000-8000-000000000001' and state='assigned'`)
  const previousAuthUserId = scalar(`select auth_user_id from mise_drivers where id='90000000-0000-4000-8000-000000000001'`)
  const signup = await fetch(`${postgrestUrl}/auth/v1/signup`, {
    method: "POST", headers: { "content-type": "application/json", apikey: localAnonKey! },
    body: JSON.stringify({ email: "driver-parallel-testlab@mise.invalid", password: "Testlab-Parallel-Password-2026!" }),
  })
  const auth = await signup.json() as { access_token?: string; user?: { id?: string } }
  assert.equal(signup.status, 200, JSON.stringify(auth))
  scalar(`update mise_drivers set auth_user_id='${auth.user!.id!}' where id='90000000-0000-4000-8000-000000000001'`)
  const snapshotResponse = await fetch(`${appUrl}/api/driver/v2/snapshot`, { headers: { authorization: `Bearer ${auth.access_token}` } })
  const snapshotBody = await snapshotResponse.json() as { snapshot?: { driver?: { version?: number }; assignment?: { id?: string; version?: number } } }
  assert.equal(snapshotResponse.status, 200, JSON.stringify(snapshotBody))
  assert.equal(snapshotBody.snapshot?.assignment?.id, activeAssignmentId)
  const expectedDriverVersion = snapshotBody.snapshot!.driver!.version!
  const expectedAssignmentVersion = snapshotBody.snapshot!.assignment!.version!
  const request = (id: string, assignmentVersion: number) => fetch(`${appUrl}/api/driver/v2/assignments/ack`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${auth.access_token}` },
    body: JSON.stringify({
      action_id: id,
      expected_state: "assigned",
      expected_versions: { driver: expectedDriverVersion, assignment: assignmentVersion },
      occurred_at: "2026-08-04T00:00:23.000Z",
    }),
  })

  const [firstResponse, secondResponse] = await Promise.all([
    request(actionId, expectedAssignmentVersion),
    request(actionId, expectedAssignmentVersion),
  ])
  const concurrent = await Promise.all([
    firstResponse.json() as Promise<{ ok?: boolean; idempotent_replay?: boolean; assignment_id?: string }>,
    secondResponse.json() as Promise<{ ok?: boolean; idempotent_replay?: boolean; assignment_id?: string }>,
  ])
  assert.deepEqual([firstResponse.status, secondResponse.status], [200, 200])
  assert.equal(concurrent.every((result) => result.ok === true), true)
  assert.equal(concurrent.filter((result) => result.idempotent_replay === true).length, 1)
  assert.deepEqual(concurrent.map((result) => result.assignment_id), [activeAssignmentId, activeAssignmentId])
  assert.equal(scalar(`select count(*) from driver_action_requests_v2 where action_id='${actionId}'`), "1")
  assert.equal(scalar(`select count(*) from driver_api_compatibility_events_v2 where correlation_id=(select correlation_id from driver_action_requests_v2 where action_id='${actionId}')`), "1")

  const fingerprint = () => scalar(`select md5(concat_ws('|',
    (select coalesce(jsonb_agg(to_jsonb(a) order by a.id)::text,'[]') from dispatch_offer_assignments a where a.id='${activeAssignmentId}'),
    (select coalesce(jsonb_agg(to_jsonb(d) order by d.id)::text,'[]') from mise_drivers d where d.id='90000000-0000-4000-8000-000000000001'),
    (select coalesce(jsonb_agg(to_jsonb(b) order by b.id)::text,'[]') from mise_delivery_batches b where b.id=(select batch_id from dispatch_offer_assignments where id='${activeAssignmentId}')),
    (select coalesce(jsonb_agg(to_jsonb(o) order by o.id)::text,'[]') from customer_orders o where o.id=(select order_id from dispatch_offer_assignments where id='${activeAssignmentId}')),
    (select coalesce(jsonb_agg(to_jsonb(s) order by s.id)::text,'[]') from mise_delivery_batch_stops s where s.batch_id=(select batch_id from dispatch_offer_assignments where id='${activeAssignmentId}')),
    (select coalesce(jsonb_agg(to_jsonb(p) order by p.id)::text,'[]') from mise_push_outbox p where p.data->>'batch_id'=(select batch_id::text from dispatch_offer_assignments where id='${activeAssignmentId}')),
    (select coalesce(jsonb_agg(to_jsonb(r) order by r.action_id)::text,'[]') from driver_action_requests_v2 r where r.action_id='${staleActionId}'),
    (select coalesce(jsonb_agg(to_jsonb(e) order by e.id)::text,'[]') from driver_api_compatibility_events_v2 e where e.correlation_id='${staleActionId}')
  ))`)
  const beforeStale = fingerprint()
  const staleResponse = await request(staleActionId, expectedAssignmentVersion - 1)
  const stale = await staleResponse.json() as { ok?: boolean; reason_code?: string }
  assert.equal(staleResponse.status, 409, JSON.stringify(stale))
  assert.equal(stale.ok, false)
  assert.equal(stale.reason_code, "EXPECTED_ASSIGNMENT_VERSION_CONFLICT")
  assert.equal(scalar(`select count(*) from driver_action_requests_v2 where action_id='${staleActionId}'`), "0")
  assert.equal(fingerprint(), beforeStale)
  scalar(`update mise_drivers set auth_user_id='${previousAuthUserId}' where id='90000000-0000-4000-8000-000000000001'`)
})

lifecycleTest("GoTrue SSR cookie authenticates the real tenant-scoped Admin drivers route", async () => {
  const signup = await fetch(`${postgrestUrl}/auth/v1/signup`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: localAnonKey! },
    body: JSON.stringify({ email: "admin-testlab@mise.invalid", password: "Testlab-Admin-Password-2026!" }),
  })
  const session = await signup.json() as {
    access_token?: string
    refresh_token?: string
    token_type?: string
    expires_in?: number
    user?: { id?: string; aud?: string; role?: string }
  }
  assert.equal(signup.status, 200, JSON.stringify(session))
  assert.match(session.user?.id ?? "", /^[0-9a-f-]{36}$/)
  assert.match(session.access_token ?? "", /^ey[^.]*\.[^.]+\.[^.]+$/)
  assert.ok(session.refresh_token)

  const authUserId = session.user!.id!
  scalar(`update employees set auth_user_id='${authUserId}' where id='81000000-0000-4000-8000-000000000001'`)
  const cookieSession = {
    ...session,
    expires_at: Math.floor(Date.now() / 1000) + Number(session.expires_in ?? 3600),
  }
  const cookieValue = `base64-${Buffer.from(JSON.stringify(cookieSession), "utf8").toString("base64url")}`
  issuedAdminCookie = `sb-127-auth-token=${cookieValue}`
  const adminResponse = await fetch(`${appUrl}/api/admin/drivers`, {
    headers: { cookie: issuedAdminCookie },
    redirect: "manual",
  })
  const adminBody = await adminResponse.json() as {
    ok?: boolean
    drivers?: Array<{ id?: string; link_status?: string }>
  }
  assert.equal(adminResponse.status, 200, JSON.stringify(adminBody))
  assert.equal(adminBody.ok, true)
  assert.equal(scalar("select count(*) from mise_drivers"), "2")
  assert.equal(adminBody.drivers?.length, 1)
  assert.equal(adminBody.drivers?.[0]?.id, "90000000-0000-4000-8000-000000000001")
  assert.equal(adminBody.drivers?.[0]?.link_status, "active")

  const unauthenticated = await fetch(`${appUrl}/api/admin/drivers`, { redirect: "manual" })
  assert.ok([307, 401].includes(unauthenticated.status))
  if (unauthenticated.status === 307) {
    assert.match(unauthenticated.headers.get("location") ?? "", /\/login\?next=%2Fapi%2Fadmin%2Fdrivers/)
  }
})

lifecycleTest("GoTrue restart preserves issued Driver and Admin sessions through real API boundaries", async () => {
  const container = process.env.MISE_TEST_LAB_GOTRUE_CONTAINER
  if (!container?.startsWith("mise-testlab-gotrue-tl_")) throw new Error("guarded local GoTrue container required")
  assert.match(issuedDriverAccessToken, /^ey[^.]*\.[^.]+\.[^.]+$/)
  assert.match(issuedAdminCookie, /^sb-127-auth-token=base64-/)

  execFileSync("docker", ["restart", container], { stdio: "pipe" })
  let ready = false
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${postgrestUrl}/auth/v1/health`)
      if (response.ok) { ready = true; break }
    } catch { /* expected while the isolated auth service restarts */ }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  assert.equal(ready, true)

  const driver = await fetch(`${appUrl}/api/driver/v2/snapshot`, {
    headers: { authorization: `Bearer ${issuedDriverAccessToken}` },
  })
  const driverBody = await driver.json() as { ok?: boolean; snapshot?: { driver?: { id?: string } } }
  assert.equal(driver.status, 200, JSON.stringify(driverBody))
  assert.equal(driverBody.ok, true)
  assert.equal(driverBody.snapshot?.driver?.id, "90000000-0000-4000-8000-000000000001")

  const admin = await fetch(`${appUrl}/api/admin/drivers`, {
    headers: { cookie: issuedAdminCookie }, redirect: "manual",
  })
  const adminBody = await admin.json() as { ok?: boolean; drivers?: Array<{ id?: string }> }
  assert.equal(admin.status, 200, JSON.stringify(adminBody))
  assert.equal(adminBody.ok, true)
  assert.deepEqual(adminBody.drivers?.map((row) => row.id), ["90000000-0000-4000-8000-000000000001"])
})

lifecycleTest("lost Driver HTTP acknowledgement response retries idempotently without a second write", async () => {
  const actionId = "93000000-0000-4000-8000-000000000020"
  const activeAssignmentId = scalar(`select id from dispatch_offer_assignments where driver_id='90000000-0000-4000-8000-000000000001' and state='assigned'`)
  const payload = {
    action_id: actionId,
    expected_state: "assigned",
    expected_versions: { driver: 5, assignment: 1 },
    occurred_at: new Date().toISOString(),
  }
  const acknowledge = () => fetch(`${appUrl}/api/driver/v2/assignments/ack`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${issuedDriverAccessToken}` },
    body: JSON.stringify(payload),
  })

  const lostResponse = await acknowledge()
  assert.equal(lostResponse.status, 200)
  // Deliberately discard the first response body, matching a committed request
  // whose network response never reaches the app. Retry the identical envelope.
  await lostResponse.body?.cancel()
  const retry = await acknowledge()
  const replay = await retry.json() as {
    ok?: boolean
    idempotent_replay?: boolean
    assignment_id?: string
    snapshot?: { assignment?: { id?: string } | null }
  }
  assert.equal(retry.status, 200, JSON.stringify(replay))
  assert.equal(replay.ok, true)
  assert.equal(replay.idempotent_replay, true)
  assert.equal(replay.assignment_id, activeAssignmentId)
  assert.equal(replay.snapshot?.assignment?.id, activeAssignmentId)
  assert.equal(scalar(`select count(*) from driver_action_requests_v2 where action_id='${actionId}'`), "1")
  assert.equal(scalar(`select count(*) from driver_api_compatibility_events_v2 where correlation_id=(select correlation_id from driver_action_requests_v2 where action_id='${actionId}')`), "1")
  assert.equal(scalar(`select received_by_app_at is not null from dispatch_offer_assignments where id='${activeAssignmentId}'`), "t")
})

lifecycleTest("Driver HTTP boundary rejects changed idempotency payload and stale assignment version without writes", async () => {
  const reusedActionId = "93000000-0000-4000-8000-000000000020"
  const changed = await fetch(`${appUrl}/api/driver/v2/assignments/ack`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${issuedDriverAccessToken}` },
    body: JSON.stringify({
      action_id: reusedActionId,
      expected_state: "assigned",
      expected_versions: { driver: 5, assignment: 1 },
      occurred_at: "2026-08-03T00:00:00.000Z",
    }),
  })
  const changedBody = await changed.json() as { ok?: boolean; reason_code?: string }
  assert.equal(changed.status, 409, JSON.stringify(changedBody))
  assert.equal(changedBody.ok, false)
  assert.equal(changedBody.reason_code, "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST")

  const staleActionId = "93000000-0000-4000-8000-000000000021"
  const stale = await fetch(`${appUrl}/api/driver/v2/assignments/ack`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${issuedDriverAccessToken}` },
    body: JSON.stringify({
      action_id: staleActionId,
      expected_state: "assigned",
      expected_versions: { driver: 5, assignment: 0 },
    }),
  })
  const staleBody = await stale.json() as { ok?: boolean; reason_code?: string }
  assert.equal(stale.status, 409, JSON.stringify(staleBody))
  assert.equal(staleBody.ok, false)
  assert.equal(staleBody.reason_code, "EXPECTED_ASSIGNMENT_VERSION_CONFLICT")

  assert.equal(scalar(`select count(*) from driver_action_requests_v2 where action_id in ('${reusedActionId}','${staleActionId}')`), "1")
  assert.equal(scalar(`select count(*) from driver_api_compatibility_events_v2 where correlation_id=(select correlation_id from driver_action_requests_v2 where action_id='${reusedActionId}')`), "1")
})

lifecycleTest("PostgREST outage before Driver acknowledgement fails closed and recovery commits once", async () => {
  const container = process.env.MISE_TEST_LAB_POSTGREST_CONTAINER
  if (!container?.startsWith("mise-testlab-postgrest-tl_")) throw new Error("guarded local PostgREST container required")
  const actionId = "93000000-0000-4000-8000-000000000022"
  const payload = {
    action_id: actionId,
    expected_state: "assigned",
    expected_versions: { driver: 5, assignment: 1 },
    occurred_at: "2026-08-03T00:00:22.000Z",
  }
  const acknowledge = () => fetch(`${appUrl}/api/driver/v2/assignments/ack`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${issuedDriverAccessToken}` },
    body: JSON.stringify(payload),
  })

  execFileSync("docker", ["stop", container], { stdio: "pipe" })
  try {
    const unavailable = await acknowledge()
    const unavailableBody = await unavailable.json() as { ok?: boolean; reason_code?: string }
    assert.equal(unavailable.status, 503, JSON.stringify(unavailableBody))
    assert.equal(unavailableBody.ok, false)
    assert.equal(unavailableBody.reason_code, "DRIVER_V2_SERVICE_UNAVAILABLE")
    assert.equal(scalar(`select count(*) from driver_action_requests_v2 where action_id='${actionId}'`), "0")
  } finally {
    execFileSync("docker", ["start", container], { stdio: "pipe" })
  }
  let ready = false
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${postgrestUrl}/rest/v1/`, {
        headers: { apikey: localServiceKey!, authorization: `Bearer ${localServiceKey}` },
      })
      if (response.ok) { ready = true; break }
    } catch { /* expected during guarded local restart */ }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  assert.equal(ready, true)

  const recovered = await acknowledge()
  const recoveredBody = await recovered.json() as { ok?: boolean; idempotent_replay?: boolean }
  assert.equal(recovered.status, 200, JSON.stringify(recoveredBody))
  assert.equal(recoveredBody.ok, true)
  assert.notEqual(recoveredBody.idempotent_replay, true)
  assert.equal(scalar(`select count(*) from driver_action_requests_v2 where action_id='${actionId}'`), "1")
  assert.equal(scalar(`select count(*) from driver_api_compatibility_events_v2 where correlation_id=(select correlation_id from driver_action_requests_v2 where action_id='${actionId}')`), "1")
})

lifecycleTest("Next application restart preserves Storefront idempotency and database state", async () => {
  const oldPid = Number(process.env.MISE_TEST_LAB_NEXT_PID)
  if (!Number.isSafeInteger(oldPid) || oldPid <= 1) throw new Error("guarded local Next pid required")
  process.kill(oldPid, "SIGTERM")
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      await fetch(`${appUrl}/api/health`, { signal: AbortSignal.timeout(200) })
    } catch { break }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  const port = new URL(appUrl).port
  const next = spawn("./node_modules/.bin/next", ["dev", "-p", port], {
    cwd: process.cwd(), env: process.env, stdio: "ignore",
  })
  try {
    let ready = false
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (next.exitCode !== null) throw new Error(`restarted Next exited with ${next.exitCode}`)
      try {
        const response = await fetch(`${appUrl}/api/delivery/orders`, {
          method: "POST",
          headers: { "content-type": "application/json", "idempotency-key": "30000000-0000-4000-8000-000000000001" },
          body: JSON.stringify({
            location_id: "10000000-0000-4000-8000-000000000001",
            items: [{ id: "20000000-0000-4000-8000-000000000001", qty: 2 }],
            customer: { name: "Testkunde", phone: "+491000000", address: "Testweg 1" },
            type: "lieferung", payment_method: "bar",
          }),
        })
        if (response.status === 200) {
          const replay = await response.json() as { order_id?: string; idempotent_replay?: boolean }
          assert.equal(replay.idempotent_replay, true)
          assert.equal(replay.order_id, scalar("select id from customer_orders where kunde_name='Testkunde'"))
          ready = true
          break
        }
      } catch { /* expected while the local app restarts */ }
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    assert.equal(ready, true)
    assert.equal(scalar("select count(*) from customer_orders"), "2")
    assert.equal(scalar("select count(*) from storefront_order_requests_v1"), "2")
    assert.equal(scalar("select count(*) from mise_push_outbox"), "2")

    const driverAfterRestart = await fetch(`${appUrl}/api/driver/v2/snapshot`, {
      headers: { authorization: `Bearer ${issuedDriverAccessToken}` },
    })
    const driverBody = await driverAfterRestart.json() as {
      ok?: boolean
      snapshot?: { driver?: { id?: string }; assignment?: { received_by_app_at?: string | null } | null }
    }
    assert.equal(driverAfterRestart.status, 200, JSON.stringify(driverBody))
    assert.equal(driverBody.ok, true)
    assert.equal(driverBody.snapshot?.driver?.id, "90000000-0000-4000-8000-000000000001")
    assert.ok(driverBody.snapshot?.assignment?.received_by_app_at)

    const adminAfterRestart = await fetch(`${appUrl}/api/admin/drivers`, {
      headers: { cookie: issuedAdminCookie }, redirect: "manual",
    })
    const adminBody = await adminAfterRestart.json() as { ok?: boolean; drivers?: Array<{ id?: string }> }
    assert.equal(adminAfterRestart.status, 200, JSON.stringify(adminBody))
    assert.equal(adminBody.ok, true)
    assert.deepEqual(adminBody.drivers?.map((row) => row.id), ["90000000-0000-4000-8000-000000000001"])
  } finally {
    if (next.exitCode === null) {
      next.kill("SIGTERM")
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("restarted Next did not exit after SIGTERM")), 10_000)
        next.once("exit", () => { clearTimeout(timeout); resolve() })
      })
    }
  }
})
