import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import test from "node:test"
import { assertTestLabEnvironment } from "../support/environment"

const environment = assertTestLabEnvironment()
const appUrl = process.env.MISE_TEST_LAB_APP_URL
if (!appUrl || new URL(appUrl).hostname !== "127.0.0.1") {
  throw new Error("MISE_TEST_LAB_APP_URL must target 127.0.0.1")
}
const postgrestUrl = process.env.MISE_TEST_LAB_POSTGREST_URL
const localServiceKey = process.env.MISE_TEST_LAB_LOCAL_SERVICE_KEY
if (!postgrestUrl || new URL(postgrestUrl).hostname !== "127.0.0.1" || !localServiceKey) {
  throw new Error("local PostgREST URL and service key are required")
}

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

test("real PostgREST Atomic-v2 dispatch creates one assignment, route and push event", async () => {
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

test("real Driver lifecycle enforces complete pick manifest and reaches terminal delivery", async () => {
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

test("canonical database snapshot has no lifecycle invariant violations", () => {
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
