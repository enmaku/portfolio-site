/**
 * Run: node --experimental-test-module-mocks --test src/features/movie-vote/p2p/movieVotePiniaBridge.hostReset.test.js
 *
 * Host-reset wire integration (dynamic session load after RTDB mocks).
 */
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useMovieVoteStore } from '../../../stores/movieVote.js'
import { installRtdbLifecycleMocks, withFirebaseEnv } from './sessionRtdbLifecycleHarness.js'

/** @returns {import('../types.js').MoviePick} */
function customPick(localId, title) {
  return {
    localId,
    source: 'custom',
    tmdbId: null,
    customKey: title.toLowerCase(),
    title,
    posterPath: null,
    overview: '',
  }
}

const hostResetWireTests = { skip: !mock.module }

test(
  'host resetToSuggest clears guest draft ready flags and broadcasts state',
  hostResetWireTests,
  async () => {
    mock.reset()

    mock.module('../../p2p/identity.js', {
      namedExports: {
        ...(await import('../../p2p/identity.js')),
        getStableClientId: () => 'MVHOSTRESET1',
        deriveStableHostSuffix: () => 'RESET1',
      },
    })

    const harness = await installRtdbLifecycleMocks({
      getHostPing: () => null,
      getEnded: () => null,
      getHostClientId: () => null,
    })

    try {
      await withFirebaseEnv(async () => {
        const sessionMod = await import('./session.js')
        const bridgeMod = await import('./movieVotePiniaBridge.js')

        sessionMod.resetHostStateBroadcastProbeForTests()

        const pinia = createPinia()
        pinia.use(bridgeMod.movieVoteP2PPlugin)
        const app = createApp({ render: () => null })
        app.use(pinia)
        setActivePinia(pinia)
        const store = useMovieVoteStore()

        await sessionMod.startAsHost(3)
        assert.equal(sessionMod.sessionPhase.value, 'hosting')

        sessionMod.setGuestDraftForTests('guest-1', { picks: [], ready: true })
        sessionMod.setGuestDraftForTests('guest-2', {
          picks: [customPick('g2', 'Guest Two')],
          ready: true,
        })

        store.phase = 'results'
        sessionMod.drainHostStateBroadcastProbeForTests()
        bridgeMod.resetMovieVoteHostResetToSuggestProbeForTests()

        store.resetToSuggest()

        assert.deepEqual(bridgeMod.drainMovieVoteHostResetToSuggestProbeForTests(), [
          'resetToSuggest',
        ])
        assert.equal(sessionMod.getGuestDraftReadyForTests('guest-1'), false)
        assert.equal(sessionMod.getGuestDraftReadyForTests('guest-2'), false)
        assert.ok(sessionMod.drainHostStateBroadcastProbeForTests() >= 1)
        assert.ok(
          harness.sets.some((s) => s.path.endsWith('/state')),
          'host reset should write sequenced hub state',
        )

        sessionMod.teardownSession()
      })
    } finally {
      mock.reset()
    }
  },
)
