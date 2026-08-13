import assert from 'node:assert/strict'
import test from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { ref, shallowRef } from 'vue'
import { useGameManagerSessionFlow } from './composables/useGameManagerSessionFlow.js'
import { createManagerTimerLinkController } from './domain/createManagerTimerLinkController.js'
import { runLinkedGameEnd } from './domain/runLinkedGameEnd.js'
import { attachExportAndTransitionToScoring } from './domain/attachExportAndTransitionToScoring.js'
import {
  GM_CONTINUE_QUERY_KEY,
  GM_SESSION_QUERY_KEY,
  buildGameManagerScoringRoute,
} from './domain/timerLinkOrchestration.js'
import { useGameManagerTimerLinkStore } from '../../stores/gameManagerTimerLink.js'
import { useGameTimerStore } from '../../stores/gameTimer.js'
import { deriveTimerExportFromSnapshot } from '../game-timer/deriveTimerExportFromSnapshot.js'

/**
 * Thin owner journey: setup → startGame (link + timer route) → game end attach → scoring continue.
 */
test('owner journey handoff spine: launch then game-end to scoring', async () => {
  setActivePinia(createPinia())
  const linkStore = useGameManagerTimerLinkStore()
  const timerStore = useGameTimerStore()

  /** @type {Array<{ path: string, query: Record<string, string> }>} */
  const routes = []
  let hosting = false

  const linkController = createManagerTimerLinkController({
    getLinkState: () => ({
      active: linkStore.active,
      playSessionId: linkStore.playSessionId,
      launchConfig: linkStore.launchConfig,
      lastSyncPosture: linkStore.lastSyncPosture,
    }),
    beginLink: (input) => linkStore.beginLink(input),
    clearLink: () => linkStore.clearLink(),
    setLastSyncPosture: (posture) => linkStore.setLastSyncPosture(posture),
    applyLaunchConfig: (launchConfig) => timerStore.applyLaunchConfig(launchConfig),
    isHosting: () => hosting,
    leaveSession: () => {
      hosting = false
    },
    startAsHost: async () => {
      hosting = true
    },
    navigate: (route) => {
      routes.push(route)
    },
  })

  /** @type {object} */
  let session = {
    id: 'ps-journey',
    state: 'setup',
    presentPlayers: [
      { recordedPlayerId: 'p1', name: 'Ada', color: '#111111' },
      { recordedPlayerId: 'p2', name: 'Bea', color: '#222222' },
    ],
    score: null,
    timerExport: null,
  }
  const activeSession = shallowRef(session)

  const flow = useGameManagerSessionFlow({
    sessionsApi: {
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
        session = { ...session, state: next }
        activeSession.value = session
        return session
      },
      saveScore: async () => session,
      setAttendance: async () => session,
      addAttendance: async () => session,
      dropPlayer: async () => session,
      suggestionsForName: () => [],
      peekNextColor: () => '#111111',
      upsertPerson: async () => null,
      reload: async () => {},
      attachExport: async () => session,
    },
    activeSurface: ref('collection'),
    timerLink: {
      enterLinkedTimer: (input) => linkController.enterLinkedTimer(input),
    },
  })

  flow.flowPanel.value = 'setup'
  await flow.startGame()

  assert.equal(session.state, 'playing')
  assert.equal(flow.flowPanel.value, null)
  assert.equal(linkStore.active, true)
  assert.equal(linkStore.playSessionId, 'ps-journey')
  assert.equal(timerStore.players.length, 2)
  assert.equal(timerStore.players[0].recordedPlayerId, 'p1')
  assert.equal(routes.length, 1)
  assert.equal(routes[0].path, '/projects/game-timer')
  assert.equal(routes[0].query[GM_SESSION_QUERY_KEY], 'ps-journey')

  timerStore.totalGameStartedAt = 1_000
  timerStore.players[0].bankedMs = 2_000
  timerStore.players[1].bankedMs = 3_000
  hosting = true

  const end = await runLinkedGameEnd({
    canPersist: () => true,
    playSessionId: () => linkStore.playSessionId,
    isHosting: () => hosting,
    deriveExport: () =>
      deriveTimerExportFromSnapshot(
        {
          totalGameStartedAt: timerStore.totalGameStartedAt,
          players: timerStore.players,
          activePlayerId: timerStore.activePlayerId,
          turnStartedAt: timerStore.turnStartedAt,
        },
        6_000,
      ),
    attachExport: async (timerExport) => {
      session = await attachExportAndTransitionToScoring({
        uid: 'owner',
        playSessionId: 'ps-journey',
        timerExport,
        getSession: async () => session,
        upsertSession: async (_u, _id, next) => {
          session = next
          activeSession.value = next
        },
        newId: () => 'rp_x',
      })
      return session
    },
    transitionToScoring: async () => session,
    leaveSession: () => {
      hosting = false
    },
    clearLink: () => linkController.clearAfterSuccessfulGameEnd(),
    recordPosture: (input) => linkController.recordPostureFromSession(input),
    navigateToManagerScoring: (playSessionId) => {
      routes.push(buildGameManagerScoringRoute({ playSessionId }))
    },
  })

  assert.equal(end.ok, true)
  assert.equal(session.state, 'scoring')
  assert.ok(session.timerExport)
  assert.equal(linkStore.active, false)
  assert.equal(hosting, false)
  assert.equal(linkStore.lastSyncPosture, 'host')
  const continueRoute = routes[routes.length - 1]
  assert.equal(continueRoute.path, '/projects/game-manager')
  assert.equal(continueRoute.query[GM_CONTINUE_QUERY_KEY], 'ps-journey')

  await flow.openScoringFromTimerContinue('ps-journey')
  assert.equal(flow.flowPanel.value, 'scoring')
})
