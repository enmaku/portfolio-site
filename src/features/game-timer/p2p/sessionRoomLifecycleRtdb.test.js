/**
 * Run: node --experimental-test-module-mocks --test src/features/game-timer/p2p/sessionRoomLifecycleRtdb.test.js
 */
import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { useGameTimerStore } from '../../../stores/gameTimer.js'
import { useGameTimerRoomSessionStore } from '../../../stores/gameTimerRoomSession.js'
import {
  createRtdbLifecycleAfterEach,
  importGameTimerSession,
  installRtdbLifecycleMocks,
  withFirebaseEnv,
} from './sessionRtdbLifecycleHarness.js'

const rtdbLifecycleTests = { skip: !mock.module }
const rtdbAfterEach = createRtdbLifecycleAfterEach(mock)

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

afterEach(rtdbAfterEach)
