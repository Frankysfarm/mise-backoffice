import { createHash } from "node:crypto"
import type { TestLabEnvironment } from "../support/environment"

export type SinkKind = "push" | "email" | "sms" | "whatsapp" | "payment"
export type SinkEvent = Readonly<{ id: string; runId: string; kind: SinkKind; recipientAlias: string; payloadHash: string; createdAt: string }>

export class ProviderSink {
  readonly events: SinkEvent[] = []
  constructor(private readonly environment: TestLabEnvironment, private readonly clock: () => Date = () => new Date()) {}

  send(kind: SinkKind, recipientAlias: string, payload: unknown): SinkEvent {
    if (!recipientAlias.startsWith("synthetic:")) throw new Error("provider sink accepts synthetic recipients only")
    const payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex")
    const event = Object.freeze({
      id: `${this.environment.runId}:${kind}:${this.events.length + 1}`,
      runId: this.environment.runId,
      kind,
      recipientAlias,
      payloadHash,
      createdAt: this.clock().toISOString(),
    })
    this.events.push(event)
    return event
  }
}
