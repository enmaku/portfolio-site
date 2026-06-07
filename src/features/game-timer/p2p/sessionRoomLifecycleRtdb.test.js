/**
 * Run: node --experimental-test-module-mocks --test src/features/game-timer/p2p/sessionRoomLifecycleRtdb.test.js
 */
import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { useGameTimerStore } from '../../../stores/gameTimer.js'
import { useGameTimerRoomSessionStore } from '../../../stores/gameTimerRoomSession.js'
import { encodeGuestHello, parseHostMessage } from './protocol.js'
import { simulateHostInboxMessage } from '../../p2p/test/hostInboxHarness.js'
import {
  createRtdbLifecycleAfterEach,
  importGameTimerSession,
  installRtdbLifecycleMocks,
  withFirebaseEnv,
} from './sessionRtdbLifecycleHarness.js'

const rtdbLifecycleTests = { skip: !mock.module }
const rtdbAfterEach = createRtdbLifecycleAfterEach(mock)

/**
 * @param {Array<{ path: string, value: unknown }>} sets
 * @returns {Array<{ seq: number }>}
 */
function stateSeqWrites(sets) {
  return sets
    .filter((entry) => entry.path.endsWith('/state'))
    .map((entry) => {
      const parsed = parseHostMessage(entry.value)
      assert.ok(parsed, 'state write must be a host snapshot message')
      return { seq: parsed.seq }
    })
}

test(
  'guest RTDB ended marker clears room persistence but keeps roster',
  rtdbLifecycleTests,
  async () => {
    mock.reset()
    const { listeners } = await installRtdbLifecycleMocks()

    await withFirebaseEnv(async () => {
      const { joinRoom, sessionPhase, sessionSuffix } = await importGameTimerSession(
        String(Date.now()),
      )
      setActivePinia(createPinia())
      const store = useGameTimerStore()
      const room = useGameTimerRoomSessionStore()
      store.addPlayer({ name: 'Guest', color: '#444444' })
      const playerIds = store.players.map((p) => p.id)

      await joinRoom('ABC123')
      assert.equal(sessionPhase.value, 'guest_connected')
      assert.equal(room.role, 'guest')

      const endedPath = [...listeners.keys()].find((p) => p.endsWith('ended'))
      assert.ok(endedPath, 'guest wire should subscribe to ended')
      const onEnded = listeners.get(endedPath)
      assert.ok(onEnded)
      onEnded({ val: () => 1_700_000_000_000 })

      assert.equal(sessionPhase.value, 'idle')
      assert.equal(sessionSuffix.value, null)
      assert.equal(room.role, null)
      assert.equal(room.suffix, null)
      assert.equal(store.players.length, 1)
      assert.deepEqual(store.players.map((p) => p.id), playerIds)
    })
  },
)

test(
  'guest RTDB hostPing removal stays connected and keeps room persistence',
  rtdbLifecycleTests,
  async () => {
    mock.reset()
    const { listeners } = await installRtdbLifecycleMocks()

    await withFirebaseEnv(async () => {
      const { joinRoom, remoteHostPresent, sessionPhase, sessionSuffix } =
        await importGameTimerSession(String(Date.now()))
      setActivePinia(createPinia())
      const store = useGameTimerStore()
      const room = useGameTimerRoomSessionStore()
      store.addPlayer({ name: 'Guest', color: '#555555' })

      await joinRoom('ABC123')
      assert.equal(sessionPhase.value, 'guest_connected')
      assert.equal(room.role, 'guest')
      assert.equal(room.suffix, 'ABC123')

      const hostPingPath = [...listeners.keys()].find((p) => p.endsWith('hostPing'))
      assert.ok(hostPingPath, 'guest wire should subscribe to hostPing')
      const onHostPing = listeners.get(hostPingPath)
      assert.ok(onHostPing)
      onHostPing({ val: () => Date.now() })
      onHostPing({ val: () => null })

      assert.equal(sessionPhase.value, 'guest_connected')
      assert.equal(sessionSuffix.value, 'ABC123')
      assert.equal(room.role, 'guest')
      assert.equal(room.suffix, 'ABC123')
      assert.equal(remoteHostPresent.value, false)
      assert.equal(store.players.length, 1)
      assert.equal(store.players[0].name, 'Guest')
    })
  },
)

test(
  'loose host startAsHost publishes initial authoritative snapshot',
  rtdbLifecycleTests,
  async () => {
    mock.reset()
    const hostStableId = 'GTHOSTLIFE01'
    const suffix = 'LIFE01'

    mock.module('../../p2p/identity.js', {
      namedExports: {
        ...(await import('../../p2p/identity.js')),
        getStableClientId: () => hostStableId,
        deriveStableHostSuffix: () => suffix,
      },
    })

    const harness = await installRtdbLifecycleMocks({
      getHostPing: () => null,
      getEnded: () => null,
      getHostClientId: () => null,
    })

    await withFirebaseEnv(async () => {
      const sessionMod = await importGameTimerSession(`host-start-${Date.now()}`)
      const { startAsHost, sessionPhase, bindGameTimerP2PHandlers } = sessionMod

      setActivePinia(createPinia())
      const store = useGameTimerStore()
      store.addPlayer({ name: 'Host', color: '#111111' })
      bindGameTimerP2PHandlers({
        getSnapshot: () => ({
          players: store.players.map((p) => ({
            id: p.id,
            name: p.name,
            color: p.color,
          })),
          activePlayerId: store.players[0]?.id ?? null,
          turnStartedAt: null,
          turnStartedRound: null,
          round: 1,
          playerOrderByRound: {},
        }),
        applySnapshot: () => {},
      })

      const result = await startAsHost(3)
      assert.equal(result.suffix, suffix)
      assert.equal(sessionPhase.value, 'hosting')

      const broadcasts = stateSeqWrites(harness.sets)
      assert.equal(broadcasts.length, 1)
      assert.equal(broadcasts[0].seq, 1)
    })
  },
)

