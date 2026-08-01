import assert from "node:assert/strict"
import test from "node:test"
import { scenarioCatalog } from "../catalog"
import { executableScenarioRegistry } from "./catalog-registry"
import { auditOnlyHandler, ExecutableScenarioRegistry } from "./registry"

const context = { runId: "tl_20260801t210000z_1234abcd", seed: 42 } as const

test("binds every catalog descriptor exactly once", () => {
  assert.deepEqual(executableScenarioRegistry.ids(), scenarioCatalog.map(({ id }) => id).sort())
})

test("construction fails closed when a descriptor is unbound", () => {
  const first = scenarioCatalog[0]
  assert.throws(
    () => new ExecutableScenarioRegistry([first], new Map()),
    new RegExp(`unbound scenario descriptors: ${first.id}`),
  )
})

test("construction rejects handlers without a catalog descriptor", () => {
  assert.throws(
    () => new ExecutableScenarioRegistry([], new Map([["ghost-scenario", auditOnlyHandler("ghost")]])),
    /bindings without descriptors: ghost-scenario/,
  )
})

test("execution metadata is deterministic for run, seed, and descriptor", async () => {
  const id = scenarioCatalog[0].id
  const first = await executableScenarioRegistry.execute(id, context)
  const replay = await executableScenarioRegistry.execute(id, context)
  assert.deepEqual(replay, first)
  assert.equal(first.mode, "audit-only")
  assert.equal(first.runId, context.runId)
  assert.equal(first.seed, context.seed)
  assert.notEqual((await executableScenarioRegistry.execute(id, { ...context, seed: 43 })).executionId, first.executionId)
})

test("execution rejects unknown IDs and invalid run metadata", async () => {
  await assert.rejects(() => executableScenarioRegistry.execute("unknown-scenario", context), /unknown or unbound/)
  await assert.rejects(() => executableScenarioRegistry.execute(scenarioCatalog[0].id, { ...context, runId: "production" }), /valid isolated run id/)
  await assert.rejects(() => executableScenarioRegistry.execute(scenarioCatalog[0].id, { ...context, seed: -1 }), /non-negative safe-integer seed/)
})

test("handler output cannot substitute another run or descriptor", async () => {
  const descriptor = scenarioCatalog[0]
  const registry = new ExecutableScenarioRegistry([descriptor], new Map([[
    descriptor.id,
    async () => ({ scenarioId: "wrong", suite: descriptor.suite, risk: descriptor.risk, runId: "wrong", seed: 0, executionId: "wrong", mode: "audit-only", events: [] }),
  ]]))
  await assert.rejects(() => registry.execute(descriptor.id, context), /mismatched execution metadata/)
})
