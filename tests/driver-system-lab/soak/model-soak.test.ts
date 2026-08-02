import assert from "node:assert/strict"
import test from "node:test"
import { assertTestLabEnvironment } from "../support/environment"
import { runSingleOrderModel } from "../orchestrator/single-order"

test("bounded soak leaves every synthetic order terminal and every driver idle", (context) => {
  if (process.env.MISE_TEST_LAB_SOAK !== "true") return context.skip("enabled only by test:lab:soak")
  const environment = assertTestLabEnvironment(process.env)
  const iterations = 2_000
  let timelineEvents = 0
  for (let index = 0; index < iterations; index += 1) {
    const timeline = runSingleOrderModel(environment, new Date(Date.UTC(2026, 7, 2, 0, 0, index % 60)))
    const final = timeline.at(-1)?.snapshot
    assert.equal(final?.orders[0].status, "delivered")
    assert.equal(final?.drivers[0].status, "idle")
    assert.equal(final?.assignments.some((assignment) => assignment.status === "active"), false)
    timelineEvents += timeline.length
  }
  assert.equal(timelineEvents, iterations * 6)
})
