export type ActorKind = "customer" | "kitchen" | "driver" | "dispatcher" | "system"
export type ScenarioStep = Readonly<{ actor: string; action: string; atSeconds?: number; arguments?: Readonly<Record<string, unknown>> }>
export type LabScenario = Readonly<{
  version: 1
  id: string
  title: string
  tags: readonly string[]
  actors: readonly Readonly<{ id: string; kind: ActorKind }>[]
  steps: readonly ScenarioStep[]
  expect: Readonly<Record<string, boolean | number | string>>
}>

const ID = /^[a-z][a-z0-9-]{2,63}$/

export function validateScenario(value: unknown): LabScenario {
  if (!value || typeof value !== "object") throw new Error("scenario must be an object")
  const raw = value as Record<string, unknown>
  if (raw.version !== 1 || typeof raw.id !== "string" || !ID.test(raw.id)) throw new Error("scenario version/id is invalid")
  if (typeof raw.title !== "string" || raw.title.length < 3) throw new Error("scenario title is invalid")
  if (!Array.isArray(raw.tags) || !raw.tags.every((tag) => typeof tag === "string")) throw new Error("scenario tags are invalid")
  if (!Array.isArray(raw.actors) || raw.actors.length === 0) throw new Error("scenario actors are required")
  const actorIds = new Set<string>()
  for (const actor of raw.actors as Record<string, unknown>[]) {
    if (!actor || typeof actor.id !== "string" || !ID.test(actor.id) || actorIds.has(actor.id)) throw new Error("actor ids must be valid and unique")
    if (!["customer", "kitchen", "driver", "dispatcher", "system"].includes(String(actor.kind))) throw new Error("actor kind is invalid")
    actorIds.add(actor.id)
  }
  if (!Array.isArray(raw.steps) || raw.steps.length === 0) throw new Error("scenario steps are required")
  for (const step of raw.steps as Record<string, unknown>[]) {
    if (!step || typeof step.actor !== "string" || !actorIds.has(step.actor) || typeof step.action !== "string") throw new Error("scenario step references an invalid actor/action")
  }
  if (!raw.expect || typeof raw.expect !== "object" || Array.isArray(raw.expect)) throw new Error("scenario expectations are required")
  return value as LabScenario
}
