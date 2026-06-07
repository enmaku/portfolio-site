/**
 * Run: node --experimental-test-module-mocks --test src/features/game-timer/p2p/sessionRtdbLifecycleHarness.test.js
 */
import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { encodeHostSnapshot } from './protocol.js'
import {
  createRtdbLifecycleAfterEach,
  importGameTimerSession,
  installRtdbLifecycleMocks,
  withFirebaseEnv,
} from './sessionRtdbLifecycleHarness.js'
import { resetGameTimerP2PWireStateForTests } from './session.testExports.js'

const harnessTests = { skip: !mock.module }
const rtdbAfterEach = createRtdbLifecycleAfterEach(mock)

test(
  'importGameTimerSession loads isolated session module per nonce',
  harnessTests,
  async () => {
    mock.reset()
    await installRtdbLifecycleMocks()

    await withFirebaseEnv(async () => {
      const modA = await importGameTimerSession(`iso-a-${Date.now()}`)
      const modB = await importGameTimerSession(`iso-b-${Date.now()}`)
      assert.notEqual(modA, modB)
      assert.equal(modA.sessionPhase.value, 'idle')
      assert.equal(modB.sessionPhase.value, 'idle')
    })
  },
)

test(
  'resetGameTimerP2PWireStateForTests clears guest lastSeenSeq between inbound applies',
  harnessTests,
  async () => {
    mock.reset()
    const hostSnapshot = encodeHostSnapshot(
      {
        players: [{ id: 'p1', name: 'Host', color: '#111111' }],
        activePlayerId: 'p1',
        turnStartedAt: null,
        turnStartedRound: null,
        round: 1,
        playerOrderByRound: {},
      },
      3,
    )

    const harness = await installRtdbLifecycleMocks()

    await withFirebaseEnv(async () => {
      const sessionMod = await importGameTimerSession(`last-seen-${Date.now()}`)
      const { joinRoom, teardownSession, bindGameTimerP2PHandlers } = sessionMod

      setActivePinia(createPinia())
      let applyCount = 0
      bindGameTimerP2PHandlers({
        getSnapshot: () => ({
          players: [],
          activePlayerId: null,
          turnStartedAt: null,
          turnStartedRound: null,
          round: 1,
          playerOrderByRound: {},
        }),
        applySnapshot: () => {
          applyCount += 1
        },
      })

      await joinRoom('LAST01')
      const statePath = [...harness.listeners.keys()].find((p) => p.endsWith('/state'))
      assert.ok(statePath)
      harness.emitValue(statePath, hostSnapshot)
      assert.equal(applyCount, 1)

      harness.emitValue(statePath, hostSnapshot)
      assert.equal(applyCount, 1, 'duplicate seq should be ignored while module is live')

      teardownSession()
      resetGameTimerP2PWireStateForTests(sessionMod)
      applyCount = 0
      bindGameTimerP2PHandlers({
        getSnapshot: () => ({
          players: [],
          activePlayerId: null,
          turnStartedAt: null,
          turnStartedRound: null,
          round: 1,
          playerOrderByRound: {},
        }),
        applySnapshot: () => {
          applyCount += 1
        },
      })

      await joinRoom('LAST01')
      const statePathAfterReset = [...harness.listeners.keys()].find((p) => p.endsWith('/state'))
      assert.ok(statePathAfterReset)
      harness.emitValue(statePathAfterReset, hostSnapshot)
      assert.equal(applyCount, 1, 'reset should allow the same seq to apply again on reuse')
    })
  },
)

afterEach(rtdbAfterEach)
