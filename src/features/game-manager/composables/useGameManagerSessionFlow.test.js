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
