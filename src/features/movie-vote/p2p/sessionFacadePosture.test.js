/**
 * Movie Vote facade connection posture — structured shell events and strict guest presence.
 * Separate from domain wire / RTDB lifecycle tests.
 *
 * Run: node --experimental-test-module-mocks --test src/features/movie-vote/p2p/sessionFacadePosture.test.js
 */
import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { useMovieVoteRoomSessionStore } from '../../../stores/movieVoteRoomSession.js'
import { encodeState } from './protocol.js'
import { buildMovieVotePublicPayload } from '../publicPayload.js'
import {
  createRtdbLifecycleAfterEach,
  importMovieVoteSession,
  installRtdbLifecycleMocks,
  refPath,
  withFirebaseEnv,
} from './sessionRtdbLifecycleHarness.js'

const postureTests = { skip: !mock.module }
const rtdbAfterEach = createRtdbLifecycleAfterEach(mock)

/** @type {import('../types.js').MovieVotePublicPayload} */
const JOINABLE_SUGGEST_PAYLOAD = buildMovieVotePublicPayload(
  {
    phase: 'suggest',
    readyToVote: false,
    myDraftPicks: [],
    ballotMovies: [],
    ballotOrderIds: [],
    voteProgress: null,
    electionOutcome: null,
    votingMethod: 'irv',
  },
  new Map(),
)

const JOINABLE_HOST_STATE = encodeState(JOINABLE_SUGGEST_PAYLOAD, 1)

/**
 * Production bridge shape without mounting Vue; fake inbound payload apply only.
 * @param {Awaited<ReturnType<typeof importMovieVoteSession>>} sessionMod
 */
function bindPostureHandlers(sessionMod) {
  setActivePinia(createPinia())
  const room = useMovieVoteRoomSessionStore()
  sessionMod.bindMovieVoteP2PHandlers({
    applyPublicPayload: () => {},
    onWireTeardown: () => {},
  })
  return { room }
}

/**
 * @param {Map<string, (snap: { val: () => unknown }) => void>} listeners
 * @param {string} leaf
 * @returns {(value: unknown) => void}
 */
function listenerAt(listeners, leaf) {
  const path = [...listeners.keys()].find((p) => p.endsWith(leaf))
  assert.ok(path, `expected listener on path ending with ${leaf}`)
  const handler = listeners.get(path)
  assert.ok(handler)
  return (value) => handler({ val: () => value })
}

/**
 * @param {() => string} readPhase
 * @returns {Promise<void>}
 */
