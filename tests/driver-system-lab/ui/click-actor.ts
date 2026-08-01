import { SyntheticActor, type ActorClock, type ActorKind } from '../actors/runtime'
import {
  locate,
  type BrowserContextControl,
  type BrowserPage,
  type ServerSnapshotProbe,
  type UiEvidenceSink,
  type UiSelector,
} from './browser-contract'

export interface UiStep {
  id: string
  action: 'click' | 'fill' | 'assertVisible' | 'assertExactlyOne' | 'assertText'
  selector: UiSelector
  value?: string
  expectedText?: string
  serverCheckpoint: string
}

export interface UiActorOptions {
  actorId: string
  kind: ActorKind
  baseUrl: string
  artifactDirectory: string
  headed: boolean
  clock: ActorClock
  page: BrowserPage
  context: BrowserContextControl
  evidence: UiEvidenceSink
  snapshotProbe: ServerSnapshotProbe
}

export interface UiStepEvidence {
  stepId: string
  screenshot: string
  domSnapshot: string
  serverSnapshot: Readonly<Record<string, unknown>>
}

function safeSegment(value: string): string {
  if (!/^[a-zA-Z0-9._-]+$/.test(value)) throw new Error(`unsafe artifact segment: ${value}`)
  return value
}

export class BrowserClickActor {
  readonly actor: SyntheticActor

  constructor(private readonly options: UiActorOptions) {
    this.actor = new SyntheticActor(options.actorId, options.kind, options.clock)
  }

  async run(pathname: string, steps: readonly UiStep[]): Promise<readonly UiStepEvidence[]> {
    if (!pathname.startsWith('/') || pathname.startsWith('//')) {
      throw new Error(`UI actor requires an application-relative path, got ${pathname}`)
    }
    const base = new URL(this.options.baseUrl)
    const target = new URL(pathname, base)
    if (target.origin !== base.origin) throw new Error('cross-origin UI navigation is forbidden')

    const artifactDirectory = this.options.artifactDirectory
    await this.options.evidence.ensureDirectory(artifactDirectory)
    await this.options.context.tracing?.start({ screenshots: true, snapshots: true, sources: true })
    this.actor.ready()
    this.actor.begin('browser-ui-flow')
    const result: UiStepEvidence[] = []

    try {
      await this.options.page.goto(target.toString())
      for (const step of steps) {
        result.push(await this.execute(step))
      }
      this.actor.complete()
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (this.actor.state !== 'failed' && this.actor.state !== 'completed') this.actor.fail(message)
      await this.captureFailure(message)
      throw error
    } finally {
      await this.options.context.tracing?.stop({ path: `${artifactDirectory}/trace.zip` })
    }
  }

  private async execute(step: UiStep): Promise<UiStepEvidence> {
    const stepId = safeSegment(step.id)
    const locator = locate(this.options.page, step.selector)
    switch (step.action) {
      case 'click':
        await locator.click()
        break
      case 'fill':
        if (step.value === undefined) throw new Error(`${step.id}: fill requires value`)
        await locator.fill(step.value)
        break
      case 'assertVisible':
        if (!(await locator.isVisible())) throw new Error(`${step.id}: expected visible element`)
        break
      case 'assertExactlyOne': {
        const count = await locator.count()
        if (count !== 1) throw new Error(`${step.id}: expected exactly one element, found ${count}`)
        break
      }
      case 'assertText': {
        const actual = await locator.textContent()
        if (actual !== step.expectedText) {
          throw new Error(`${step.id}: expected text ${JSON.stringify(step.expectedText)}, got ${JSON.stringify(actual)}`)
        }
        break
      }
    }

    const screenshot = `${this.options.artifactDirectory}/${stepId}.png`
    const domSnapshot = `${this.options.artifactDirectory}/${stepId}.html`
    await this.options.page.screenshot({ path: screenshot, fullPage: true })
    await this.options.evidence.writeText(domSnapshot, await this.options.page.content())
    const serverSnapshot = await this.options.snapshotProbe.readSnapshot(step.serverCheckpoint)
    await this.options.evidence.writeText(
      `${this.options.artifactDirectory}/${stepId}.server.json`,
      JSON.stringify(serverSnapshot, null, 2),
    )
    return { stepId, screenshot, domSnapshot, serverSnapshot }
  }

  private async captureFailure(message: string): Promise<void> {
    await this.options.page.screenshot({
      path: `${this.options.artifactDirectory}/failure.png`,
      fullPage: true,
    })
    await this.options.evidence.writeText(
      `${this.options.artifactDirectory}/failure.html`,
      await this.options.page.content(),
    )
    await this.options.evidence.writeText(
      `${this.options.artifactDirectory}/failure.json`,
      JSON.stringify({ message, headed: this.options.headed }, null, 2),
    )
  }
}

