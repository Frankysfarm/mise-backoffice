import assert from 'node:assert/strict'
import test from 'node:test'
import { createCanonicalActorProfiles } from '../actors/profiles'
import { SyntheticActor } from '../actors/runtime'
import { BrowserClickActor, type UiStep } from './click-actor'
import type { BrowserPage, UiLocator } from './browser-contract'

const clock = { now: () => new Date('2026-08-01T16:00:00.000Z') }

test('canonical profiles cover every required synthetic role without ID collisions', () => {
  const profiles = createCanonicalActorProfiles('run-42017', 'lab-tenant-a')
  assert.equal(profiles.customers.length, 15)
  assert.equal(profiles.kitchens.length, 15)
  assert.equal(profiles.drivers.length, 25)
  assert.equal(profiles.dispatchers.length, 10)
  const all = Object.values(profiles).flat()
  assert.equal(new Set(all.map((entry) => entry.id)).size, all.length)
  assert.ok(all.every((entry) => entry.testRunId === 'run-42017'))
})

test('actor state machine rejects actions with stale preconditions', () => {
  const actor = new SyntheticActor('lab-run-driver-1', 'driver', clock)
  actor.ready()
  assert.throws(() => actor.ready(), /requires created/)
  actor.begin('pick')
  actor.complete()
  assert.throws(() => actor.fail('late failure'), /terminal state/)
})

function fakeLocator(events: string[], key: string, count = 1): UiLocator {
  return {
    async click() { events.push(`click:${key}`) },
    async fill(value) { events.push(`fill:${key}:${value}`) },
    async isVisible() { return true },
    async count() { return count },
    async textContent() { return 'expected' },
  }
}

function fakePage(events: string[], counts: Record<string, number> = {}): BrowserPage {
  return {
    async goto(url) { events.push(`goto:${url}`) },
    getByRole(role, options) { return fakeLocator(events, `role:${role}:${String(options.name)}`, counts[String(options.name)]) },
    getByLabel(label) { return fakeLocator(events, `label:${label}`, counts[label]) },
    getByTestId(testId) { return fakeLocator(events, `testId:${testId}`, counts[testId]) },
    async screenshot(options) { events.push(`screenshot:${options.path}`) },
    async content() { return '<main data-testid="driver-delivery-view"></main>' },
  }
}

function makeActor(events: string[], counts: Record<string, number> = {}) {
  return new BrowserClickActor({
    actorId: 'lab-run-driver-1',
    kind: 'driver',
    baseUrl: 'http://127.0.0.1:3200',
    artifactDirectory: 'artifacts/lab-run-driver-1',
    headed: false,
    clock,
    page: fakePage(events, counts),
    context: { tracing: {
      async start() { events.push('trace:start') },
      async stop() { events.push('trace:stop') },
    } },
    evidence: {
      async ensureDirectory(path) { events.push(`mkdir:${path}`) },
      async writeText(path) { events.push(`write:${path}`) },
    },
    snapshotProbe: {
      async readSnapshot(checkpoint) { events.push(`snapshot:${checkpoint}`); return { checkpoint, version: 1 } },
    },
  })
}

test('UI actor uses real locator clicks and captures UI plus server evidence after every step', async () => {
  const events: string[] = []
  const actor = makeActor(events)
  const steps: readonly UiStep[] = [
    { id: 'delivery-view', action: 'assertExactlyOne', selector: { by: 'testId', testId: 'driver-delivery-view' }, serverCheckpoint: 'assignment-visible' },
    { id: 'accept', action: 'click', selector: { by: 'role', role: 'button', name: 'Auftrag annehmen' }, serverCheckpoint: 'accepted' },
  ]
  const evidence = await actor.run('/fahrer/app', steps)
  assert.equal(actor.actor.state, 'completed')
  assert.equal(evidence.length, 2)
  assert.ok(events.includes('click:role:button:Auftrag annehmen'))
  assert.ok(events.includes('snapshot:accepted'))
  assert.equal(events.at(-1), 'trace:stop')
})

test('exactly-once UI violation fails and preserves failure evidence', async () => {
  const events: string[] = []
  const actor = makeActor(events, { 'driver-navigation-cta': 2 })
  await assert.rejects(
    actor.run('/fahrer/app', [{
      id: 'navigation-once',
      action: 'assertExactlyOne',
      selector: { by: 'testId', testId: 'driver-navigation-cta' },
      serverCheckpoint: 'routed',
    }]),
    /expected exactly one element, found 2/,
  )
  assert.equal(actor.actor.state, 'failed')
  assert.ok(events.includes('screenshot:artifacts/lab-run-driver-1/failure.png'))
  assert.equal(events.at(-1), 'trace:stop')
})

test('cross-origin and protocol-relative navigation is rejected before page mutation', async () => {
  const events: string[] = []
  const actor = makeActor(events)
  await assert.rejects(actor.run('//production.example/order', []), /application-relative path/)
  assert.equal(events.length, 0)
})

