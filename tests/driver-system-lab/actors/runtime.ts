export type ActorKind = 'customer' | 'kitchen' | 'driver' | 'dispatcher'

export type ActorState =
  | 'created'
  | 'ready'
  | 'acting'
  | 'waiting'
  | 'completed'
  | 'failed'

export interface ActorEvent {
  actorId: string
  actorKind: ActorKind
  action: string
  from: ActorState
  to: ActorState
  sequence: number
  at: string
  details?: Readonly<Record<string, string | number | boolean>>
}

export interface ActorClock {
  now(): Date
}

export class SyntheticActor {
  private stateValue: ActorState = 'created'
  private sequence = 0
  private readonly events: ActorEvent[] = []

  constructor(
    readonly id: string,
    readonly kind: ActorKind,
    private readonly clock: ActorClock,
  ) {}

  get state(): ActorState {
    return this.stateValue
  }

  history(): readonly ActorEvent[] {
    return [...this.events]
  }

  transition(
    action: string,
    expected: ActorState,
    next: ActorState,
    details?: ActorEvent['details'],
  ): ActorEvent {
    if (this.stateValue !== expected) {
      throw new Error(
        `actor ${this.id}: ${action} requires ${expected}, current state is ${this.stateValue}`,
      )
    }
    const event: ActorEvent = {
      actorId: this.id,
      actorKind: this.kind,
      action,
      from: this.stateValue,
      to: next,
      sequence: ++this.sequence,
      at: this.clock.now().toISOString(),
      ...(details ? { details } : {}),
    }
    this.stateValue = next
    this.events.push(event)
    return event
  }

  ready(): ActorEvent {
    return this.transition('ready', 'created', 'ready')
  }

  begin(action: string): ActorEvent {
    return this.transition(action, 'ready', 'acting')
  }

  wait(reason: string): ActorEvent {
    return this.transition('wait', 'acting', 'waiting', { reason })
  }

  resume(): ActorEvent {
    return this.transition('resume', 'waiting', 'acting')
  }

  complete(): ActorEvent {
    return this.transition('complete', 'acting', 'completed')
  }

  fail(reason: string): ActorEvent {
    if (this.stateValue === 'completed' || this.stateValue === 'failed') {
      throw new Error(`actor ${this.id}: terminal state ${this.stateValue} cannot fail again`)
    }
    const previous = this.stateValue
    const event: ActorEvent = {
      actorId: this.id,
      actorKind: this.kind,
      action: 'fail',
      from: previous,
      to: 'failed',
      sequence: ++this.sequence,
      at: this.clock.now().toISOString(),
      details: { reason },
    }
    this.stateValue = 'failed'
    this.events.push(event)
    return event
  }
}

