import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { TestLabEnvironment } from "../support/environment"

export type LabResult = Readonly<{
  runId: string
  seed: number
  suite: string
  status: "passed" | "failed" | "blocked"
  startedAt: string
  finishedAt: string
  events: readonly unknown[]
  limitations: readonly string[]
}>

function xml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;")
}

export async function writeReport(environment: TestLabEnvironment, result: LabResult): Promise<string> {
  if (result.runId !== environment.runId) throw new Error("report run ownership mismatch")
  const directory = join(environment.artifactRoot, environment.runId)
  await mkdir(directory, { recursive: true })
  const json = JSON.stringify(result, null, 2)
  const html = `<!doctype html><meta charset="utf-8"><title>${xml(result.runId)}</title><h1>${xml(result.suite)}: ${result.status}</h1><pre>${xml(json)}</pre>`
  const cases = result.events.length || 1
  const junit = `<?xml version="1.0"?><testsuite name="${xml(result.suite)}" tests="${cases}" failures="${result.status === "failed" ? 1 : 0}" skipped="${result.status === "blocked" ? 1 : 0}">${result.events.length ? result.events.map((_, index) => `<testcase name="evidence-${index + 1}"/>`).join("") : `<testcase name="${xml(result.runId)}"/>`}</testsuite>`
  await Promise.all([
    writeFile(join(directory, "report.json"), json),
    writeFile(join(directory, "report.html"), html),
    writeFile(join(directory, "junit.xml"), junit),
    writeFile(join(directory, "reproduce.json"), JSON.stringify({ runId: result.runId, seed: result.seed, suite: result.suite }, null, 2)),
  ])
  return directory
}
