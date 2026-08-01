import { spawn } from "node:child_process"
import { readdir } from "node:fs/promises"
import { join } from "node:path"
import { assertTestLabEnvironment } from "../support/environment"
import { writeReport } from "../reports/writer"

function runTests(patterns: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "--test", ...patterns], { stdio: "inherit", env: process.env })
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
    ui: ["ui"], dispatch: ["oracle", "scenarios"], kitchen: ["orchestrator", "invariants"],
    routing: ["oracle", "invariants"], push: ["support", "invariants"], offline: ["support", "invariants"],
    race: ["chaos", "invariants"], chaos: ["chaos"],
  }
  const selected = roots[suite]
  if (!selected || ["full", "nightly", "soak"].includes(suite)) return discoverTests("tests/driver-system-lab")
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
    status = "blocked"
    exitCode = 2
  } else {
    const patterns = await selectTests(suite)
    exitCode = await runTests(patterns)
    status = exitCode === 0 ? "passed" : "failed"
  }

  const directory = await writeReport(environment, {
    runId: environment.runId,
    seed: environment.seed,
    suite,
    status,
    startedAt,
    finishedAt: new Date().toISOString(),
    events: command === "suite" ? (await selectTests(suite)).map((testFile, index) => ({ sequence: index + 1, kind: "test-file", testFile })) : [],
    limitations: status === "blocked" ? ["replay requires a retained run artifact"] : [],
  })
  console.log(JSON.stringify({ event: "test-lab-finish", runId: environment.runId, status, artifacts: directory }))
  process.exitCode = exitCode
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
