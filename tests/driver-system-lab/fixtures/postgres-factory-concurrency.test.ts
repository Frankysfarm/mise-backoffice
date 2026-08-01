import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import test from "node:test"
import { cleanupRunData, createRunData } from "./postgres-factory"
import { assertTestLabEnvironment, type TestLabEnvironment } from "../support/environment"

function environment(databaseUrl: string, runId: string, tenantId: string, seed: number): TestLabEnvironment {
  return assertTestLabEnvironment({
    MISE_TEST_LAB_ENABLED: "true",
    MISE_TEST_LAB_ENV: "local",
    MISE_TEST_LAB_DATABASE_URL: databaseUrl,
    MISE_TEST_LAB_TENANT_ID: tenantId,
    MISE_TEST_LAB_RUN_ID: runId,
    MISE_TEST_LAB_SEED: String(seed),
  })
}

function schemaName(runId: string): string {
  return `lab_${runId.replaceAll("-", "_")}`
}

function query(environment: TestLabEnvironment, sql: string): Promise<string> {
  const url = environment.databaseUrl
  return new Promise((resolve, reject) => {
    const child = spawn("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-q", "-c", sql], {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PGHOST: url.hostname,
        PGPORT: url.port || "5432",
        PGDATABASE: url.pathname.slice(1),
        PGUSER: decodeURIComponent(url.username),
        PGPASSWORD: decodeURIComponent(url.password),
        PGCONNECT_TIMEOUT: "2",
      },
    })
    let output = ""
    let error = ""
    child.stdout.on("data", (chunk) => { output += String(chunk) })
    child.stderr.on("data", (chunk) => { error += String(chunk) })
    child.once("error", reject)
    child.once("exit", (code) => code === 0
      ? resolve(output.trim())
      : reject(new Error(`psql query failed: ${error.trim().slice(0, 240)}`)))
  })
}

async function schemaExists(environment: TestLabEnvironment): Promise<boolean> {
  const schema = schemaName(environment.runId).replaceAll("'", "''")
  return await query(environment, `SELECT count(*) FROM pg_namespace WHERE nspname='${schema}'`) === "1"
}

test("simultaneous factory creation permits exactly one owner and preserves a foreign run", async (context) => {
  const databaseUrl = process.env.TEST_DATABASE_URL
  if (!databaseUrl) return context.skip("requires disposable TEST_DATABASE_URL")

  const contested = environment(databaseUrl, "tl_20260801t220000z_c0111de1", "testlab_concurrency_a", 101)
  const foreign = environment(databaseUrl, "tl_20260801t220001z_f0e16abc", "testlab_concurrency_b", 102)
  await createRunData(foreign)

  const collision = await Promise.allSettled([createRunData(contested), createRunData(contested)])
  assert.equal(collision.filter(({ status }) => status === "fulfilled").length, 1)
  assert.equal(collision.filter(({ status }) => status === "rejected").length, 1)
  assert.equal(await schemaExists(contested), true)
  assert.equal(await schemaExists(foreign), true)

  await cleanupRunData(contested, contested.runId)
  assert.equal(await schemaExists(foreign), true, "cleaning the colliding run must retain the foreign schema")
  await cleanupRunData(foreign, foreign.runId)
})

test("simultaneous cleanup drops one owned schema once and retains the foreign run", async (context) => {
  const databaseUrl = process.env.TEST_DATABASE_URL
  if (!databaseUrl) return context.skip("requires disposable TEST_DATABASE_URL")

  const contested = environment(databaseUrl, "tl_20260801t220002z_c1ea0001", "testlab_concurrency_c", 103)
  const foreign = environment(databaseUrl, "tl_20260801t220003z_f0e16abd", "testlab_concurrency_d", 104)
  await Promise.all([createRunData(contested), createRunData(foreign)])

  const cleanup = await Promise.allSettled([
    cleanupRunData(contested, contested.runId),
    cleanupRunData(contested, contested.runId),
  ])
  assert.equal(cleanup.filter(({ status }) => status === "fulfilled").length, 1)
  assert.equal(cleanup.filter(({ status }) => status === "rejected").length, 1)
  assert.equal(await schemaExists(contested), false)
  assert.equal(await schemaExists(foreign), true, "a cleanup race must not affect the foreign schema")

  await cleanupRunData(foreign, foreign.runId)
})
