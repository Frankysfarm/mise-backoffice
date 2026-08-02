import { spawn } from "node:child_process"
import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import { assertTestLabEnvironment } from "../support/environment"
import { writeReport } from "../reports/writer"
import { executableScenarioRegistry } from "../scenarios/executable/catalog-registry"

function runTests(patterns: string[], extraEnv: NodeJS.ProcessEnv = {}): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "--test", ...patterns], { stdio: "inherit", env: { ...process.env, ...extraEnv } })
    child.once("error", reject)
    child.once("exit", (code) => resolve(code ?? 1))
  })
}

async function discoverTests(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return discoverTests(path)
    return entry.isFile() && entry.name.endsWith(".test.ts") ? [path] : []
  }))
  return nested.flat().sort()
}

async function selectTests(suite: string): Promise<string[]> {
  const roots: Record<string, readonly string[]> = {
    security: ["support"], smoke: ["support", "scenarios", "orchestrator", "invariants"],
    ui: ["ui", "browser-e2e"], dispatch: ["oracle", "scenarios", "adapters"], kitchen: ["orchestrator", "invariants"],
    routing: ["oracle", "invariants"], push: ["support", "invariants"], offline: ["support", "invariants"],
    race: ["chaos", "invariants"], chaos: ["chaos"], soak: ["soak"],
  }
  const selected = roots[suite]
  if (!selected || ["full", "nightly"].includes(suite)) return discoverTests("tests/driver-system-lab")
  return (await Promise.all(selected.map((root) => discoverTests(`tests/driver-system-lab/${root}`)))).flat().sort()
}

function assertDatabaseReachable(url: URL): Promise<void> {
  return new Promise((resolve, reject) => {
    const expectedDatabase = url.pathname.slice(1)
    const child = spawn("psql", ["-X", "-A", "-t", "-q", "-c", "SELECT current_database()"], {
      stdio: ["ignore", "pipe", "ignore"],
      env: {
        ...process.env,
        PGHOST: url.hostname,
        PGPORT: url.port || "5432",
        PGDATABASE: expectedDatabase,
        PGUSER: decodeURIComponent(url.username),
        PGPASSWORD: decodeURIComponent(url.password),
        PGCONNECT_TIMEOUT: "2",
      },
    })
    let output = ""
    child.stdout.on("data", (chunk) => { output += String(chunk) })
    child.once("error", () => reject(new Error("psql is unavailable for the isolated database healthcheck")))
    child.once("exit", (code) => {
      if (code !== 0) reject(new Error("isolated PostgreSQL query healthcheck failed"))
      else if (output.trim() !== expectedDatabase) reject(new Error("isolated PostgreSQL identity mismatch"))
      else resolve()
    })
  })
}

async function main(): Promise<void> {
  // This must remain the first stateful boundary in the CLI.
  const environment = assertTestLabEnvironment()
  const [command = "", target = ""] = process.argv.slice(2)
  const suite = command === "suite" ? target : command
  const startedAt = new Date().toISOString()
  console.log(JSON.stringify({ event: "test-lab-start", runId: environment.runId, seed: environment.seed, suite }))

  let status: "passed" | "failed" | "blocked" = "passed"
  let exitCode = 0
  let reportEvents: readonly unknown[] = []
  if (command === "up") {
    try {
      await assertDatabaseReachable(environment.databaseUrl)
      console.log(JSON.stringify({ event: "up", detail: "isolated PostgreSQL healthcheck passed" }))
    } catch (error) {
      status = "failed"; exitCode = 1
      console.error(error instanceof Error ? error.message : error)
    }
  } else if (command === "down") {
    status = "blocked"; exitCode = 2
    console.error("No run-owned service/cleanup lease exists; refusing to claim shutdown")
  } else if (command === "replay") {
    const idIndex = process.argv.indexOf("--run-id")
    const sourceRunId = idIndex >= 0 ? process.argv[idIndex + 1] : undefined
    if (!sourceRunId || !/^tl_[0-9]{8}t[0-9]{6}z_[a-f0-9]{8}$/.test(sourceRunId)) throw new Error("replay requires a valid --run-id")
    if (sourceRunId === environment.runId) throw new Error("replay requires a fresh MISE_TEST_LAB_RUN_ID")
    const source = JSON.parse(await readFile(join(environment.artifactRoot, sourceRunId, "reproduce.json"), "utf8")) as { seed?: unknown; suite?: unknown }
    if (source.seed !== environment.seed || typeof source.suite !== "string") throw new Error("replay seed/suite does not match guarded execution context")
    const patterns = await selectTests(source.suite)
    exitCode = await runTests(patterns, source.suite === "soak" ? { MISE_TEST_LAB_SOAK: "true" } : source.suite === "ui" ? { MISE_TEST_LAB_BROWSER: "true" } : {})
    status = exitCode === 0 ? "passed" : "failed"
    reportEvents = [{ sequence: 1, kind: "replay-source", sourceRunId, sourceSuite: source.suite }, ...patterns.map((testFile, index) => ({ sequence: index + 2, kind: "test-file", testFile }))]
  } else if (command === "scenario") {
    const idIndex = process.argv.indexOf("--id")
    const scenarioId = idIndex >= 0 ? process.argv[idIndex + 1] : undefined
    if (!scenarioId) throw new Error("scenario requires --id <scenario-id>")
    const result = await executableScenarioRegistry.execute(scenarioId, { runId: environment.runId, seed: environment.seed })
    reportEvents = result.events
    status = result.mode === "audit-only" ? "blocked" : "passed"
    exitCode = result.mode === "audit-only" ? 2 : 0
    console.log(JSON.stringify({ event: "scenario-result", ...result }))
  } else {
    const patterns = await selectTests(suite)
    exitCode = await runTests(patterns, suite === "soak" ? { MISE_TEST_LAB_SOAK: "true" } : suite === "ui" ? { MISE_TEST_LAB_BROWSER: "true" } : {})
    status = exitCode === 0 ? "passed" : "failed"
    reportEvents = patterns.map((testFile, index) => ({ sequence: index + 1, kind: "test-file", testFile }))
  }

  const directory = await writeReport(environment, {
    runId: environment.runId,
    seed: environment.seed,
    suite,
    status,
    startedAt,
    finishedAt: new Date().toISOString(),
    events: reportEvents,
    limitations: status === "blocked" ? ["scenario is registered but has no system-executing handler"] : [],
  })
  console.log(JSON.stringify({ event: "test-lab-finish", runId: environment.runId, status, artifacts: directory }))
  process.exitCode = exitCode
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
