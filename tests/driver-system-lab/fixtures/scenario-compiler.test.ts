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
  assert.equal(fixture.driverRows.length, 2)
  assert.equal(fixture.orderRows[0].createdAt, "2026-08-01T16:00:00.000Z")
  assert.equal(fixture.orderRows[0].prepReadyAt, "2026-08-01T16:08:00.000Z")
  assert.equal(fixture.providerFixtures.routing, "evening-route")
  assert.deepEqual(fixture.timeline.map((event) => [event.sequence, event.atSeconds, event.kind]), [[1, 0, "action"], [2, 20, "action"], [3, 30, "fault"]])
  assert.match(fixture.digest, /^[a-f0-9]{64}$/)
})

test("seed and fixture changes alter the compiled digest", () => {
  const base = compileScenarioFixture(completeScenario)
  const seedChanged = compileScenarioFixture({ ...completeScenario, seed: completeScenario.seed + 1 })
  const providerChanged = compileScenarioFixture({ ...completeScenario, fixtures: { ...completeScenario.fixtures, network: "lossy-network" } })
  assert.notEqual(seedChanged.digest, base.digest)
  assert.notEqual(providerChanged.digest, base.digest)
})

test("invalid scenarios fail before fixture materialization", () => {
  assert.throws(() => compileScenarioFixture({ ...completeScenario, environment: "production" }), /environment is invalid/)
})
