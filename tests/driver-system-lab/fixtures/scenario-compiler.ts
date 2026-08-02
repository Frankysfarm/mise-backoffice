import { createHash } from "node:crypto"
import { validateScenario, type LabScenario } from "../scenarios/schema"

export type CompiledScenarioFixture = Readonly<{
  fixtureVersion: 1
  scenarioId: string
  seed: number
  clockStart: string
  tenantId: string
  actorRows: readonly Readonly<{ id: string; kind: string; profile: string }> []
  vehicleRows: readonly Readonly<{ id: string; kind: string; capacityOrders: number }> []
  driverRows: readonly Readonly<{ actorId: string; vehicleId: string; state: string; lat: number; lng: number; gpsFixture: string }> []
  orderRows: readonly Readonly<{ id: string; customerId: string; storeId: string; createdAt: string; prepReadyAt: string; deadlineAt: string; payment: string }> []
  providerFixtures: LabScenario["fixtures"]
  timeline: readonly Readonly<{ sequence: number; atSeconds: number; kind: "action" | "fault"; actorOrTarget: string; operation: string }> []
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

export function compileScenarioFixture(input: unknown): CompiledScenarioFixture {
  const scenario = validateScenario(input)
  const startMs = Date.parse(scenario.clock.start)
  const actorRows = scenario.actors.map((actor) => ({ id: actor.id, kind: actor.kind, profile: actor.profile })).sort((left, right) => left.id.localeCompare(right.id))
  const vehicleRows = scenario.vehicles.map((vehicle) => ({ ...vehicle })).sort((left, right) => left.id.localeCompare(right.id))
  const driverRows = scenario.drivers.map((driver) => ({ actorId: driver.actor, vehicleId: driver.vehicle, state: driver.state, lat: driver.start.lat, lng: driver.start.lng, gpsFixture: driver.gpsFixture })).sort((left, right) => left.actorId.localeCompare(right.actorId))
  const orderRows = scenario.orders.map((order) => ({
    id: order.id,
    customerId: order.customer,
    storeId: order.store,
    createdAt: at(startMs, order.createdAtOffsetSeconds),
    prepReadyAt: at(startMs, order.createdAtOffsetSeconds + order.prepMinutes * 60),
    deadlineAt: at(startMs, order.createdAtOffsetSeconds + order.deadlineMinutes * 60),
    payment: order.payment,
  })).sort((left, right) => left.id.localeCompare(right.id))
  const unsortedTimeline = [
    ...scenario.steps.map((step, index) => ({ source: 0, sourceIndex: index, atSeconds: step.atSeconds ?? 0, kind: "action" as const, actorOrTarget: step.actor, operation: step.action })),
    ...scenario.chaos.map((fault, index) => ({ source: 1, sourceIndex: index, atSeconds: fault.atSeconds, kind: "fault" as const, actorOrTarget: fault.target, operation: fault.fault })),
  ].sort((left, right) => left.atSeconds - right.atSeconds || left.source - right.source || left.sourceIndex - right.sourceIndex)
  const timeline = unsortedTimeline.map(({ atSeconds, kind, actorOrTarget, operation }, index) => ({ sequence: index + 1, atSeconds, kind, actorOrTarget, operation }))
  const withoutDigest = {
    fixtureVersion: 1 as const,
    scenarioId: scenario.id,
    seed: scenario.seed,
    clockStart: new Date(startMs).toISOString(),
    tenantId: scenario.tenant.id,
    actorRows,
    vehicleRows,
    driverRows,
    orderRows,
    providerFixtures: scenario.fixtures,
    timeline,
  }
  const digest = createHash("sha256").update(stable(withoutDigest)).digest("hex")
  return Object.freeze({ ...withoutDigest, digest })
}

export function serializeCompiledFixture(fixture: CompiledScenarioFixture): string {
  return `${stable(fixture)}\n`
}
