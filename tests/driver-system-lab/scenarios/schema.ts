import { createCanonicalActorProfiles } from "../actors/profiles"
import { actionActorKinds, clockFixtures, geocodingFixtures, gpsFixtures, hasOwnFixture, infrastructureFixtures, infrastructureTargets, invariantIds, networkFixtures, paymentFixtures, pushFixtures, routingFixtures, scenarioActions, scenarioFaults, trafficFixtures, uiStateIds } from "../fixtures/registry"

export type ActorKind = "customer" | "kitchen" | "driver" | "dispatcher" | "system"
export type VehicleKind = "bike" | "car" | "scooter" | "foot"

export type ScenarioStep = Readonly<{
  actor: string
  action: string
  atSeconds?: number
  arguments?: Readonly<Record<string, string | number | boolean>>
}>

export type LabScenario = Readonly<{
  schemaVersion: 1
  id: string
  title: string
  description: string
  seed: number
  tags: readonly string[]
  capabilities: readonly string[]
  environment: "local" | "test" | "staging"
  tenant: Readonly<{ id: string }>
  clock: Readonly<{ start: string }>
  stores: readonly Readonly<{ id: string; prepQueueMinutes: number }> []
  actors: readonly Readonly<{ id: string; kind: ActorKind; profile: string }> []
  vehicles: readonly Readonly<{ id: string; kind: VehicleKind; capacityOrders: number }> []
  drivers: readonly Readonly<{
    actor: string
    vehicle: string
    state: "idle" | "active" | "offline"
    start: Readonly<{ lat: number; lng: number }>
    gpsFixture: string
  }> []
  orders: readonly Readonly<{
    id: string
    customer: string
    store: string
    items: readonly Readonly<{ id: string; quantity: number; required: boolean }> []
    createdAtOffsetSeconds: number
    prepMinutes: number
    deadlineMinutes: number
    payment: "confirmed" | "delayed" | "failed"
  }> []
  fixtures: Readonly<{
    routing: string
    traffic: string
    push: string
    network: string
    payment: string
    geocoding: string
    clock: string
    infrastructure: string
  }>
  steps: readonly ScenarioStep[]
  chaos: readonly Readonly<{ atSeconds: number; fault: string; target: string }> []
  expect: Readonly<{
    uiStates: readonly string[]
    invariants: readonly string[]
    selectedDriver?: string
    bundleSize?: number
    stopOrder?: readonly string[]
    optimizationTolerance: number
  }>
  cleanup: Readonly<{ scope: "run-only"; verifyZeroRows: boolean }>
}>

const ID = /^[a-z][a-z0-9-]{2,63}$/
const TENANT_ID = /^testlab_[a-z0-9][a-z0-9_-]{1,55}$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/
const profiles = createCanonicalActorProfiles("tl_20260802t000000z_00000000", "testlab_registry")
const PROFILE_BY_KIND = new Map<ActorKind, Set<string>>([
  ["customer", new Set(profiles.customers.map((profile) => profile.behavior))],
  ["kitchen", new Set(profiles.kitchens.map((profile) => profile.behavior))],
  ["driver", new Set(profiles.drivers.map((profile) => profile.behavior))],
  ["dispatcher", new Set(profiles.dispatchers.map((profile) => profile.behavior))],
  ["system", new Set(["canonical"])],
])

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return value as Record<string, unknown>
}

function exact(raw: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const unknown = Object.keys(raw).filter((key) => !allowed.includes(key)).sort()
  if (unknown.length > 0) throw new Error(`${label} has unknown fields: ${unknown.join(", ")}`)
}

