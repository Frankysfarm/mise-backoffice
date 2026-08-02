import assert from "node:assert/strict"
import test from "node:test"
import { createRunData, cleanupRunData } from "./postgres-factory"
import { assertTestLabEnvironment } from "../support/environment"
import { completeScenario } from "../scenarios/example"
import { compileScenarioFixture } from "./scenario-compiler"

test("creates run-bound synthetic data and cleans only its own schema", async (context) => {
  const databaseUrl = process.env.TEST_DATABASE_URL
  if (!databaseUrl) return context.skip("requires disposable TEST_DATABASE_URL")
  const environment = assertTestLabEnvironment({ MISE_TEST_LAB_ENABLED: "true", MISE_TEST_LAB_ENV: "local", MISE_TEST_LAB_DATABASE_URL: databaseUrl, MISE_TEST_LAB_TENANT_ID: "testlab_factory", MISE_TEST_LAB_RUN_ID: "tl_20260801t200000z_fac7abcd", MISE_TEST_LAB_SEED: "1" })
  const second = assertTestLabEnvironment({ MISE_TEST_LAB_ENABLED: "true", MISE_TEST_LAB_ENV: "local", MISE_TEST_LAB_DATABASE_URL: databaseUrl, MISE_TEST_LAB_TENANT_ID: "testlab_factory", MISE_TEST_LAB_RUN_ID: "tl_20260801t200001z_fac7abce", MISE_TEST_LAB_SEED: "2" })
  const fixture = compileScenarioFixture({ ...completeScenario, tenant: { id: environment.tenantId }, seed: environment.seed })
  const created = await createRunData(environment, fixture)
  await createRunData(second)
  assert.equal(created.actors, 65)
  assert.equal(created.fixtureDigest, fixture.digest)
  assert.equal(created.materializedRows, fixture.storeRows.length + fixture.actorRows.length + fixture.vehicleRows.length + fixture.driverRows.length + fixture.orderRows.length + fixture.timeline.length + 1)
  await assert.rejects(() => createRunData({ ...second, runId: "tl_20260801t200002z_fac7abcf" }, fixture), /tenant\/seed/)
  await assert.rejects(() => cleanupRunData(environment, "tl_20260801t200000z_deadbeef"))
  await assert.rejects(() => cleanupRunData({ ...environment, tenantId: "testlab_wrong_tenant" }, environment.runId))
  await cleanupRunData(environment, environment.runId)
  await cleanupRunData(second, second.runId)
})
