import assert from "node:assert/strict"
import test from "node:test"
import { completeScenario } from "./example"
import { validateScenario } from "./schema"

test("validates the complete deterministic scenario contract", () => assert.equal(validateScenario(completeScenario).id, completeScenario.id))
test("rejects unknown fields at the root", () => assert.throws(() => validateScenario({ ...completeScenario, sql: "delete all" }), /unknown fields: sql/))
test("rejects unknown nested fields", () => assert.throws(() => validateScenario({ ...completeScenario, fixtures: { ...completeScenario.fixtures, apiKey: "secret" } }), /unknown fields: apiKey/))
test("rejects production-like tenant identity", () => assert.throws(() => validateScenario({ ...completeScenario, tenant: { id: "customer-live" } }), /guarded testlab_/))
test("rejects unknown step actors", () => assert.throws(() => validateScenario({ ...completeScenario, steps: [{ actor: "ghost", action: "mutate" }] }), /unknown actor/))
test("rejects invalid cross references", () => assert.throws(() => validateScenario({ ...completeScenario, drivers: [{ ...completeScenario.drivers[0], vehicle: "missing-car" }] }), /unknown vehicle/))
test("rejects unordered chaos events", () => assert.throws(() => validateScenario({ ...completeScenario, chaos: [{ atSeconds: 9, fault: "network-drop", target: "driver-1" }, { atSeconds: 8, fault: "network-restore", target: "driver-1" }] }), /time ordered/))
test("rejects unsafe cleanup", () => assert.throws(() => validateScenario({ ...completeScenario, cleanup: { scope: "run-only", verifyZeroRows: false } }), /run-only and verified/))
test("rejects unknown actor profiles", () => assert.throws(() => validateScenario({ ...completeScenario, actors: completeScenario.actors.map((actor, index) => index === 0 ? { ...actor, profile: "not-a-profile" } : actor) }), /profile is unknown/))
test("rejects unknown provider and GPS fixtures", () => {
  assert.throws(() => validateScenario({ ...completeScenario, fixtures: { ...completeScenario.fixtures, push: "production-apns" } }), /unknown push fixture/)
  assert.throws(() => validateScenario({ ...completeScenario, drivers: [{ ...completeScenario.drivers[0], gpsFixture: "real-driver" }, completeScenario.drivers[1]] }), /unknown GPS fixture/)
})
test("rejects unknown actions, faults, targets and expectations", () => {
  assert.throws(() => validateScenario({ ...completeScenario, steps: [{ actor: "system-1", action: "run-production" }] }), /action is unknown/)
  assert.throws(() => validateScenario({ ...completeScenario, steps: [{ actor: "customer-1", action: "depart-tour" }] }), /incompatible with actor kind/)
  assert.throws(() => validateScenario({ ...completeScenario, chaos: [{ atSeconds: 1, fault: "delete-database", target: "database-session" }] }), /fault is unknown/)
  assert.throws(() => validateScenario({ ...completeScenario, chaos: [{ atSeconds: 1, fault: "network-drop", target: "production-driver" }] }), /target is unknown/)
  assert.throws(() => validateScenario({ ...completeScenario, expect: { ...completeScenario.expect, invariants: ["looks-good"] } }), /invariant is unknown/)
})
