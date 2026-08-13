import assert from 'node:assert/strict'
import test from 'node:test'
import { runLinkedGameEnd } from './runLinkedGameEnd.js'
import { GM_CONTINUE_QUERY_KEY } from './timerLinkOrchestration.js'

function createHarness(overrides = {}) {
  const calls = {
    attach: 0,
    transition: 0,
    leave: 0,
    clear: 0,
    navigate: /** @type {unknown[]} */ ([]),
    posture: /** @type {unknown[]} */ ([]),
  }
  let hosting = overrides.hosting ?? false
  let canPersist = overrides.canPersist ?? true
  let attachFails = overrides.attachFails ?? false
  let transitionFails = overrides.transitionFails ?? false

  const resultPromise = runLinkedGameEnd({
    canPersist: () => canPersist,
    playSessionId: () => 'ps-1',
    isHosting: () => hosting,
    deriveExport: () => ({
      durationMs: 1000,
      seats: [{ name: 'Ada', color: '#1', bankedMs: 1000, recordedPlayerId: 'p1' }],
    }),
    attachExport: async () => {
      calls.attach += 1
      if (attachFails) throw new Error('attach failed')
      return { id: 'ps-1', state: 'playing' }
    },
    transitionToScoring: async () => {
      calls.transition += 1
      if (transitionFails) throw new Error('transition failed')
      return { id: 'ps-1', state: 'scoring' }
    },
    leaveSession: () => {
      calls.leave += 1
      hosting = false
    },
    clearLink: () => {
      calls.clear += 1
    },
    recordPosture: (input) => {
      calls.posture.push(input)
    },
    navigateToManagerScoring: (playSessionId) => {
      calls.navigate.push(playSessionId)
    },
  })

  return { calls, resultPromise, setCanPersist: (v) => { canPersist = v } }
}

test('linked game end attaches, transitions, clears, and navigates', async () => {
  const h = createHarness({ hosting: true })
  const result = await h.resultPromise
  assert.deepEqual(result, { ok: true })
  assert.equal(h.calls.attach, 1)
  assert.equal(h.calls.transition, 1)
  assert.equal(h.calls.leave, 1)
  assert.equal(h.calls.clear, 1)
  assert.deepEqual(h.calls.posture, [{ isHosting: true }])
  assert.deepEqual(h.calls.navigate, ['ps-1'])
})

test('linked game end fail-closed on auth does not attach or navigate', async () => {
  const h = createHarness({ canPersist: false })
  const result = await h.resultPromise
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'auth')
  assert.equal(h.calls.attach, 0)
  assert.equal(h.calls.clear, 0)
  assert.equal(h.calls.navigate.length, 0)
})

test('linked game end fail-closed on attach does not transition or clear', async () => {
  const h = createHarness({ attachFails: true })
  const result = await h.resultPromise
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'attach')
  assert.equal(h.calls.transition, 0)
  assert.equal(h.calls.clear, 0)
  assert.equal(h.calls.leave, 0)
  assert.equal(h.calls.navigate.length, 0)
})

test('linked game end fail-closed on transition does not clear or leave', async () => {
  const h = createHarness({ transitionFails: true, hosting: true })
  const result = await h.resultPromise
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'transition')
  assert.equal(h.calls.attach, 1)
  assert.equal(h.calls.clear, 0)
  assert.equal(h.calls.leave, 0)
  assert.equal(h.calls.navigate.length, 0)
})

test('buildGameManagerScoringRoute uses continue query', async () => {
  const { buildGameManagerScoringRoute } = await import('./timerLinkOrchestration.js')
  const route = buildGameManagerScoringRoute({ playSessionId: 'ps-9' })
  assert.equal(route.path, '/projects/game-manager')
  assert.equal(route.query[GM_CONTINUE_QUERY_KEY], 'ps-9')
})
