import assert from 'node:assert/strict'
import test from 'node:test'
import { createManagerTimerLinkController } from './createManagerTimerLinkController.js'
import { GM_SESSION_QUERY_KEY } from './timerLinkOrchestration.js'

function createHarness(initial = {}) {
  const state = {
    active: false,
    playSessionId: null,
    launchConfig: null,
    lastSyncPosture: 'local',
    ...initial,
  }
  /** @type {Array<{ path: string, query: Record<string, string> }>} */
  const navigations = []
  /** @type {unknown[][]} */
  const appliedSeats = []
  let hosting = false
  let leaveCount = 0
  let startAsHostCount = 0

  const controller = createManagerTimerLinkController({
    getLinkState: () => ({ ...state }),
    beginLink: ({ playSessionId, launchConfig }) => {
      state.active = true
      state.playSessionId = playSessionId
      state.launchConfig = launchConfig
    },
    clearLink: () => {
      state.active = false
      state.playSessionId = null
      state.launchConfig = null
    },
    setLastSyncPosture: (posture) => {
      state.lastSyncPosture = posture
    },
    applyLaunchConfig: (launchConfig) => {
      appliedSeats.push(launchConfig?.seats)
    },
    isHosting: () => hosting,
    leaveSession: () => {
      leaveCount += 1
      hosting = false
    },
    startAsHost: async () => {
      startAsHostCount += 1
      hosting = true
    },
    navigate: (route) => {
      navigations.push(route)
    },
  })

  return {
    state,
    controller,
    navigations,
    appliedSeats,
    setHosting: (v) => {
      hosting = v
    },
    get leaveCount() {
      return leaveCount
    },
    get startAsHostCount() {
      return startAsHostCount
    },
  }
}

const seats = [{ recordedPlayerId: 'p1', name: 'Ada', color: '#111111' }]

test('begin seeds link, applies seats, navigates with gmSession', async () => {
  const h = createHarness()
  const result = await h.controller.enterLinkedTimer({
    playSessionId: 'ps-1',
    launchConfig: { seats },
  })
  assert.equal(result.kind, 'begin')
  assert.equal(h.state.active, true)
  assert.equal(h.state.playSessionId, 'ps-1')
  assert.deepEqual(h.appliedSeats, [seats])
  assert.equal(h.navigations.length, 1)
  assert.equal(h.navigations[0].query[GM_SESSION_QUERY_KEY], 'ps-1')
  assert.equal(h.startAsHostCount, 0)
})

test('resume same session does not re-apply seats', async () => {
  const h = createHarness({
    active: true,
    playSessionId: 'ps-1',
    launchConfig: { seats },
  })
  const result = await h.controller.enterLinkedTimer({
    playSessionId: 'ps-1',
    launchConfig: { seats },
  })
  assert.equal(result.kind, 'resume')
  assert.equal(h.appliedSeats.length, 0)
  assert.equal(h.navigations[0].query[GM_SESSION_QUERY_KEY], 'ps-1')
})

test('takeover ends hosting room then replaces link and seats', async () => {
  const h = createHarness({
    active: true,
    playSessionId: 'old',
    launchConfig: { seats: [] },
  })
  h.setHosting(true)
  const nextSeats = [{ recordedPlayerId: 'p2', name: 'Bea', color: '#222222' }]
  const result = await h.controller.enterLinkedTimer({
    playSessionId: 'new',
    launchConfig: { seats: nextSeats },
  })
  assert.equal(result.kind, 'takeover')
  assert.equal(h.leaveCount, 1)
  assert.equal(h.state.playSessionId, 'new')
  assert.deepEqual(h.appliedSeats, [nextSeats])
})

test('auto-hosts when last sync posture is host', async () => {
  const h = createHarness({ lastSyncPosture: 'host' })
  await h.controller.enterLinkedTimer({
    playSessionId: 'ps-1',
    launchConfig: { seats },
  })
  assert.equal(h.startAsHostCount, 1)
})

test('clear after game end clears binding', () => {
  const h = createHarness({
    active: true,
    playSessionId: 'ps-1',
    launchConfig: { seats },
  })
  h.controller.clearAfterSuccessfulGameEnd()
  assert.equal(h.state.active, false)
  assert.equal(h.state.playSessionId, null)
})

test('recordPostureFromSession writes host or local', () => {
  const h = createHarness()
  h.controller.recordPostureFromSession({ isHosting: true })
  assert.equal(h.state.lastSyncPosture, 'host')
  h.controller.recordPostureFromSession({ isHosting: false })
  assert.equal(h.state.lastSyncPosture, 'local')
})
