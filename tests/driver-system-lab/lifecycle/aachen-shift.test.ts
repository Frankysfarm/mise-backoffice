import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import test from "node:test"
import { loadAdaptiveDispatchDbShadow } from "../../../lib/delivery/adaptive-dispatch-db-shadow"
import { assertTestLabEnvironment } from "../support/environment"

/**
 * Realistic Aachen evening shift over the real local stack:
 * customers in Aachen and its surroundings order over HTTP, the kitchen
 * advances items over the token route, Atomic-v2 dispatch assigns drivers
 * over PostgREST, drivers travel with live GPS tracking rows and every order
 * reaches terminal delivery. The default-off DB shadow validates persisted
 * dispatch state mid-shift and after close.
 */

const environment = assertTestLabEnvironment()
const configuredAppUrl = process.env.MISE_TEST_LAB_APP_URL
const configuredPostgrestUrl = process.env.MISE_TEST_LAB_POSTGREST_URL
const localServiceKey = process.env.MISE_TEST_LAB_LOCAL_SERVICE_KEY
const lifecycleEnabled = Boolean(configuredAppUrl && configuredPostgrestUrl && localServiceKey)
if (configuredAppUrl && new URL(configuredAppUrl).hostname !== "127.0.0.1") {
  throw new Error("MISE_TEST_LAB_APP_URL must target 127.0.0.1")
}
if (configuredPostgrestUrl && new URL(configuredPostgrestUrl).hostname !== "127.0.0.1") {
  throw new Error("MISE_TEST_LAB_POSTGREST_URL must target 127.0.0.1")
}
const appUrl = configuredAppUrl ?? "http://127.0.0.1:1"
const postgrestUrl = configuredPostgrestUrl ?? "http://127.0.0.1:1"
const lifecycleTest = lifecycleEnabled ? test : test.skip

const TENANT_ID = "80000000-0000-4000-8000-000000000001"
const WRITER_ID = "91000000-0000-4000-8000-000000000001"
const LOCATION_ID = "10000000-0000-4000-8000-000000000021"
const MENU_ITEM_ID = "20000000-0000-4000-8000-000000000021"
const STATION_ID = "40000000-0000-4000-8000-000000000021"
const STATION_TOKEN = "testlab-aachen-shift-kitchen"
const STORE = { lat: 50.77843, lng: 6.07873, address: "Pontstrasse 141, 52062 Aachen" }

const DRIVERS = [
  { id: "90000000-0000-4000-8000-000000000041", name: "Rad-Kurier Anna", vehicle: "bike", start: { lat: 50.7785, lng: 6.079 } },
  { id: "90000000-0000-4000-8000-000000000042", name: "Rad-Kurier Ben", vehicle: "bike", start: { lat: 50.7762, lng: 6.0838 } },
  { id: "90000000-0000-4000-8000-000000000043", name: "Auto-Kurier Cem", vehicle: "car", start: { lat: 50.79, lng: 6.06 } },
] as const

const CUSTOMERS = [
  { key: "31", name: "Familie Krott", phone: "+49241100001", address: "Grosskoelnstrasse 20, 52062 Aachen", plz: "52062", drop: { lat: 50.7745, lng: 6.0838 }, qty: 2 },
  { key: "32", name: "Herr Beckers", phone: "+49241100002", address: "Kapellenstrasse 11, 52066 Aachen-Burtscheid", plz: "52066", drop: { lat: 50.7601, lng: 6.0868 }, qty: 1 },
  { key: "33", name: "Frau Mennicken", phone: "+49241100003", address: "Rathausstrasse 8, 52072 Aachen-Laurensberg", plz: "52072", drop: { lat: 50.792, lng: 6.051 }, qty: 3 },
  { key: "34", name: "Familie Esser", phone: "+492405100004", address: "Kaiserstrasse 51, 52146 Wuerselen", plz: "52146", drop: { lat: 50.818, lng: 6.125 }, qty: 2 },
] as const

const orderIds = new Map<string, string>()

function scalar(sql: string): string {
  return execFileSync("psql", [environment.databaseUrl.toString(), "-X", "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8" }).trim()
}

