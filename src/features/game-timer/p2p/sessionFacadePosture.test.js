/**
 * Game Timer facade connection posture — structured session events and loose guest attachment.
 * Separate from domain wire / snapshot tests.
 *
 * Run: node --experimental-test-module-mocks --test src/features/game-timer/p2p/sessionFacadePosture.test.js
 */
import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { useGameTimerRoomSessionStore } from '../../../stores/gameTimerRoomSession.js'
import { encodeHostSnapshot, encodeHostVisibility } from './protocol.js'
import {
  createRtdbLifecycleAfterEach,
  importGameTimerSession,
  installRtdbLifecycleMocks,
  withFirebaseEnv,
} from './sessionRtdbLifecycleHarness.js'

const postureTests = { skip: !mock.module }
const rtdbAfterEach = createRtdbLifecycleAfterEach(mock)

/** @type {import('../types.js').GameTimerSyncPayload} */
const EMPTY_SNAPSHOT = {
  players: [],
  activePlayerId: null,
  turnStartedAt: null,
  turnStartedRound: null,
  round: 1,
  playerOrderByRound: {},
}

const JOINABLE_HOST_STATE = encodeHostSnapshot(
  {
    players: [{ id: 'p1', name: 'Host', color: '#111111' }],
    activePlayerId: 'p1',
    turnStartedAt: null,
    turnStartedRound: null,
    round: 1,
    playerOrderByRound: {},
  },
  1,
)

/**
 * Production bridge shape without mounting Vue.
 * @param {Awaited<ReturnType<typeof importGameTimerSession>>} sessionMod
 */
function bindPostureHandlers(sessionMod) {
  setActivePinia(createPinia())
  const room = useGameTimerRoomSessionStore()
  sessionMod.bindGameTimerP2PHandlers({
    getSnapshot: () => ({ ...EMPTY_SNAPSHOT }),
    applySnapshot: () => {},
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
      const sessionMod = await importGameTimerSession(`fatal-${Date.now()}`)
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
      const sessionMod = await importGameTimerSession(`offline-${Date.now()}`)
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
      const sessionMod = await importGameTimerSession(`ended-${Date.now()}`)
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
  'host_ping_present updates remoteHostPresent while posture stays guest_connected',
  postureTests,
  async () => {
    mock.reset()
    const { listeners } = await installRtdbLifecycleMocks({
      getHostPing: () => Date.now(),
      getState: () => JOINABLE_HOST_STATE,
      getEnded: () => null,
    })

    await withFirebaseEnv(async () => {
      const sessionMod = await importGameTimerSession(`ping-${Date.now()}`)
      const { joinRoom, remoteHostPresent, sessionPhase, sessionSuffix } = sessionMod
      const { room } = bindPostureHandlers(sessionMod)

      await joinRoom('PING01')
      assert.equal(sessionPhase.value, 'guest_connected')

      const emitHostPing = listenerAt(listeners, 'hostPing')
      emitHostPing(Date.now())
      assert.equal(remoteHostPresent.value, true)

      emitHostPing(null)
      assert.equal(remoteHostPresent.value, false)
      assert.equal(sessionPhase.value, 'guest_connected')
      assert.equal(sessionSuffix.value, 'PING01')
      assert.equal(room.role, 'guest')
      assert.equal(room.suffix, 'PING01')
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
      const sessionMod = await importGameTimerSession(`vis-${Date.now()}`)
      const { joinRoom, remoteHostTabVisible, sessionPhase } = sessionMod
      bindPostureHandlers(sessionMod)

      await joinRoom('VIS001')
      assert.equal(sessionPhase.value, 'guest_connected')
      assert.equal(remoteHostTabVisible.value, true)

      listenerAt(listeners, 'hostVisible')(encodeHostVisibility(false))
      assert.equal(remoteHostTabVisible.value, false)
      assert.equal(sessionPhase.value, 'guest_connected')

      listenerAt(listeners, 'hostVisible')(encodeHostVisibility(true))
      assert.equal(remoteHostTabVisible.value, true)
    })
  },
)

test(
  'loose guest attachment stays guest_connected when host wire drops briefly',
  postureTests,
  async () => {
    mock.reset()
    const { listeners } = await installRtdbLifecycleMocks({
      getHostPing: () => Date.now(),
      getState: () => JOINABLE_HOST_STATE,
      getEnded: () => null,
    })

    await withFirebaseEnv(async () => {
      const sessionMod = await importGameTimerSession(`loose-${Date.now()}`)
      const { joinRoom, remoteHostPresent, sessionPhase, sessionSuffix } = sessionMod
      const { room } = bindPostureHandlers(sessionMod)

      await joinRoom('LOOSE1')
      assert.equal(sessionPhase.value, 'guest_connected')

      const emitHostPing = listenerAt(listeners, 'hostPing')
      emitHostPing(null)

      assert.equal(remoteHostPresent.value, false)
      assert.equal(sessionPhase.value, 'guest_connected')
      assert.equal(sessionSuffix.value, 'LOOSE1')
      assert.equal(room.role, 'guest')
      assert.equal(room.suffix, 'LOOSE1')

      const endedPath = [...listeners.keys()].find((p) => p.endsWith('ended'))
      assert.ok(endedPath)
      listenerAt(listeners, 'ended')(null)
      assert.equal(sessionPhase.value, 'guest_connected')
    })
  },
)

afterEach(rtdbAfterEach)
