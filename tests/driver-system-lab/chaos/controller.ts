export type LabEnvironment = "local" | "test" | "staging"

export interface TestLabAuthorization {
  enabled: true
  environment: LabEnvironment
  testRunId: string
  tenantPrefix: string
}

export type FaultKind =
  | "database-timeout"
  | "transaction-abort"
  | "failpoint-after-write"
  | "lock-wait"
  | "worker-crash"
  | "worker-restart"
  | "duplicate-event"
  | "stale-event"
  | "out-of-order-event"
  | "push-4xx"
  | "push-5xx"
  | "missing-push-ticket"
  | "partial-push-result"
  | "realtime-disconnect"
  | "slow-network"
  | "offline"
  | "service-worker-restart"
  | "browser-reload"
  | "clock-skew"
  | "stale-gps"
  | "gps-jump"
  | "routing-timeout"
  | "partial-matrix"
  | "routing-quota"
  | "disk-fast-full"
  | "cache-growth"
  | "queue-backlog"

export interface FaultSpec {
  id: string
  kind: FaultKind
  atMs: number
  target: string
  payload?: Record<string, unknown>
}

export interface FiredFault extends FaultSpec {
  testRunId: string
  seed: number
  firedAtMs: number
  sequence: number
}

export class ChaosSafetyError extends Error {
  readonly evidence: Record<string, unknown>

  constructor(message: string, evidence: Record<string, unknown>) {
    super(message)
    this.name = "ChaosSafetyError"
    this.evidence = evidence
  }
}

function mix(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export class DeterministicChaosController {
  private readonly authorization: TestLabAuthorization
  private readonly seed: number
  private readonly faults: FaultSpec[]
  private cursor = 0
  private nowMs = 0

  constructor(options: {
    authorize: () => TestLabAuthorization
    seed: number
    faults: FaultSpec[]
  }) {
    const authorization = options.authorize()
    if (!authorization.enabled || !["local", "test", "staging"].includes(authorization.environment)) {
      throw new ChaosSafetyError("Chaos runtime is not authorized for an isolated test environment", {
        environment: authorization.environment,
      })
    }
    if (!/^tl_[a-z0-9][a-z0-9_-]{7,}$/i.test(authorization.testRunId) || !authorization.tenantPrefix.startsWith("tl_")) {
      throw new ChaosSafetyError("Chaos runtime requires test-bound run and tenant identities", {
        testRunId: authorization.testRunId,
        tenantPrefix: authorization.tenantPrefix,
      })
    }
    if (!Number.isSafeInteger(options.seed)) {
      throw new ChaosSafetyError("Chaos seed must be a safe integer", { seed: options.seed })
    }
    const ids = new Set<string>()
    for (const fault of options.faults) {
      if (ids.has(fault.id) || !Number.isSafeInteger(fault.atMs) || fault.atMs < 0 || !fault.target.startsWith("test:")) {
        throw new ChaosSafetyError("Unsafe or non-deterministic fault specification", { fault })
      }
      ids.add(fault.id)
    }
    const random = mix(options.seed)
    this.authorization = authorization
    this.seed = options.seed
    this.faults = options.faults
      .map((fault, insertion) => ({ fault, insertion, tieBreak: random() }))
      .sort((left, right) => left.fault.atMs - right.fault.atMs || left.tieBreak - right.tieBreak || left.insertion - right.insertion)
      .map(({ fault }) => ({ ...fault, payload: fault.payload ? { ...fault.payload } : undefined }))
  }

  advanceTo(atMs: number): FiredFault[] {
    if (!Number.isSafeInteger(atMs) || atMs < this.nowMs) {
      throw new ChaosSafetyError("Virtual clock cannot move backwards or use fractional time", {
        currentMs: this.nowMs,
        requestedMs: atMs,
      })
    }
    this.nowMs = atMs
    const fired: FiredFault[] = []
    while (this.cursor < this.faults.length && this.faults[this.cursor].atMs <= atMs) {
      const fault = this.faults[this.cursor]
      fired.push({
        ...fault,
        testRunId: this.authorization.testRunId,
        seed: this.seed,
        firedAtMs: fault.atMs,
        sequence: this.cursor,
      })
      this.cursor += 1
    }
    return fired
  }

  pending(): readonly FaultSpec[] {
    return this.faults.slice(this.cursor)
  }
}
