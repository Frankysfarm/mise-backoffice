import { createHash } from "node:crypto"
import { validateScenario, type LabScenario } from "../scenarios/schema"
import { clockFixtures, geocodingFixtures, gpsFixtures, infrastructureFixtures, networkFixtures, paymentFixtures, pushFixtures, routingFixtures, trafficFixtures } from "./registry"

export type CompiledScenarioFixture = Readonly<{
  fixtureVersion: 1
  scenarioId: string
  seed: number
  sourceScenario: LabScenario
  clockStart: string
  tenantId: string
  storeRows: LabScenario["stores"]
  actorRows: readonly Readonly<{ id: string; kind: string; profile: string }> []
  vehicleRows: readonly Readonly<{ id: string; kind: string; capacityOrders: number }> []
  driverRows: readonly Readonly<{ actorId: string; vehicleId: string; state: string; lat: number; lng: number; gpsFixture: string; gpsPath: readonly Readonly<{ atSeconds: number; lat: number; lng: number }> [] }> []
  orderRows: readonly Readonly<{ id: string; customerId: string; storeId: string; items: LabScenario["orders"][number]["items"]; createdAt: string; prepReadyAt: string; deadlineAt: string; payment: string; idempotencyKey: string }> []
  providerFixtures: Readonly<{ routing: unknown; traffic: unknown; push: unknown; network: unknown; payment: unknown; geocoding: unknown; clock: unknown; infrastructure: unknown }>
  timeline: readonly Readonly<{ sequence: number; atSeconds: number; kind: "action" | "fault"; actorOrTarget: string; operation: string; arguments?: Readonly<Record<string, string | number | boolean>> }> []
  digest: string
}>

function at(startMs: number, seconds: number): string {
  return new Date(startMs + seconds * 1_000).toISOString()
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(",")}}`
  }
  return JSON.stringify(value)
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested)
  }
  return value
}

function seededKey(seed: number, kind: string, id: string): string {
  return createHash("sha256").update(`${seed}\0${kind}\0${id}`).digest("hex").slice(0, 24)
}

export function compileScenarioFixture(input: unknown): CompiledScenarioFixture {
  const scenario = validateScenario(structuredClone(input))
  const startMs = Date.parse(scenario.clock.start)
  const actorRows = scenario.actors.map((actor) => ({ id: actor.id, kind: actor.kind, profile: actor.profile })).sort((left, right) => left.id.localeCompare(right.id))
  const vehicleRows = scenario.vehicles.map((vehicle) => ({ ...vehicle })).sort((left, right) => left.id.localeCompare(right.id))
  const driverRows = scenario.drivers.map((driver) => ({ actorId: driver.actor, vehicleId: driver.vehicle, state: driver.state, lat: driver.start.lat, lng: driver.start.lng, gpsFixture: driver.gpsFixture, gpsPath: gpsFixtures[driver.gpsFixture as keyof typeof gpsFixtures] })).sort((left, right) => left.actorId.localeCompare(right.actorId))
  const orderRows = scenario.orders.map((order) => ({
    id: order.id,
    customerId: order.customer,
    storeId: order.store,
    createdAt: at(startMs, order.createdAtOffsetSeconds),
    prepReadyAt: at(startMs, order.createdAtOffsetSeconds + order.prepMinutes * 60),
    deadlineAt: at(startMs, order.createdAtOffsetSeconds + order.deadlineMinutes * 60),
    payment: order.payment,
    items: order.items,
    idempotencyKey: seededKey(scenario.seed, "order", order.id),
  })).sort((left, right) => left.id.localeCompare(right.id))
  const unsortedTimeline = [
    ...scenario.steps.map((step, index) => ({ source: 0, sourceIndex: index, atSeconds: step.atSeconds ?? 0, kind: "action" as const, actorOrTarget: step.actor, operation: step.action, arguments: step.arguments })),
    ...scenario.chaos.map((fault, index) => ({ source: 1, sourceIndex: index, atSeconds: fault.atSeconds, kind: "fault" as const, actorOrTarget: fault.target, operation: fault.fault, arguments: undefined })),
  ].sort((left, right) => left.atSeconds - right.atSeconds || left.source - right.source || left.sourceIndex - right.sourceIndex)
  const timeline = unsortedTimeline.map(({ atSeconds, kind, actorOrTarget, operation, arguments: args }, index) => ({ sequence: index + 1, atSeconds, kind, actorOrTarget, operation, ...(args !== undefined ? { arguments: args } : {}) }))
  const withoutDigest = {
    fixtureVersion: 1 as const,
    scenarioId: scenario.id,
    seed: scenario.seed,
    sourceScenario: scenario,
    clockStart: new Date(startMs).toISOString(),
    tenantId: scenario.tenant.id,
    storeRows: [...scenario.stores].sort((left, right) => left.id.localeCompare(right.id)),
    actorRows,
    vehicleRows,
    driverRows,
    orderRows,
    providerFixtures: {
      routing: routingFixtures[scenario.fixtures.routing as keyof typeof routingFixtures],
      traffic: trafficFixtures[scenario.fixtures.traffic as keyof typeof trafficFixtures],
      push: pushFixtures[scenario.fixtures.push as keyof typeof pushFixtures],
      network: networkFixtures[scenario.fixtures.network as keyof typeof networkFixtures],
      payment: paymentFixtures[scenario.fixtures.payment as keyof typeof paymentFixtures],
      geocoding: geocodingFixtures[scenario.fixtures.geocoding as keyof typeof geocodingFixtures],
      clock: clockFixtures[scenario.fixtures.clock as keyof typeof clockFixtures],
      infrastructure: infrastructureFixtures[scenario.fixtures.infrastructure as keyof typeof infrastructureFixtures],
    },
    timeline,
  }
  const digest = createHash("sha256").update(stable(withoutDigest)).digest("hex")
  return deepFreeze({ ...withoutDigest, digest })
}

export function serializeCompiledFixture(fixture: CompiledScenarioFixture): string {
  return `${stable(fixture)}\n`
}

export function authenticateCompiledFixture(candidate: CompiledScenarioFixture): CompiledScenarioFixture {
  if (candidate.fixtureVersion !== 1) throw new Error("compiled fixture version is unsupported")
  const canonical = compileScenarioFixture(candidate.sourceScenario)
  if (candidate.digest !== canonical.digest || serializeCompiledFixture(candidate) !== serializeCompiledFixture(canonical)) {
    throw new Error("compiled fixture digest/content authentication failed")
  }
  return canonical
}
