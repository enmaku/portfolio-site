/**
 * Run: node --experimental-test-module-mocks --test src/features/movie-vote/p2p/sessionRtdbLifecycleHarness.test.js
 */
import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { encodeState } from './protocol.js'
import { buildMovieVotePublicPayload } from '../publicPayload.js'
import {
  createRtdbLifecycleAfterEach,
  importMovieVoteSession,
  installRtdbLifecycleMocks,
  withFirebaseEnv,
} from './sessionRtdbLifecycleHarness.js'
import { resetMovieVoteFacadeWireStateForTests } from './session.testExports.js'

const harnessTests = { skip: !mock.module }
const rtdbAfterEach = createRtdbLifecycleAfterEach(mock)

test(
  'importMovieVoteSession loads isolated session module per nonce',
  harnessTests,
  async () => {
    mock.reset()
    await installRtdbLifecycleMocks()

    await withFirebaseEnv(async () => {
      const modA = await importMovieVoteSession(`iso-a-${Date.now()}`)
      const modB = await importMovieVoteSession(`iso-b-${Date.now()}`)
      assert.notEqual(modA, modB)
      assert.equal(modA.sessionPhase.value, 'idle')
      assert.equal(modB.sessionPhase.value, 'idle')
    })
  },
)

test(
  'resetMovieVoteFacadeWireStateForTests clears guest lastSeenSeq between inbound applies',
  harnessTests,
  async () => {
    mock.reset()
    const joinableState = encodeState(
      buildMovieVotePublicPayload(
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
      ),
      3,
    )

    const harness = await installRtdbLifecycleMocks({
      getHostPing: () => Date.now(),
      getState: () => joinableState,
      getEnded: () => null,
    })

    await withFirebaseEnv(async () => {
      const sessionMod = await importMovieVoteSession(`last-seen-${Date.now()}`)
      const { joinRoom, teardownSession, bindMovieVoteP2PHandlers } = sessionMod

      setActivePinia(createPinia())
      let applyCount = 0
      bindMovieVoteP2PHandlers({
        applyPublicPayload: () => {
          applyCount += 1
        },
        onWireTeardown: () => {},
      })

      await joinRoom('LAST01')
      const statePath = [...harness.listeners.keys()].find((p) => p.endsWith('/state'))
      assert.ok(statePath)
      harness.emitValue(statePath, joinableState)
      assert.equal(applyCount, 1)

      harness.emitValue(statePath, joinableState)
      assert.equal(applyCount, 1, 'duplicate seq should be ignored while module is live')

      teardownSession()
      resetMovieVoteFacadeWireStateForTests(sessionMod)
      applyCount = 0
      bindMovieVoteP2PHandlers({
        applyPublicPayload: () => {
          applyCount += 1
        },
        onWireTeardown: () => {},
      })

      await joinRoom('LAST01')
      const statePathAfterReset = [...harness.listeners.keys()].find((p) => p.endsWith('/state'))
      assert.ok(statePathAfterReset)
      harness.emitValue(statePathAfterReset, joinableState)
      assert.equal(applyCount, 1, 'reset should allow the same seq to apply again on reuse')
    })
  },
)

afterEach(rtdbAfterEach)
