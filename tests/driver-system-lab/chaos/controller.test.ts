import assert from "node:assert/strict"
import test from "node:test"
import { ChaosSafetyError, DeterministicChaosController, type FaultSpec, type TestLabAuthorization } from "./controller"

const authorization: TestLabAuthorization = {
  enabled: true,
  environment: "test",
  testRunId: "tl_chaos_000001",
  tenantPrefix: "tl_tenant_",
}

const faults: FaultSpec[] = [
  { id: "db-timeout", kind: "database-timeout", atMs: 20, target: "test:database" },
  { id: "push-duplicate", kind: "duplicate-event", atMs: 10, target: "test:push", payload: { copies: 2 } },
  { id: "worker-crash", kind: "worker-crash", atMs: 20, target: "test:dispatch-worker" },
]

test("fires deterministic faults only when virtual time reaches their explicit timestamp", () => {
  const controller = new DeterministicChaosController({ authorize: () => authorization, seed: 42017, faults })
  assert.deepEqual(controller.advanceTo(9), [])
  assert.deepEqual(controller.advanceTo(10).map((fault) => fault.id), ["push-duplicate"])
  const atTwenty = controller.advanceTo(20)
  assert.deepEqual(atTwenty.map((fault) => fault.id), ["worker-crash", "db-timeout"])
  assert.ok(atTwenty.every((fault) => fault.seed === 42017 && fault.testRunId === authorization.testRunId))
  assert.deepEqual(controller.pending(), [])
})

test("same seed and schedule produces byte-equivalent evidence", () => {
  const first = new DeterministicChaosController({ authorize: () => authorization, seed: 7, faults }).advanceTo(100)
  const second = new DeterministicChaosController({ authorize: () => authorization, seed: 7, faults }).advanceTo(100)
  assert.equal(JSON.stringify(first), JSON.stringify(second))
})

test("rejects production-like or disabled authorization before any fault is scheduled", () => {
  assert.throws(
    () => new DeterministicChaosController({
      authorize: () => ({ ...authorization, enabled: false as true }),
      seed: 1,
      faults,
    }),
    ChaosSafetyError,
  )
  assert.throws(
    () => new DeterministicChaosController({
      authorize: () => ({ ...authorization, environment: "production" as "test" }),
      seed: 1,
      faults,
    }),
    ChaosSafetyError,
  )
})

test("rejects non-test targets and duplicate fault identifiers", () => {
  assert.throws(
    () => new DeterministicChaosController({
      authorize: () => authorization,
      seed: 1,
      faults: [{ id: "unsafe", kind: "push-5xx", atMs: 0, target: "https://provider.example" }],
    }),
    ChaosSafetyError,
  )
  assert.throws(
    () => new DeterministicChaosController({
      authorize: () => authorization,
      seed: 1,
      faults: [faults[0], { ...faults[0] }],
    }),
    ChaosSafetyError,
  )
})

test("virtual clock cannot move backwards", () => {
  const controller = new DeterministicChaosController({ authorize: () => authorization, seed: 1, faults })
  controller.advanceTo(20)
  assert.throws(() => controller.advanceTo(19), ChaosSafetyError)
})