test(
  'loose host guest hello rebroadcasts snapshot with increasing seq',
  rtdbLifecycleTests,
  async () => {
    mock.reset()
    const hostStableId = 'GTHOSTLIFE02'
    const guestStableId = 'GTGUESTLIFE2'
    const suffix = 'LIFE02'

    mock.module('../../p2p/identity.js', {
      namedExports: {
        ...(await import('../../p2p/identity.js')),
        getStableClientId: () => hostStableId,
        deriveStableHostSuffix: () => suffix,
      },
    })

    const harness = await installRtdbLifecycleMocks({
      getHostPing: () => null,
      getEnded: () => null,
      getHostClientId: () => null,
    })

    await withFirebaseEnv(async () => {
      const sessionMod = await importGameTimerSession(`host-hello-${Date.now()}`)
      const { startAsHost, sessionPhase, bindGameTimerP2PHandlers } = sessionMod

      setActivePinia(createPinia())
      bindGameTimerP2PHandlers({
        getSnapshot: () => ({
          players: [{ id: 'p1', name: 'Host', color: '#111111' }],
          activePlayerId: 'p1',
          turnStartedAt: null,
          turnStartedRound: null,
          round: 1,
          playerOrderByRound: { 1: ['p1'] },
        }),
        applySnapshot: () => {},
      })

      await startAsHost(3)
      assert.equal(sessionPhase.value, 'hosting')

      const beforeHello = harness.sets.length
      simulateHostInboxMessage(harness, 'gameTimerRooms', suffix, guestStableId, encodeGuestHello(guestStableId))

      const helloBroadcasts = stateSeqWrites(harness.sets.slice(beforeHello))
      assert.equal(helloBroadcasts.length, 1)
      assert.equal(helloBroadcasts[0].seq, 2)
    })
  },
)

test(
  'guest leaveSession clears join persistence and returns tab to idle',
  rtdbLifecycleTests,
  async () => {
    mock.reset()
    await installRtdbLifecycleMocks()

    await withFirebaseEnv(async () => {
      const sessionMod = await importGameTimerSession(`guest-leave-${Date.now()}`)
      const { joinRoom, leaveSession, sessionPhase, sessionSuffix } = sessionMod

      setActivePinia(createPinia())
      const room = useGameTimerRoomSessionStore()
      const store = useGameTimerStore()
      store.addPlayer({ name: 'Guest', color: '#666666' })

      await joinRoom('LEAVE1')
      assert.equal(sessionPhase.value, 'guest_connected')
      assert.equal(room.role, 'guest')

      leaveSession()

      assert.equal(sessionPhase.value, 'idle')
      assert.equal(sessionSuffix.value, null)
      assert.equal(room.role, null)
      assert.equal(room.suffix, null)
      assert.equal(store.players.length, 1, 'room exit should keep roster on guest tab')
    })
  },
)

test(
  'host leaveSession writes deliberate ended marker and clears host persistence',
  rtdbLifecycleTests,
  async () => {
    mock.reset()
    const hostStableId = 'GTHOSTLIFE03'
    const suffix = 'LIFE03'

    mock.module('../../p2p/identity.js', {
      namedExports: {
        ...(await import('../../p2p/identity.js')),
        getStableClientId: () => hostStableId,
        deriveStableHostSuffix: () => suffix,
      },
    })

    const harness = await installRtdbLifecycleMocks({
      getHostPing: () => null,
      getEnded: () => null,
      getHostClientId: () => null,
    })

    await withFirebaseEnv(async () => {
      const sessionMod = await importGameTimerSession(`host-leave-${Date.now()}`)
      const { startAsHost, leaveSession, sessionPhase, bindGameTimerP2PHandlers } = sessionMod

      setActivePinia(createPinia())
      const room = useGameTimerRoomSessionStore()
      bindGameTimerP2PHandlers({
        getSnapshot: () => ({
          players: [],
          activePlayerId: null,
          turnStartedAt: null,
          turnStartedRound: null,
          round: 1,
          playerOrderByRound: {},
        }),
        applySnapshot: () => {},
      })

      await startAsHost(3)
      assert.equal(sessionPhase.value, 'hosting')
      assert.equal(room.role, 'host')

      const setsBeforeLeave = harness.sets.length
      leaveSession()

      assert.equal(sessionPhase.value, 'idle')
      assert.equal(room.role, null)
      assert.ok(
        harness.sets.slice(setsBeforeLeave).some((s) => s.path.endsWith('/ended')),
        'deliberate host end should write ended marker',
      )
    })
  },
)

afterEach(rtdbAfterEach)