async function rpc(name: string, payload: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(`${postgrestUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: localServiceKey!, authorization: `Bearer ${localServiceKey}` },
    body: JSON.stringify(payload),
  })
  const body = await response.json() as Record<string, unknown>
  assert.equal(response.status, 200, `${name}: ${JSON.stringify(body)}`)
  return body
}

const shadowExecutor = async (sql: string) => JSON.parse(execFileSync("psql", [
  environment.databaseUrl.toString(), "-X", "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1", "-c",
  `select coalesce(json_agg(row_to_json(t)), '[]'::json) from (${sql}) t`,
], { encoding: "utf8" }).trim()) as Record<string, unknown>[]

const runShadow = (captureSuffix: string) => loadAdaptiveDispatchDbShadow(true, shadowExecutor, {
  captureId: `tl_aachen_shift_${captureSuffix}`,
  evaluatedAt: new Date().toISOString(),
  maxBundleOrders: 1,
  locationId: LOCATION_ID,
})

let actionCounter = 0
function nextActionId(): string {
  actionCounter += 1
  return `95000000-0000-4000-8000-${String(actionCounter).padStart(12, "0")}`
}

function trackGps(driverId: string, batchId: string, from: { lat: number; lng: number }, to: { lat: number; lng: number }, pings: number): void {
  for (let step = 0; step <= pings; step += 1) {
    const ratio = step / pings
    const lat = from.lat + (to.lat - from.lat) * ratio
    const lng = from.lng + (to.lng - from.lng) * ratio
    scalar(`insert into mise_driver_locations(driver_id, lat, lng, accuracy_m, speed_kmh, batch_id, recorded_at)
      values ('${driverId}', ${lat.toFixed(6)}, ${lng.toFixed(6)}, 8, 17, '${batchId}', now() - interval '${(pings - step) * 5} seconds')`)
  }
}

async function dispatchOrder(driverId: string, orderId: string, drop: { lat: number; lng: number }, dropAddress: string): Promise<string> {
  const lease = await rpc("fn_dispatch_claim_writer_v2", {
    p_tenant_id: TENANT_ID, p_writer_id: WRITER_ID, p_lease_seconds: 120,
  })
  assert.equal(lease.ok, true, JSON.stringify(lease))
  const expectedDriverVersion = Number(scalar(`select state_version from mise_drivers where id='${driverId}'`))
  const expectedOrderVersion = Number(scalar(`select dispatch_version from customer_orders where id='${orderId}'`))
  const dispatch = await rpc("fn_dispatch_assign_orders_v2", {
    p_tenant_id: TENANT_ID, p_writer_id: WRITER_ID, p_writer_epoch: Number(lease.writer_epoch),
    p_driver_id: driverId, p_expected_driver_version: expectedDriverVersion,
    p_action_id: nextActionId(), p_algorithm_version: "testlab-aachen-shift-v1",
    p_orders: [{
      order_id: orderId, expected_order_version: expectedOrderVersion,
      pickup_lat: STORE.lat, pickup_lng: STORE.lng,
      dropoff_lat: drop.lat, dropoff_lng: drop.lng,
      pickup_address: STORE.address, dropoff_address: dropAddress,
      pickup_deadline_at: new Date(Date.now() + 20 * 60_000).toISOString(),
      delivery_deadline_at: new Date(Date.now() + 50 * 60_000).toISOString(),
    }],
    p_push_title: "Neue Lieferung", p_push_body: "Aachen Schicht",
  })
  assert.equal(dispatch.ok, true, JSON.stringify(dispatch))
  return String(dispatch.batch_id)
}

async function driveAndDeliver(driverId: string, orderId: string, batchId: string, start: { lat: number; lng: number }, drop: { lat: number; lng: number }): Promise<void> {
  const assignmentId = scalar(`select id from dispatch_offer_assignments where order_id='${orderId}' and state='assigned'`)
  const versions = () => ({
    assignment: Number(scalar(`select assignment_version from dispatch_offer_assignments where id='${assignmentId}'`)),
    batch: Number(scalar(`select state_version from mise_delivery_batches where id='${batchId}'`)),
    route: Number(scalar(`select route_version from mise_delivery_batches where id='${batchId}'`)),
    driver: Number(scalar(`select state_version from mise_drivers where id='${driverId}'`)),
    order: Number(scalar(`select dispatch_version from customer_orders where id='${orderId}'`)),
  })
  const pickupStopId = scalar(`select id from mise_delivery_batch_stops where batch_id='${batchId}' and type='pickup'`)
  const dropoffStopId = scalar(`select id from mise_delivery_batch_stops where batch_id='${batchId}' and type='dropoff'`)
  const itemIds = scalar(`select string_agg(id::text,',' order by id) from order_items where order_id='${orderId}'`).split(",")

  const ack = await rpc("fn_driver_accept_ack_compat_v2", {
    p_tenant_id: TENANT_ID, p_assignment_id: assignmentId, p_driver_id: driverId,
    p_snapshot_version: versions().assignment, p_receipt_key: nextActionId(),
    p_metadata: { source: "testlab-aachen-shift" }, p_api_version: "driver-v2",
    p_correlation_id: nextActionId(),
  })
  assert.equal(ack.ok, true, JSON.stringify(ack))

  trackGps(driverId, batchId, start, STORE, 5)
  let now = versions()
  const arrivePickup = await rpc("fn_driver_arrive_v2", {
    p_tenant_id: TENANT_ID, p_stop_id: pickupStopId,
    p_expected_stop_version: Number(scalar(`select stop_version from mise_delivery_batch_stops where id='${pickupStopId}'`)),
    p_expected_batch_version: now.batch, p_expected_route_version: now.route,
    p_expected_driver_version: now.driver, p_actor_driver_id: driverId,
    p_action_id: nextActionId(), p_correlation_id: nextActionId(),
  })
  assert.equal(arrivePickup.ok, true, JSON.stringify(arrivePickup))

  now = versions()
  const pickup = await rpc("fn_driver_pickup_batch_v2", {
    p_tenant_id: TENANT_ID, p_batch_id: batchId, p_expected_batch_version: now.batch,
    p_expected_route_version: now.route, p_expected_driver_version: now.driver,
    p_actor_driver_id: driverId, p_action_id: nextActionId(),
    p_manifest: [{
      order_id: orderId, assignment_id: assignmentId, assignment_version: now.assignment,
      order_version: now.order,
      stop_id: pickupStopId,
      stop_version: Number(scalar(`select stop_version from mise_delivery_batch_stops where id='${pickupStopId}'`)),
      items: itemIds.map((id) => ({ id, outcome: "present_confirmed", evidence: {} })),
    }],
    p_correlation_id: nextActionId(),
  })
  assert.equal(pickup.ok, true, JSON.stringify(pickup))
  assert.equal(scalar(`select status from customer_orders where id='${orderId}'`), "out_for_delivery")

  trackGps(driverId, batchId, STORE, drop, 8)
  now = versions()
  const arriveDropoff = await rpc("fn_driver_arrive_v2", {
    p_tenant_id: TENANT_ID, p_stop_id: dropoffStopId,
    p_expected_stop_version: Number(scalar(`select stop_version from mise_delivery_batch_stops where id='${dropoffStopId}'`)),
    p_expected_batch_version: now.batch, p_expected_route_version: now.route,
    p_expected_driver_version: now.driver, p_actor_driver_id: driverId,
    p_action_id: nextActionId(), p_correlation_id: nextActionId(),
  })
  assert.equal(arriveDropoff.ok, true, JSON.stringify(arriveDropoff))

  now = versions()
  const complete = await rpc("fn_driver_complete_v2", {
    p_tenant_id: TENANT_ID, p_order_id: orderId, p_expected_order_version: now.order,
    p_expected_assignment_version: now.assignment, p_expected_batch_version: now.batch,
    p_expected_driver_version: now.driver, p_actor_driver_id: driverId,
    p_action_id: nextActionId(), p_stop_id: dropoffStopId,
    p_expected_stop_version: Number(scalar(`select stop_version from mise_delivery_batch_stops where id='${dropoffStopId}'`)),
    p_expected_route_version: now.route, p_correlation_id: nextActionId(),
  })
  assert.equal(complete.ok, true, JSON.stringify(complete))

  assert.equal(scalar(`select status||':'||(geliefert_am is not null) from customer_orders where id='${orderId}'`), "delivered:true")
  assert.equal(scalar(`select state from dispatch_offer_assignments where id='${assignmentId}'`), "completed")
  assert.equal(scalar(`select state from mise_delivery_batches where id='${batchId}'`), "completed")
  assert.equal(scalar(`select string_agg(type||':'||state,',' order by sequence) from mise_delivery_batch_stops where batch_id='${batchId}'`), "pickup:completed,dropoff:completed")
  assert.equal(scalar(`select state||':'||current_capacity from mise_drivers where id='${driverId}'`), "returning:0")
}

lifecycleTest("shift setup: Aachen store, menu, kitchen station and three drivers with live GPS", async () => {
  scalar(`insert into locations(id, tenant_id, name, aktiv) values ('${LOCATION_ID}', '${TENANT_ID}', 'Aachen Pontstrasse Schicht', true)`)
  scalar(`insert into menu_items(id, location_id, category_id, name, preis, verfuegbar) values ('${MENU_ITEM_ID}', '${LOCATION_ID}', '50000000-0000-4000-8000-000000000001', 'Printen-Burger Menu', 16.90, true)`)
  scalar(`insert into kitchen_stations(id, location_id, display_token) values ('${STATION_ID}', '${LOCATION_ID}', '${STATION_TOKEN}')`)
  scalar(`insert into station_category_routing(station_id, category_id) values ('${STATION_ID}', '50000000-0000-4000-8000-000000000001')`)
  for (const driver of DRIVERS) {
    scalar(`insert into mise_drivers(id, name, active, state, vehicle, last_position_at) values ('${driver.id}', '${driver.name}', true, 'idle', '${driver.vehicle}', now())`)
    scalar(`insert into mise_driver_tenants(driver_id, tenant_id, status) values ('${driver.id}', '${TENANT_ID}', 'active')`)
    scalar(`insert into mise_driver_locations(driver_id, lat, lng, accuracy_m, recorded_at) values ('${driver.id}', ${driver.start.lat}, ${driver.start.lng}, 10, now())`)
  }
  assert.equal(scalar(`select count(*) from mise_drivers where id in ('${DRIVERS[0].id}','${DRIVERS[1].id}','${DRIVERS[2].id}') and state='idle'`), "3")
})

lifecycleTest("customers from Aachen and surroundings order over HTTP and the kitchen cooks", async () => {
  for (const customer of CUSTOMERS) {
    const created = await fetch(`${appUrl}/api/delivery/orders`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": `30000000-0000-4000-8000-0000000000${customer.key}` },
      body: JSON.stringify({
        location_id: LOCATION_ID,
        items: [{ id: MENU_ITEM_ID, qty: customer.qty }],
        customer: { name: customer.name, phone: customer.phone, address: customer.address },
        type: "lieferung",
        payment_method: "bar",
      }),
    })
    const createdBody = await created.json() as { order_id?: string }
    assert.equal(created.status, 201, JSON.stringify(createdBody))
    orderIds.set(customer.key, createdBody.order_id!)
    scalar(`update customer_orders set kunde_plz='${customer.plz}', kunde_lat=${customer.drop.lat}, kunde_lng=${customer.drop.lng}, eta_latest=now()+interval '45 minutes' where id='${createdBody.order_id}'`)

    const itemId = scalar(`select id from order_items where order_id='${createdBody.order_id}'`)
    for (const [expected, target] of [["offen", "in_arbeit"], ["in_arbeit", "fertig"]]) {
      const advance = await fetch(`${appUrl}/kitchen/display/${STATION_TOKEN}/items/${itemId}/advance`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expected_status: expected, target_status: target }),
      })
      assert.equal(advance.status, 200)
    }
    assert.equal(scalar(`select status from customer_orders where id='${createdBody.order_id}'`), "fertig")
  }
  assert.equal(scalar(`select count(*) from customer_orders where location_id='${LOCATION_ID}' and status='fertig'`), "4")
})

lifecycleTest("first order dispatches to the nearest rider and the DB shadow confirms the persisted decision", async () => {
  const customer = CUSTOMERS[0]
  const orderId = orderIds.get(customer.key)!
  await dispatchOrder(DRIVERS[0].id, orderId, customer.drop, customer.address)

  const shadow = await runShadow("first_wave")
  assert.equal(shadow.loaded.assignmentRows, 1)
  assert.equal(shadow.loaded.driverRows >= 3, true)
  assert.deepEqual(shadow.capture.comparison.violations, [])
  assert.equal(shadow.capture.comparison.assignmentMatch, true)
  assert.equal(shadow.capture.comparison.stopSequenceMatch, true)
  assert.deepEqual(shadow.capture.plan.assignments.map(({ driverId }) => driverId), [DRIVERS[0].id])
})

lifecycleTest("three drivers run their tours with live GPS tracking to terminal delivery", async () => {
  const batches: string[] = []
  const firstBatch = scalar(`select batch_id from dispatch_offer_assignments where order_id='${orderIds.get(CUSTOMERS[0].key)}' and state='assigned'`)
  batches.push(firstBatch)
  for (const [index, customer] of [CUSTOMERS[1], CUSTOMERS[2]].entries()) {
    const driver = DRIVERS[index + 1]
    const orderId = orderIds.get(customer.key)!
    batches.push(await dispatchOrder(driver.id, orderId, customer.drop, customer.address))
  }
  for (const [index, customer] of [CUSTOMERS[0], CUSTOMERS[1], CUSTOMERS[2]].entries()) {
    const driver = DRIVERS[index]
    await driveAndDeliver(driver.id, orderIds.get(customer.key)!, batches[index], driver.start, customer.drop)
  }
  for (const batchId of batches) {
    assert.equal(Number(scalar(`select count(distinct (lat,lng)) from mise_driver_locations where batch_id='${batchId}'`)) >= 10, true)
  }
})

lifecycleTest("second wave: the returning rider takes the Wuerselen order and delivers it", async () => {
  const customer = CUSTOMERS[3]
  const orderId = orderIds.get(customer.key)!
  const driver = DRIVERS[0]
  assert.equal(scalar(`select state from mise_drivers where id='${driver.id}'`), "returning")
  const batchId = await dispatchOrder(driver.id, orderId, customer.drop, customer.address)
  await driveAndDeliver(driver.id, orderId, batchId, CUSTOMERS[0].drop, customer.drop)
})

lifecycleTest("shift close: every order delivered, fleet free, persisted state clean and shadow quiet", async () => {
  assert.equal(scalar(`select count(*) from customer_orders where location_id='${LOCATION_ID}'`), "4")
  assert.equal(scalar(`select count(*) from customer_orders where location_id='${LOCATION_ID}' and status='delivered' and geliefert_am is not null`), "4")
  assert.equal(scalar(`select count(*) from dispatch_offer_assignments a join customer_orders o on o.id=a.order_id where o.location_id='${LOCATION_ID}' and a.state='completed'`), "4")
  assert.equal(scalar(`select count(*) from dispatch_offer_assignments a join customer_orders o on o.id=a.order_id where o.location_id='${LOCATION_ID}' and a.state not in ('completed')`), "0")
  assert.equal(scalar(`select count(*) from mise_drivers where id in ('${DRIVERS[0].id}','${DRIVERS[1].id}','${DRIVERS[2].id}') and current_capacity=0`), "3")
  assert.equal(scalar(`select count(*) from mise_delivery_batch_stops s join mise_delivery_batches b on b.id=s.batch_id join customer_orders o on o.id=s.order_id where o.location_id='${LOCATION_ID}' and s.state<>'completed'`), "0")
  assert.equal(scalar(`select count(*) from (select s.batch_id, min(s.sequence) lo, max(s.sequence) hi, count(*) n, count(distinct s.sequence) dn from mise_delivery_batch_stops s join customer_orders o on o.id=s.order_id where o.location_id='${LOCATION_ID}' group by s.batch_id having min(s.sequence)<>0 or max(s.sequence)<>count(*)-1 or count(*)<>count(distinct s.sequence)) x`), "0")
  assert.equal(scalar(`select count(*) from mise_push_outbox p where p.data->>'batch_id' in (select b.id::text from mise_delivery_batches b join mise_delivery_batch_stops s on s.batch_id=b.id join customer_orders o on o.id=s.order_id where o.location_id='${LOCATION_ID}' group by b.id)`), "4")

  const shadow = await runShadow("shift_close")
  assert.equal(shadow.loaded.assignmentRows, 0)
  assert.deepEqual(shadow.capture.comparison.violations, [])
  assert.equal(shadow.capture.plan.assignments.length, 0)
})
