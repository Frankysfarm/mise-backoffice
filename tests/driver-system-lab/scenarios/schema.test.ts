import assert from "node:assert/strict"
import test from "node:test"
import { validateScenario } from "./schema"

const smoke = { version: 1, id: "single-order-smoke", title: "Single order smoke", tags: ["smoke"], actors: [{ id: "customer-1", kind: "customer" }, { id: "system-1", kind: "system" }], steps: [{ actor: "customer-1", action: "placeOrder" }, { actor: "system-1", action: "dispatch" }], expect: { allOrdersAccountedFor: true } }

test("validates a deterministic scenario", () => assert.equal(validateScenario(smoke).id, smoke.id))
test("rejects unknown actors", () => assert.throws(() => validateScenario({ ...smoke, steps: [{ actor: "ghost", action: "mutate" }] })))
test("rejects duplicate actor ids", () => assert.throws(() => validateScenario({ ...smoke, actors: [...smoke.actors, smoke.actors[0]] })))
