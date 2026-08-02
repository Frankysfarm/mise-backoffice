import assert from "node:assert/strict"
import test from "node:test"
import { completeScenario } from "../scenarios/example"
import { compileScenarioFixture, serializeCompiledFixture } from "./scenario-compiler"

test("same scenario and seed compile byte-identically", () => {
  const first = serializeCompiledFixture(compileScenarioFixture(structuredClone(completeScenario)))
  const second = serializeCompiledFixture(compileScenarioFixture(structuredClone(completeScenario)))
  assert.equal(first, second)
})

test("compiler materializes actors, providers, absolute times and ordered action/fault timeline", () => {
  const fixture = compileScenarioFixture(completeScenario)
  assert.equal(fixture.actorRows.length, 6)
  assert.equal(fixture.storeRows.length, 1)
  assert.equal(fixture.driverRows.length, 2)
  assert.equal(fixture.driverRows[0].gpsPath.length, 2)
  assert.equal(fixture.orderRows[0].createdAt, "2026-08-01T16:00:00.000Z")
  assert.equal(fixture.orderRows[0].prepReadyAt, "2026-08-01T16:08:00.000Z")
  assert.deepEqual(fixture.providerFixtures.routing, { provider: "google-contract-simulator", matrixSeconds: [[0, 240, 420], [240, 0, 180], [420, 180, 0]] })
  assert.deepEqual(fixture.timeline.map((event) => [event.sequence, event.atSeconds, event.kind]), [[1, 0, "action"], [2, 20, "action"], [3, 30, "fault"]])
  assert.match(fixture.digest, /^[a-f0-9]{64}$/)
})

test("seed and fixture changes alter the compiled digest", () => {
  const base = compileScenarioFixture(completeScenario)
  const seedChanged = compileScenarioFixture({ ...completeScenario, seed: completeScenario.seed + 1 })
  const providerChanged = compileScenarioFixture({ ...completeScenario, fixtures: { ...completeScenario.fixtures, network: "lossy-network" } })
  assert.notEqual(seedChanged.digest, base.digest)
  assert.notEqual(providerChanged.digest, base.digest)
  assert.notEqual(seedChanged.orderRows[0].idempotencyKey, base.orderRows[0].idempotencyKey)
})

test("every execution-relevant semantic domain participates in the digest", () => {
  const base = compileScenarioFixture(completeScenario).digest
  const variants = [
    { ...completeScenario, stores: [{ ...completeScenario.stores[0], prepQueueMinutes: 99 }] },
    { ...completeScenario, orders: [{ ...completeScenario.orders[0], items: [{ ...completeScenario.orders[0].items[0], quantity: 99 }] }, completeScenario.orders[1]] },
    { ...completeScenario, steps: [{ ...completeScenario.steps[0], arguments: { channel: "test" } }, completeScenario.steps[1]] },
    { ...completeScenario, expect: { ...completeScenario.expect, optimizationTolerance: 1 } },
    { ...completeScenario, cleanup: { ...completeScenario.cleanup, verifyZeroRows: true } },
  ]
  for (const variant of variants.slice(0, 4)) assert.notEqual(compileScenarioFixture(variant).digest, base)
  assert.equal(compileScenarioFixture(variants[4]).digest, base, "semantically identical cleanup remains identical")
})

test("invalid scenarios fail before fixture materialization", () => {
  assert.throws(() => compileScenarioFixture({ ...completeScenario, environment: "production" }), /environment is invalid/)
})
