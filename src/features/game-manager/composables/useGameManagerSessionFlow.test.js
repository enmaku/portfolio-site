import assert from 'node:assert/strict'
import test from 'node:test'
import { ref, shallowRef } from 'vue'
import { useGameManagerSessionFlow } from './useGameManagerSessionFlow.js'

function createSessionsApi(session) {
  const activeSession = shallowRef(session)
  return {
    activeSession,
    savedPeople: shallowRef([]),
    createSessionFromShelf: async () => session,
    selectSession: async (id) => {
      if (!id) {
        activeSession.value = null
        return null
      }
      activeSession.value = session
      return session
    },
    transition: async (next) => {
      activeSession.value = { ...activeSession.value, state: next }
      return activeSession.value
    },
    saveScore: async () => activeSession.value,
    setAttendance: async () => activeSession.value,
    addAttendance: async () => activeSession.value,
    dropPlayer: async () => activeSession.value,
    suggestionsForName: () => [],
    peekNextColor: () => '#111111',
    upsertPerson: async () => null,
    reload: async () => {},
    attachExport: async () => activeSession.value,
  }
}

test('startGame transitions playing then enters linked timer without playing panel', async () => {
  const session = {
    id: 'ps-1',
    state: 'setup',
    presentPlayers: [{ recordedPlayerId: 'p1', name: 'Ada', color: '#111111' }],
  }
  /** @type {unknown[]} */
  const enters = []
  const flow = useGameManagerSessionFlow({
    sessionsApi: createSessionsApi(session),
    activeSurface: ref('collection'),
    timerLink: {
      enterLinkedTimer: async (input) => {
        enters.push(input)
        return { kind: 'begin' }
      },
    },
  })
  flow.flowPanel.value = 'setup'
  await flow.startGame()
  assert.equal(flow.activeSession.value.state, 'playing')
  assert.equal(flow.flowPanel.value, null)
  assert.equal(enters.length, 1)
  assert.equal(enters[0].playSessionId, 'ps-1')
  assert.equal(enters[0].launchConfig.seats[0].recordedPlayerId, 'p1')
})

test('resumeSession playing re-enters linked timer without playing panel', async () => {
  const session = {
    id: 'ps-2',
    state: 'playing',
    presentPlayers: [{ recordedPlayerId: 'p1', name: 'Ada', color: '#111111' }],
  }
  /** @type {unknown[]} */
  const enters = []
  const flow = useGameManagerSessionFlow({
    sessionsApi: createSessionsApi(session),
    activeSurface: ref('sessions'),
    timerLink: {
      enterLinkedTimer: async (input) => {
        enters.push(input)
        return { kind: 'resume' }
      },
    },
  })
  await flow.resumeSession(session, 'sessions')
  assert.equal(flow.flowPanel.value, null)
  assert.equal(enters.length, 1)
  assert.equal(enters[0].playSessionId, 'ps-2')
})

test('resumeSession complete opens session statistics panel', async () => {
  const session = {
    id: 'ps-complete',
    state: 'complete',
    presentPlayers: [{ recordedPlayerId: 'p1', name: 'Ada', color: '#111111' }],
    score: { mode: 'points', perPlayer: { p1: 10 } },
  }
  const flow = useGameManagerSessionFlow({
    sessionsApi: createSessionsApi(session),
    activeSurface: ref('sessions'),
  })
  await flow.resumeSession(session, 'sessions')
  assert.equal(flow.flowPanel.value, 'sessionStats')
  assert.equal(flow.activeSession.value.state, 'complete')
})

test('resumeSession scoring opens scoring panel', async () => {
  const session = {
    id: 'ps-scoring',
    state: 'scoring',
    presentPlayers: [{ recordedPlayerId: 'p1', name: 'Ada', color: '#111111' }],
  }
  const flow = useGameManagerSessionFlow({
    sessionsApi: createSessionsApi(session),
    activeSurface: ref('sessions'),
  })
  await flow.resumeSession(session, 'sessions')
  assert.equal(flow.flowPanel.value, 'scoring')
})

test('returnToLinkedTimer demotes to playing and re-enters with export data', async () => {
  const session = {
    id: 'ps-back',
    state: 'scoring',
    presentPlayers: [{ recordedPlayerId: 'p1', name: 'Ada', color: '#111111' }],
    timerExport: {
      durationMs: 8_000,
      seats: [{ recordedPlayerId: 'p1', name: 'Ada', color: '#111111', bankedMs: 3_000 }],
    },
  }
  /** @type {unknown[]} */
  const enters = []
  const flow = useGameManagerSessionFlow({
    sessionsApi: createSessionsApi(session),
    activeSurface: ref('sessions'),
    timerLink: {
      enterLinkedTimer: async (input) => {
        enters.push(input)
        return { kind: 'begin' }
      },
    },
  })
  flow.flowPanel.value = 'scoring'
  await flow.returnToLinkedTimer()
  assert.equal(flow.activeSession.value.state, 'playing')
  assert.equal(flow.flowPanel.value, null)
  assert.equal(enters.length, 1)
  assert.equal(enters[0].playSessionId, 'ps-back')
  assert.equal(enters[0].forceApplySeats, true)
  assert.equal(enters[0].launchConfig.durationMs, 8_000)
  assert.equal(enters[0].launchConfig.seats[0].bankedMs, 3_000)
})