async function waitForReconnectExhaustion(readPhase) {
  const deadline = Date.now() + 3_000
  while (readPhase() !== 'idle' && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

test(
  'fatal reconnect exhaustion clears persistence and returns tab to idle',
  postureTests,
  async () => {
    mock.reset()

    mock.module('../../p2p/starRoomReconnectDelay.js', {
      namedExports: {
        starRoomReconnectDelayMs: () => 5,
      },
    })
    mock.module('../../p2p/starRoomTiming.js', {
      namedExports: {
        RECONNECT_MAX_ATTEMPTS: 3,
        RECONNECT_INITIAL_PAUSE_MS: 5,
        RECONNECT_BASE_DELAY_MS: 5,
        RECONNECT_MAX_DELAY_MS: 5,
      },
    })

    let roomJoinable = true
    const { listeners } = await installRtdbLifecycleMocks({
      getHostPing: () => (roomJoinable ? Date.now() : null),
      getState: () => (roomJoinable ? JOINABLE_HOST_STATE : null),
      getEnded: () => null,
    })

    await withFirebaseEnv(async () => {
      const sessionMod = await importMovieVoteSession(`fatal-${Date.now()}`)
      const { joinRoom, sessionPhase, sessionSuffix } = sessionMod
      const { room } = bindPostureHandlers(sessionMod)

      await joinRoom('FATAL1')
      assert.equal(sessionPhase.value, 'guest_connected')
      assert.equal(room.role, 'guest')
      assert.equal(room.suffix, 'FATAL1')

      roomJoinable = false
      listenerAt(listeners, 'connected')(false)
      assert.equal(sessionPhase.value, 'reconnecting')

      await waitForReconnectExhaustion(() => sessionPhase.value)

      assert.equal(sessionPhase.value, 'idle')
      assert.equal(sessionSuffix.value, null)
      assert.equal(room.role, null)
      assert.equal(room.suffix, null)
    })
  },
)

test(
  'connectivity_offline moves guest connection posture to reconnecting',
  postureTests,
  async () => {
    mock.reset()
    const { listeners } = await installRtdbLifecycleMocks({
      getHostPing: () => Date.now(),
      getState: () => JOINABLE_HOST_STATE,
      getEnded: () => null,
    })

    await withFirebaseEnv(async () => {
      const sessionMod = await importMovieVoteSession(`offline-${Date.now()}`)
      const { joinRoom, sessionPhase } = sessionMod
      bindPostureHandlers(sessionMod)

      await joinRoom('OFFLN1')
      assert.equal(sessionPhase.value, 'guest_connected')

      listenerAt(listeners, 'connected')(false)

      assert.equal(sessionPhase.value, 'reconnecting')
    })
  },
)

test(
  'host_ended_room triggers room exit on guest tab',
  postureTests,
  async () => {
    mock.reset()
    const { listeners } = await installRtdbLifecycleMocks({
      getHostPing: () => Date.now(),
      getState: () => JOINABLE_HOST_STATE,
      getEnded: () => null,
    })

    await withFirebaseEnv(async () => {
      const sessionMod = await importMovieVoteSession(`ended-${Date.now()}`)
      const { joinRoom, sessionPhase, sessionSuffix } = sessionMod
      const { room } = bindPostureHandlers(sessionMod)

      await joinRoom('END123')
      assert.equal(sessionPhase.value, 'guest_connected')
      assert.equal(room.role, 'guest')

      listenerAt(listeners, 'ended')(1_700_000_000_000)

      assert.equal(sessionPhase.value, 'idle')
      assert.equal(sessionSuffix.value, null)
      assert.equal(room.role, null)
      assert.equal(room.suffix, null)
    })
  },
)

test(
  'strict guest presence does not wire hostPing (Movie Vote; Game Timer uses loose attachment)',
  postureTests,
  async () => {
    mock.reset()
    const { listeners } = await installRtdbLifecycleMocks({
      getHostPing: () => Date.now(),
      getState: () => JOINABLE_HOST_STATE,
      getEnded: () => null,
    })

    await withFirebaseEnv(async () => {
      const sessionMod = await importMovieVoteSession(`strict-${Date.now()}`)
      const { joinRoom, sessionPhase, sessionSuffix } = sessionMod
      const { room } = bindPostureHandlers(sessionMod)

      await joinRoom('STRICT')
      assert.equal(sessionPhase.value, 'guest_connected')
      assert.equal(
        [...listeners.keys()].some((p) => p.endsWith('hostPing')),
        false,
        'strict guest should not subscribe to hostPing',
      )

      assert.equal(sessionPhase.value, 'guest_connected')
      assert.equal(sessionSuffix.value, 'STRICT')
      assert.equal(room.role, 'guest')
      assert.equal(room.suffix, 'STRICT')
    })
  },
)

test(
  'strict guest joins without hostPing when joinable state is present',
  postureTests,
  async () => {
    mock.reset()
    const { listeners } = await installRtdbLifecycleMocks({
      getHostPing: () => null,
      getState: () => JOINABLE_HOST_STATE,
      getEnded: () => null,
    })

    await withFirebaseEnv(async () => {
      const sessionMod = await importMovieVoteSession(`state-only-${Date.now()}`)
      const { joinRoom, sessionPhase, sessionSuffix } = sessionMod
      const { room } = bindPostureHandlers(sessionMod)

      await joinRoom('STATE1')
      assert.equal(sessionPhase.value, 'guest_connected')
      assert.equal(sessionSuffix.value, 'STATE1')
      assert.equal(
        [...listeners.keys()].some((p) => p.endsWith('hostPing')),
        false,
        'strict guest should not subscribe to hostPing',
      )
      assert.equal(room.role, 'guest')
    })
  },
)

test(
  'guest establish marks guestOnline for stable client',
  postureTests,
  async () => {
    mock.reset()
    const stableId = 'MVPOSTUREGUEST'
    /** @type {Array<{ path: string, value: unknown }>} */
    const rtdbSets = []

    mock.module('../../p2p/identity.js', {
      namedExports: {
        ...(await import('../../p2p/identity.js')),
        getStableClientId: () => stableId,
        deriveStableHostSuffix: () => 'AAAAAA',
      },
    })

    const actualRtdb = await import('../firebase/rtdb.js')
    mock.module('../firebase/rtdb.js', {
      namedExports: {
        ...actualRtdb,
        setRtdb: async (ref, value) => {
          rtdbSets.push({ path: refPath(ref), value })
          return actualRtdb.setRtdb(ref, value)
        },
      },
    })

    await installRtdbLifecycleMocks({
      getHostPing: () => Date.now(),
      getState: () => JOINABLE_HOST_STATE,
      getEnded: () => null,
    })

    await withFirebaseEnv(async () => {
      const sessionMod = await importMovieVoteSession(`guest-online-${Date.now()}`)
      const { joinRoom, sessionPhase } = sessionMod
      bindPostureHandlers(sessionMod)

      await joinRoom('JOIN01')
      assert.equal(sessionPhase.value, 'guest_connected')

      assert.ok(
        rtdbSets.some(
          (s) => s.path.includes('guestOnline') && s.path.includes(stableId) && s.value === true,
        ),
        'guest establish should mark guestOnline',
      )
    })
  },
)

test(
  'guest teardown clears guestOnline signal for stable client',
  postureTests,
  async () => {
    mock.reset()
    const stableId = 'MVPOSTUREOFF'
    /** @type {Array<{ path: string, value: unknown }>} */
    const rtdbSets = []

    mock.module('../../p2p/identity.js', {
      namedExports: {
        ...(await import('../../p2p/identity.js')),
        getStableClientId: () => stableId,
        deriveStableHostSuffix: () => 'AAAAAA',
      },
    })

    const actualRtdb = await import('../firebase/rtdb.js')
    mock.module('../firebase/rtdb.js', {
      namedExports: {
        ...actualRtdb,
        setRtdb: async (ref, value) => {
          rtdbSets.push({ path: refPath(ref), value })
          return actualRtdb.setRtdb(ref, value)
        },
      },
    })

    await installRtdbLifecycleMocks({
      getHostPing: () => Date.now(),
      getState: () => JOINABLE_HOST_STATE,
      getEnded: () => null,
    })

    await withFirebaseEnv(async () => {
      const sessionMod = await importMovieVoteSession(`guest-offline-${Date.now()}`)
      const { joinRoom, sessionPhase, teardownSession } = sessionMod
      bindPostureHandlers(sessionMod)

      await joinRoom('TEAR01')
      assert.equal(sessionPhase.value, 'guest_connected')
      teardownSession()

      assert.ok(
        rtdbSets.some(
          (s) => s.path.includes('guestOnline') && s.path.includes(stableId) && s.value === false,
        ),
        'guest teardown should mark guestOnline false',
      )
    })
  },
)

test(
  'host_tab_visible updates remoteHostTabVisible ref',
  postureTests,
  async () => {
    mock.reset()
    const { listeners } = await installRtdbLifecycleMocks({
      getHostPing: () => Date.now(),
      getState: () => JOINABLE_HOST_STATE,
      getEnded: () => null,
    })

    await withFirebaseEnv(async () => {
      const sessionMod = await importMovieVoteSession(`vis-${Date.now()}`)
      const { joinRoom, remoteHostTabVisible, sessionPhase } = sessionMod
      bindPostureHandlers(sessionMod)

      await joinRoom('VIS001')
      assert.equal(sessionPhase.value, 'guest_connected')
      assert.equal(remoteHostTabVisible.value, true)

      const { encodeHostVisibility } = await import('./protocol.js')
      listenerAt(listeners, 'hostVisible')(encodeHostVisibility(false))
      assert.equal(remoteHostTabVisible.value, false)
      assert.equal(sessionPhase.value, 'guest_connected')

      listenerAt(listeners, 'hostVisible')(encodeHostVisibility(true))
      assert.equal(remoteHostTabVisible.value, true)
    })
  },
)

afterEach(rtdbAfterEach)
