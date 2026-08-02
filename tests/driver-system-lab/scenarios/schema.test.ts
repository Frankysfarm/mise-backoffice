import assert from "node:assert/strict"
import test from "node:test"
import { completeScenario } from "./example"
import { validateScenario } from "./schema"

test("validates the complete deterministic scenario contract", () => assert.equal(validateScenario(completeScenario).id, completeScenario.id))
test("rejects unknown fields at the root", () => assert.throws(() => validateScenario({ ...completeScenario, sql: "delete all" }), /unknown fields: sql/))
test("rejects unknown nested fields", () => assert.throws(() => validateScenario({ ...completeScenario, fixtures: { ...completeScenario.fixtures, apiKey: "secret" } }), /unknown fields: apiKey/))
test("rejects production-like tenant identity", () => assert.throws(() => validateScenario({ ...completeScenario, tenant: { id: "customer-live" } }), /test-lab marked/))
test("rejects unknown step actors", () => assert.throws(() => validateScenario({ ...completeScenario, steps: [{ actor: "ghost", action: "mutate" }] }), /unknown actor/))
test("rejects invalid cross references", () => assert.throws(() => validateScenario({ ...completeScenario, drivers: [{ ...completeScenario.drivers[0], vehicle: "missing-car" }] }), /unknown vehicle/))
test("rejects unordered chaos events", () => assert.throws(() => validateScenario({ ...completeScenario, chaos: [{ atSeconds: 9, fault: "drop", target: "x" }, { atSeconds: 8, fault: "restart", target: "x" }] }), /time ordered/))
test("rejects unsafe cleanup", () => assert.throws(() => validateScenario({ ...completeScenario, cleanup: { scope: "run-only", verifyZeroRows: false } }), /run-only and verified/))