test('returnToLinkedTimer works while editing a complete session', async () => {
  const session = {
    id: 'ps-edit-back',
    state: 'complete',
    presentPlayers: [{ recordedPlayerId: 'p1', name: 'Ada', color: '#111111' }],
    score: { mode: 'points', perPlayer: { p1: 10 } },
    timerExport: {
      durationMs: 5_000,
      seats: [{ recordedPlayerId: 'p1', name: 'Ada', color: '#111111', bankedMs: 2_000 }],
    },
  }
  /** @type {unknown[]} */
  const enters = []
  const flow = useGameManagerSessionFlow({
    sessionsApi: createSessionsApi(session),
    activeSurface: ref('sessions'),
    timerLink: {
      enterLinkedTimer: async (input) => {
        enters.push(input)
        return { kind: 'begin' }
      },
    },
  })
  await flow.resumeSession(session, 'sessions')
  flow.editCompleteSessionScores()
  assert.equal(flow.flowPanel.value, 'scoring')
  assert.equal(flow.activeSession.value.state, 'complete')
  await flow.returnToLinkedTimer()
  assert.equal(flow.activeSession.value.state, 'playing')
  assert.equal(flow.flowPanel.value, null)
  assert.equal(enters.length, 1)
  assert.equal(enters[0].playSessionId, 'ps-edit-back')
  assert.equal(enters[0].launchConfig.seats[0].bankedMs, 2_000)
})

test('returnToLinkedTimer no-ops without timer export', async () => {
  const session = {
    id: 'ps-no-export',
    state: 'scoring',
    presentPlayers: [{ recordedPlayerId: 'p1', name: 'Ada', color: '#111111' }],
    timerExport: null,
  }
  /** @type {unknown[]} */
  const enters = []
  const flow = useGameManagerSessionFlow({
    sessionsApi: createSessionsApi(session),
    activeSurface: ref('sessions'),
    timerLink: {
      enterLinkedTimer: async (input) => {
        enters.push(input)
        return { kind: 'begin' }
      },
    },
  })
  flow.flowPanel.value = 'scoring'
  await flow.returnToLinkedTimer()
  assert.equal(flow.activeSession.value.state, 'scoring')
  assert.equal(flow.flowPanel.value, 'scoring')
  assert.equal(enters.length, 0)
})

test('editCompleteSessionScores switches to scoring while staying complete', async () => {
  const session = {
    id: 'ps-edit',
    state: 'complete',
    presentPlayers: [{ recordedPlayerId: 'p1', name: 'Ada', color: '#111111' }],
    score: { mode: 'points', perPlayer: { p1: 10 } },
  }
  const flow = useGameManagerSessionFlow({
    sessionsApi: createSessionsApi(session),
    activeSurface: ref('sessions'),
  })
  await flow.resumeSession(session, 'sessions')
  flow.editCompleteSessionScores()
  assert.equal(flow.flowPanel.value, 'scoring')
  assert.equal(flow.activeSession.value.state, 'complete')
})

test('saveAndComplete keeps overlay on session statistics', async () => {
  const session = {
    id: 'ps-save',
    state: 'scoring',
    presentPlayers: [{ recordedPlayerId: 'p1', name: 'Ada', color: '#111111' }],
    score: null,
  }
  const api = createSessionsApi(session)
  let saved = null
  api.saveScore = async (score) => {
    saved = score
    activeSessionWithScore(api, score)
    return api.activeSession.value
  }
  const activeSurface = ref('collection')
  const flow = useGameManagerSessionFlow({
    sessionsApi: api,
    activeSurface,
  })
  flow.flowPanel.value = 'scoring'
  await flow.saveAndComplete({ mode: 'points', perPlayer: { p1: 12 } })
  assert.ok(saved)
  assert.equal(flow.activeSession.value.state, 'complete')
  assert.equal(flow.flowPanel.value, 'sessionStats')
  assert.equal(flow.activeSession.value.id, 'ps-save')
  assert.equal(activeSurface.value, 'sessions')
})

test('saveAndComplete when already complete returns to session statistics', async () => {
  const session = {
    id: 'ps-resave',
    state: 'complete',
    presentPlayers: [{ recordedPlayerId: 'p1', name: 'Ada', color: '#111111' }],
    score: { mode: 'points', perPlayer: { p1: 10 } },
  }
  const api = createSessionsApi(session)
  api.saveScore = async (score) => {
    api.activeSession.value = { ...api.activeSession.value, score }
    return api.activeSession.value
  }
  const flow = useGameManagerSessionFlow({
    sessionsApi: api,
    activeSurface: ref('sessions'),
  })
  flow.flowPanel.value = 'scoring'
  await flow.saveAndComplete({ mode: 'points', perPlayer: { p1: 22 } })
  assert.equal(flow.activeSession.value.state, 'complete')
  assert.equal(flow.flowPanel.value, 'sessionStats')
  assert.equal(flow.activeSession.value.score.perPlayer.p1, 22)
})

function activeSessionWithScore(api, score) {
  api.activeSession.value = { ...api.activeSession.value, score }
}
