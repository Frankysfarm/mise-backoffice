import assert from "node:assert/strict"
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import test from "node:test"
import { DeterministicChaosController, type FaultKind } from "../controller"

type Db = Readonly<{ host: string; port: string; database: string; user: string; password: string }>

function database(): Db | undefined {
  const raw = process.env.TEST_DATABASE_URL
  if (!raw) return undefined
  const url = new URL(raw)
  return {
    host: url.hostname,
    port: url.port || "5432",
    database: url.pathname.slice(1),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  }
}

function child(db: Db, sql: string): ChildProcessWithoutNullStreams {
  const process = spawn("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-q"], {
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...globalThis.process.env,
      PGHOST: db.host,
      PGPORT: db.port,
      PGDATABASE: db.database,
      PGUSER: db.user,
      PGPASSWORD: db.password,
      PGCONNECT_TIMEOUT: "2",
    },
  })
  process.stdin.end(sql)
  return process
}

function execute(db: Db, sql: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const process = child(db, sql)
    let stdout = ""
    let stderr = ""
    process.stdout.on("data", (chunk) => { stdout += String(chunk) })
    process.stderr.on("data", (chunk) => { stderr += String(chunk) })
    process.once("error", reject)
    process.once("exit", (code, signal) => code === 0
      ? resolve(stdout.trim())
      : reject(Object.assign(new Error(`psql failed (${code ?? signal}): ${stderr.trim().slice(0, 240)}`), { code, signal })))
  })
}

function chaos(kind: FaultKind, target: string): DeterministicChaosController {
  return new DeterministicChaosController({
    authorize: () => ({ enabled: true, environment: "local", testRunId: "tl_chaos_integration_01", tenantPrefix: "tl_chaos_" }),
    seed: 6206,
    faults: [{ id: `${kind}-1`, kind, atMs: 10, target }],
  })
}

async function reset(db: Db, schema: string): Promise<void> {
  await execute(db, `DROP SCHEMA IF EXISTS "${schema}" CASCADE; CREATE SCHEMA "${schema}"; CREATE TABLE "${schema}".effects(event_key text PRIMARY KEY, payload text NOT NULL);`)
}

async function count(db: Db, schema: string): Promise<number> {
  return Number(await execute(db, `SELECT count(*) FROM "${schema}".effects;`))
}

test("deterministic transaction-abort failpoint rolls back and retry commits exactly once", async (context) => {
  const db = database()
  if (!db) return context.skip("requires disposable TEST_DATABASE_URL")
  const schema = "lab_chaos_transaction_abort"
  await reset(db, schema)

  const controller = chaos("transaction-abort", "test:postgres-writer")
  assert.deepEqual(controller.advanceTo(9), [])
  assert.equal(controller.advanceTo(10)[0]?.kind, "transaction-abort")

  await assert.rejects(() => execute(db, `BEGIN; INSERT INTO "${schema}".effects VALUES ('event-1','before-failpoint'); SELECT 1/0; COMMIT;`))
  assert.equal(await count(db, schema), 0, "an aborted transaction must expose no partial write")

  await Promise.all(Array.from({ length: 8 }, () => execute(db, `INSERT INTO "${schema}".effects VALUES ('event-1','retry') ON CONFLICT (event_key) DO NOTHING;`)))
  assert.equal(await count(db, schema), 1, "parallel retries must converge to one durable effect")
  await execute(db, `DROP SCHEMA "${schema}" CASCADE;`)
})

test("killed database worker rolls back its open transaction and a replacement recovers", async (context) => {
  const db = database()
  if (!db) return context.skip("requires disposable TEST_DATABASE_URL")
  const schema = "lab_chaos_worker_kill"
  await reset(db, schema)

  const controller = chaos("worker-crash", "test:postgres-worker")
  assert.equal(controller.advanceTo(10)[0]?.kind, "worker-crash")

  const worker = child(db, `BEGIN; INSERT INTO "${schema}".effects VALUES ('event-kill','uncommitted'); SELECT 'FAILPOINT_READY'; SELECT pg_sleep(2); COMMIT;`)
  let stderr = ""
  worker.stderr.on("data", (chunk) => { stderr += String(chunk) })
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`worker did not reach failpoint: ${stderr}`)), 5_000)
    worker.stdout.on("data", (chunk) => {
      if (String(chunk).includes("FAILPOINT_READY")) {
        clearTimeout(timeout)
        resolve()
      }
    })
    worker.once("error", reject)
  })
  assert.equal(worker.kill("SIGKILL"), true)
  await new Promise<void>((resolve) => worker.once("exit", () => resolve()))

  for (let attempt = 0; attempt < 20 && await count(db, schema) !== 0; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert.equal(await count(db, schema), 0, "disconnect must roll back the killed worker transaction")
  await execute(db, `INSERT INTO "${schema}".effects VALUES ('event-kill','replacement-worker');`)
  assert.equal(await execute(db, `SELECT payload FROM "${schema}".effects WHERE event_key='event-kill';`), "replacement-worker")
  await execute(db, `DROP SCHEMA "${schema}" CASCADE;`)
})