function id(value: unknown, label: string): string {
  if (typeof value !== "string" || !ID.test(value)) throw new Error(`${label} must be a lowercase stable id`)
  return value
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${label} must be non-empty`)
  return value
}

function finite(value: unknown, label: string, minimum = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum) throw new Error(`${label} must be finite and >= ${minimum}`)
  return value
}

function integer(value: unknown, label: string, minimum = 0): number {
  const number = finite(value, label, minimum)
  if (!Number.isSafeInteger(number)) throw new Error(`${label} must be a safe integer`)
  return number
}

function strings(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string" && entry.length > 0)) throw new Error(`${label} must be a string array`)
  if (new Set(value).size !== value.length) throw new Error(`${label} must not contain duplicates`)
  return value
}

function array(value: unknown, label: string, allowEmpty = false): readonly unknown[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) throw new Error(`${label} must be ${allowEmpty ? "an" : "a non-empty"} array`)
  return value
}

function oneOf<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) throw new Error(`${label} is invalid`)
  return value as T
}

export function validateScenario(value: unknown): LabScenario {
  const raw = object(value, "scenario")
  exact(raw, ["schemaVersion", "id", "title", "description", "seed", "tags", "capabilities", "environment", "tenant", "clock", "stores", "actors", "vehicles", "drivers", "orders", "fixtures", "steps", "chaos", "expect", "cleanup"], "scenario")
  if (raw.schemaVersion !== 1) throw new Error("scenario schemaVersion must equal 1")
  id(raw.id, "scenario.id")
  text(raw.title, "scenario.title")
  text(raw.description, "scenario.description")
  integer(raw.seed, "scenario.seed")
  strings(raw.tags, "scenario.tags")
  strings(raw.capabilities, "scenario.capabilities")
  oneOf(raw.environment, ["local", "test", "staging"], "scenario.environment")

  const tenant = object(raw.tenant, "scenario.tenant")
  exact(tenant, ["id"], "scenario.tenant")
  if (typeof tenant.id !== "string" || !TENANT_ID.test(tenant.id)) throw new Error("scenario tenant must use the guarded testlab_ prefix")

  const clock = object(raw.clock, "scenario.clock")
  exact(clock, ["start"], "scenario.clock")
  if (typeof clock.start !== "string" || !ISO_DATE.test(clock.start) || Number.isNaN(Date.parse(clock.start))) throw new Error("scenario.clock.start must be an offset-qualified ISO timestamp")

  const storeIds = new Set<string>()
  for (const [index, entry] of array(raw.stores, "scenario.stores").entries()) {
    const store = object(entry, `scenario.stores[${index}]`)
    exact(store, ["id", "prepQueueMinutes"], `scenario.stores[${index}]`)
    const storeId = id(store.id, `scenario.stores[${index}].id`)
    if (storeIds.has(storeId)) throw new Error("scenario store ids must be unique")
    storeIds.add(storeId)
    finite(store.prepQueueMinutes, `scenario.stores[${index}].prepQueueMinutes`)
  }

  const actorIds = new Set<string>()
  const actorKinds = new Map<string, ActorKind>()
  for (const [index, entry] of array(raw.actors, "scenario.actors").entries()) {
    const actor = object(entry, `scenario.actors[${index}]`)
    exact(actor, ["id", "kind", "profile"], `scenario.actors[${index}]`)
    const actorId = id(actor.id, `scenario.actors[${index}].id`)
    if (actorIds.has(actorId)) throw new Error("scenario actor ids must be unique")
    const kind = oneOf(actor.kind, ["customer", "kitchen", "driver", "dispatcher", "system"], `scenario.actors[${index}].kind`)
    const profile = text(actor.profile, `scenario.actors[${index}].profile`)
    if (!PROFILE_BY_KIND.get(kind)?.has(profile)) throw new Error(`scenario actor profile is unknown for ${kind}`)
    actorIds.add(actorId)
    actorKinds.set(actorId, kind)
  }

  const vehicleIds = new Set<string>()
  for (const [index, entry] of array(raw.vehicles, "scenario.vehicles").entries()) {
    const vehicle = object(entry, `scenario.vehicles[${index}]`)
    exact(vehicle, ["id", "kind", "capacityOrders"], `scenario.vehicles[${index}]`)
    const vehicleId = id(vehicle.id, `scenario.vehicles[${index}].id`)
    if (vehicleIds.has(vehicleId)) throw new Error("scenario vehicle ids must be unique")
    vehicleIds.add(vehicleId)
    oneOf(vehicle.kind, ["bike", "car", "scooter", "foot"], `scenario.vehicles[${index}].kind`)
    integer(vehicle.capacityOrders, `scenario.vehicles[${index}].capacityOrders`, 1)
  }

  const driverActors = new Set<string>()
  for (const [index, entry] of array(raw.drivers, "scenario.drivers").entries()) {
    const driver = object(entry, `scenario.drivers[${index}]`)
    exact(driver, ["actor", "vehicle", "state", "start", "gpsFixture"], `scenario.drivers[${index}]`)
    const actor = id(driver.actor, `scenario.drivers[${index}].actor`)
    if (actorKinds.get(actor) !== "driver" || driverActors.has(actor)) throw new Error("scenario driver must reference one unique driver actor")
    driverActors.add(actor)
    const vehicle = id(driver.vehicle, `scenario.drivers[${index}].vehicle`)
    if (!vehicleIds.has(vehicle)) throw new Error("scenario driver references an unknown vehicle")
    oneOf(driver.state, ["idle", "active", "offline"], `scenario.drivers[${index}].state`)
    const start = object(driver.start, `scenario.drivers[${index}].start`)
    exact(start, ["lat", "lng"], `scenario.drivers[${index}].start`)
    const lat = finite(start.lat, `scenario.drivers[${index}].start.lat`, -90)
    const lng = finite(start.lng, `scenario.drivers[${index}].start.lng`, -180)
    if (lat > 90 || lng > 180) throw new Error("scenario driver coordinates are out of range")
    const gpsFixture = id(driver.gpsFixture, `scenario.drivers[${index}].gpsFixture`)
    if (!hasOwnFixture(gpsFixtures, gpsFixture)) throw new Error("scenario driver references an unknown GPS fixture")
  }

  const orderIds = new Set<string>()
  for (const [index, entry] of array(raw.orders, "scenario.orders").entries()) {
    const order = object(entry, `scenario.orders[${index}]`)
    exact(order, ["id", "customer", "store", "items", "createdAtOffsetSeconds", "prepMinutes", "deadlineMinutes", "payment"], `scenario.orders[${index}]`)
    const orderId = id(order.id, `scenario.orders[${index}].id`)
    if (orderIds.has(orderId)) throw new Error("scenario order ids must be unique")
    orderIds.add(orderId)
    const customer = id(order.customer, `scenario.orders[${index}].customer`)
    if (actorKinds.get(customer) !== "customer") throw new Error("scenario order customer must reference a customer actor")
    const store = id(order.store, `scenario.orders[${index}].store`)
    if (!storeIds.has(store)) throw new Error("scenario order references an unknown store")
    const itemIds = new Set<string>()
    for (const [itemIndex, itemEntry] of array(order.items, `scenario.orders[${index}].items`).entries()) {
      const item = object(itemEntry, `scenario.orders[${index}].items[${itemIndex}]`)
      exact(item, ["id", "quantity", "required"], `scenario.orders[${index}].items[${itemIndex}]`)
      const itemId = id(item.id, `scenario.orders[${index}].items[${itemIndex}].id`)
      if (itemIds.has(itemId)) throw new Error("scenario item ids must be unique per order")
      itemIds.add(itemId)
      integer(item.quantity, `scenario.orders[${index}].items[${itemIndex}].quantity`, 1)
      if (typeof item.required !== "boolean") throw new Error("scenario item required must be boolean")
    }
    integer(order.createdAtOffsetSeconds, `scenario.orders[${index}].createdAtOffsetSeconds`)
    finite(order.prepMinutes, `scenario.orders[${index}].prepMinutes`)
    finite(order.deadlineMinutes, `scenario.orders[${index}].deadlineMinutes`, 1)
    oneOf(order.payment, ["confirmed", "delayed", "failed"], `scenario.orders[${index}].payment`)
  }

  const fixtures = object(raw.fixtures, "scenario.fixtures")
  exact(fixtures, ["routing", "traffic", "push", "network", "payment", "geocoding", "clock", "infrastructure"], "scenario.fixtures")
  const fixtureRegistries = { routing: routingFixtures, traffic: trafficFixtures, push: pushFixtures, network: networkFixtures, payment: paymentFixtures, geocoding: geocodingFixtures, clock: clockFixtures, infrastructure: infrastructureFixtures } as const
  for (const key of ["routing", "traffic", "push", "network", "payment", "geocoding", "clock", "infrastructure"] as const) {
    const fixtureId = id(fixtures[key], `scenario.fixtures.${key}`)
    if (!hasOwnFixture(fixtureRegistries[key], fixtureId)) throw new Error(`scenario references an unknown ${key} fixture`)
  }

  for (const [index, entry] of array(raw.steps, "scenario.steps").entries()) {
    const step = object(entry, `scenario.steps[${index}]`)
    exact(step, ["actor", "action", "atSeconds", "arguments"], `scenario.steps[${index}]`)
    const actor = id(step.actor, `scenario.steps[${index}].actor`)
    if (!actorIds.has(actor)) throw new Error("scenario step references an unknown actor")
    const action = id(step.action, `scenario.steps[${index}].action`)
    if (!scenarioActions.has(action)) throw new Error("scenario step action is unknown")
    if (!actionActorKinds[action]?.includes(actorKinds.get(actor) ?? "")) throw new Error("scenario action is incompatible with actor kind")
    if (step.atSeconds !== undefined) integer(step.atSeconds, `scenario.steps[${index}].atSeconds`)
    if (step.arguments !== undefined) {
      const args = object(step.arguments, `scenario.steps[${index}].arguments`)
      for (const argument of Object.values(args)) {
        if (!["string", "number", "boolean"].includes(typeof argument) || (typeof argument === "number" && !Number.isFinite(argument))) throw new Error("scenario step arguments must be finite scalar values")
      }
    }
  }

  let previousFaultTime = -1
  for (const [index, entry] of array(raw.chaos, "scenario.chaos", true).entries()) {
    const fault = object(entry, `scenario.chaos[${index}]`)
    exact(fault, ["atSeconds", "fault", "target"], `scenario.chaos[${index}]`)
    const at = integer(fault.atSeconds, `scenario.chaos[${index}].atSeconds`)
    if (at < previousFaultTime) throw new Error("scenario chaos events must be time ordered")
    previousFaultTime = at
    const faultId = id(fault.fault, `scenario.chaos[${index}].fault`)
    if (!scenarioFaults.has(faultId)) throw new Error("scenario chaos fault is unknown")
    const target = text(fault.target, `scenario.chaos[${index}].target`)
    if (!actorIds.has(target) && !infrastructureTargets.has(target)) throw new Error("scenario chaos target is unknown")
  }

  const expect = object(raw.expect, "scenario.expect")
  exact(expect, ["uiStates", "invariants", "selectedDriver", "bundleSize", "stopOrder", "optimizationTolerance"], "scenario.expect")
  const uiStates = strings(expect.uiStates, "scenario.expect.uiStates")
  if (uiStates.some((state) => !uiStateIds.has(state))) throw new Error("scenario expected UI state is unknown")
  const invariants = strings(expect.invariants, "scenario.expect.invariants")
  if (invariants.length === 0) throw new Error("scenario expectations require invariants")
  if (invariants.some((invariant) => !invariantIds.has(invariant))) throw new Error("scenario expected invariant is unknown")
  if (expect.selectedDriver !== undefined && !driverActors.has(id(expect.selectedDriver, "scenario.expect.selectedDriver"))) throw new Error("scenario expected driver is unknown")
  if (expect.bundleSize !== undefined) integer(expect.bundleSize, "scenario.expect.bundleSize", 1)
  if (expect.stopOrder !== undefined) {
    for (const stop of strings(expect.stopOrder, "scenario.expect.stopOrder")) if (!orderIds.has(stop.replace(/^(pickup|dropoff)-/, ""))) throw new Error("scenario expected stop references an unknown order")
  }
  finite(expect.optimizationTolerance, "scenario.expect.optimizationTolerance")

  const cleanup = object(raw.cleanup, "scenario.cleanup")
  exact(cleanup, ["scope", "verifyZeroRows"], "scenario.cleanup")
  if (cleanup.scope !== "run-only" || cleanup.verifyZeroRows !== true) throw new Error("scenario cleanup must be run-only and verified")
  return Object.freeze(value as LabScenario)
}
