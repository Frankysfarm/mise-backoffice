import { createHash } from "node:crypto"
import type { ScenarioDescriptor } from "../catalog"

export type ScenarioExecutionContext = Readonly<{
  runId: string
  seed: number
}>

export type ScenarioAuditEvent = Readonly<{
  sequence: number
  kind: "scenario-audit"
  detail: string
}>

export type ScenarioExecutionResult = Readonly<{
  scenarioId: string
  suite: string
  risk: ScenarioDescriptor["risk"]
  runId: string
  seed: number
  executionId: string
  mode: "audit-only"
  events: readonly ScenarioAuditEvent[]
}>

export type ScenarioHandler = (
  descriptor: ScenarioDescriptor,
  context: ScenarioExecutionContext,
) => Promise<ScenarioExecutionResult>

export type ScenarioBindings = ReadonlyMap<string, ScenarioHandler>

const RUN_ID = /^tl_[0-9]{8}t[0-9]{6}z_[a-f0-9]{8}$/

function validateContext(context: ScenarioExecutionContext): void {
  if (!RUN_ID.test(context.runId)) throw new Error("scenario execution requires a valid isolated run id")
  if (!Number.isSafeInteger(context.seed) || context.seed < 0) throw new Error("scenario execution requires a non-negative safe-integer seed")
}

function executionId(descriptor: ScenarioDescriptor, context: ScenarioExecutionContext): string {
  const digest = createHash("sha256")
    .update(`${context.runId}\0${context.seed}\0${descriptor.id}\0${descriptor.suite}\0${descriptor.risk}`)
    .digest("hex")
    .slice(0, 16)
  return `${context.runId}:${descriptor.id}:${digest}`
}

export function auditOnlyHandler(detail: string): ScenarioHandler {
  if (detail.trim().length === 0) throw new Error("audit handler detail is required")
  return async (descriptor, context) => ({
    scenarioId: descriptor.id,
    suite: descriptor.suite,
    risk: descriptor.risk,
    runId: context.runId,
    seed: context.seed,
    executionId: executionId(descriptor, context),
    mode: "audit-only",
    events: [{ sequence: 1, kind: "scenario-audit", detail }],
  })
}

export class ExecutableScenarioRegistry {
  private readonly descriptors: ReadonlyMap<string, ScenarioDescriptor>

  constructor(descriptors: readonly ScenarioDescriptor[], private readonly bindings: ScenarioBindings) {
    const indexed = new Map<string, ScenarioDescriptor>()
    for (const descriptor of descriptors) {
      if (indexed.has(descriptor.id)) throw new Error(`duplicate scenario descriptor: ${descriptor.id}`)
      indexed.set(descriptor.id, descriptor)
    }
    const unbound = [...indexed.keys()].filter((id) => !bindings.has(id)).sort()
    const unknown = [...bindings.keys()].filter((id) => !indexed.has(id)).sort()
    if (unbound.length > 0) throw new Error(`unbound scenario descriptors: ${unbound.join(", ")}`)
    if (unknown.length > 0) throw new Error(`bindings without descriptors: ${unknown.join(", ")}`)
    this.descriptors = indexed
  }

  ids(): readonly string[] {
    return [...this.descriptors.keys()].sort()
  }

  async execute(id: string, context: ScenarioExecutionContext): Promise<ScenarioExecutionResult> {
    validateContext(context)
    const descriptor = this.descriptors.get(id)
    const handler = this.bindings.get(id)
    if (!descriptor || !handler) throw new Error(`unknown or unbound executable scenario: ${id}`)
    const result = await handler(descriptor, Object.freeze({ ...context }))
    if (result.scenarioId !== descriptor.id || result.runId !== context.runId || result.seed !== context.seed) {
      throw new Error(`scenario handler returned mismatched execution metadata: ${id}`)
    }
    return Object.freeze(result)
  }
}
