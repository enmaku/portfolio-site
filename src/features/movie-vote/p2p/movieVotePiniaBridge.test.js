/**
 * Run: node --experimental-test-module-mocks --test src/features/movie-vote/p2p/movieVotePiniaBridge.test.js
 *
 * ## Fake-handler / probe pattern (#118 PRD)
 *
 * Production wires the `movieVote` store through `movieVoteP2PPlugin`, which registers
 * `bindMovieVoteP2PHandlers` once and routes store `$onAction` hooks to the session
 * outbound sync object (`hostLocalChanged`, `hostResetToSuggest`, `guestPushDraft`, …).
 *
 * Tests avoid RTDB/Firebase by:
 * - **Fake handlers** — `bindMovieVoteP2PHandlers({ applyPublicPayload, onWireTeardown })` with
 *   in-memory apply/teardown stubs (same contract as the plugin).
 * - **Probes** — module-level counters/queues in `movieVotePiniaBridge.js` and `session.js`
 *   (`drainMovieVote*ProbeForTests`, `drainHostStateBroadcastProbeForTests`) recording which
 *   wire methods ran without asserting UI copy.
 * - **Suppressors** — `suppressGuestDraftPushForTests` skips real inbox writes while still
 *   counting debounced push scheduling.
 * - **Inbound helper** — `applyInboundMovieVotePayloadForTests` applies remote payloads with
 *   `applyingRemote` set so outbound echo probes stay empty.
 *
 * RTDB host-reset integration (guest-ready map + state broadcast) lives in
 * `movieVotePiniaBridge.hostReset.test.js` with dynamic session load after `mock.module`.
 */
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { HOST_PARTICIPANT_ID } from '../core.js'
import { applyHostStoreFromRtdbHydrate } from '../hostRtdbHydrate.js'
import { useMovieVoteStore } from '../../../stores/movieVote.js'
import {
  applyInboundMovieVotePayloadForTests,
  drainGuestDraftPushProbeForTests,
  drainMovieVoteHostAfterSubmitProbeForTests,
  drainMovieVoteHostResetToSuggestProbeForTests,
  drainMovieVoteHostSuggestProbeForTests,
  drainMovieVoteP2PSyncProbeForTests,
  movieVoteP2PPlugin,
  resetMovieVoteGuestDraftDebounceForTests,
  resetMovieVoteHostAfterSubmitProbeForTests,
  resetMovieVoteHostResetToSuggestProbeForTests,
  resetMovieVoteHostSuggestProbeForTests,
  resetMovieVoteP2PSyncProbeForTests,
  suppressGuestDraftPushForTests,
} from './movieVotePiniaBridge.js'
import { buildMovieVotePublicPayload } from '../publicPayload.js'
import { bindMovieVoteP2PHandlers, leaveSession, sessionPhase } from './session.js'

function installMovieVotePinia() {
  const pinia = createPinia()
  pinia.use(movieVoteP2PPlugin)
  const app = createApp({ render: () => null })
  app.use(pinia)
  setActivePinia(pinia)
  return useMovieVoteStore()
}

/** @returns {import('../types.js').MovieVotePublicPayload} */
function suggestPhasePayload(overrides = {}) {
  return {
    phase: 'suggest',
    participants: [{ id: HOST_PARTICIPANT_ID, ready: false, pickCount: 0 }],
    ballotMovies: null,
    ballotOrderIds: null,
    voteProgress: null,
    irvResult: null,
    uniqueSuggestedMovieCount: 0,
    votingMethod: 'irv',
    ...overrides,
  }
}

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

test('guest inbound state applies phase ballot and ready via bridge', () => {
  resetMovieVoteP2PSyncProbeForTests()
  const store = installMovieVotePinia()
  store.setMyParticipantId('guest-1')

  sessionPhase.value = 'guest_connected'

  const payload = {
    phase: 'voting',
    participants: [
      { id: HOST_PARTICIPANT_ID, ready: true, pickCount: 2 },
      { id: 'guest-1', ready: true, pickCount: 1 },
    ],
    ballotMovies: [
      {
        publicId: 'm-a',
        source: 'custom',
        tmdbId: null,
        customKey: 'alpha',
        title: 'Alpha',
        posterPath: null,
        overview: '',
      },
      {
        publicId: 'm-b',
        source: 'custom',
        tmdbId: null,
        customKey: 'beta',
        title: 'Beta',
        posterPath: null,
        overview: '',
      },
    ],
    ballotOrderIds: ['m-a', 'm-b'],
    voteProgress: { submitted: 0, total: 2 },
    irvResult: null,
    uniqueSuggestedMovieCount: 0,
    votingMethod: 'irv',
  }

  applyInboundMovieVotePayloadForTests(payload)

  assert.equal(store.phase, 'voting')
  assert.equal(store.readyToVote, true)
  assert.deepEqual(store.ballotOrderIds, ['m-a', 'm-b'])
  assert.equal(store.ballotMovies.length, 2)
  assert.deepEqual(drainMovieVoteP2PSyncProbeForTests(), [])
})

test('host RTDB hydrate applies public payload through bound handlers', () => {
  resetMovieVoteP2PSyncProbeForTests()
  const store = installMovieVotePinia()
  store.setMyParticipantId(HOST_PARTICIPANT_ID)

  const payload = suggestPhasePayload({
    participants: [{ id: HOST_PARTICIPANT_ID, ready: true, pickCount: 1 }],
    uniqueSuggestedMovieCount: 3,
    votingMethod: 'borda',
  })

  applyHostStoreFromRtdbHydrate(
    { payload },
    {
      applyPublicPayload: (p) => applyInboundMovieVotePayloadForTests(p),
      votingMethod: store.votingMethod,
    },
  )

  assert.equal(store.readyToVote, true)
  assert.equal(store.uniqueSuggestedMovieCount, 3)
  assert.equal(store.votingMethod, 'borda')
  assert.deepEqual(drainMovieVoteP2PSyncProbeForTests(), [])
})

test('action hook records local sync actions when session active', () => {
  resetMovieVoteP2PSyncProbeForTests()
  const store = installMovieVotePinia()

  sessionPhase.value = 'hosting'
  store.addDraftPick(customPick('p1', 'One'))

  assert.deepEqual(drainMovieVoteP2PSyncProbeForTests(), ['addDraftPick'])
})

test('action hook ignores local actions when session idle', () => {
  resetMovieVoteP2PSyncProbeForTests()
  const store = installMovieVotePinia()

  sessionPhase.value = 'idle'
  store.addDraftPick(customPick('p1', 'One'))

  assert.deepEqual(drainMovieVoteP2PSyncProbeForTests(), [])
})

test('room exit invokes onWireTeardown handler', () => {
  installMovieVotePinia()

  let teardownCalls = 0
  bindMovieVoteP2PHandlers({
    onWireTeardown: () => {
      resetMovieVoteGuestDraftDebounceForTests()
      teardownCalls += 1
    },
  })

  leaveSession()

  assert.equal(teardownCalls, 1)
  bindMovieVoteP2PHandlers({
    onWireTeardown: () => {
      resetMovieVoteGuestDraftDebounceForTests()
    },
  })
})

test('guest draft edits debounce to one push after quiesce', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  resetMovieVoteGuestDraftDebounceForTests()
  resetMovieVoteP2PSyncProbeForTests()

  try {
    suppressGuestDraftPushForTests(true)
    const store = installMovieVotePinia()
    sessionPhase.value = 'guest_connected'
    store.setMyParticipantId('guest-1')
    assert.equal(drainGuestDraftPushProbeForTests(), 1)

    store.addDraftPick(customPick('p1', 'One'))
    store.addDraftPick(customPick('p2', 'Two'))
    assert.equal(drainGuestDraftPushProbeForTests(), 0)

    mock.timers.tick(320)
    assert.equal(drainGuestDraftPushProbeForTests(), 1)
  } finally {
    resetMovieVoteGuestDraftDebounceForTests()
    mock.timers.reset()
  }
})

/** @param {string} publicId */
function ballotMovie(publicId) {
  return {
    publicId,
    source: /** @type {const} */ ('custom'),
    tmdbId: null,
    customKey: publicId,
    title: publicId,
    posterPath: null,
    overview: '',
  }
}

test('setMyParticipantId does not push draft when session idle', () => {
  resetMovieVoteGuestDraftDebounceForTests()
  suppressGuestDraftPushForTests(true)
  const store = installMovieVotePinia()
  sessionPhase.value = 'idle'
  store.setMyParticipantId('guest-1')
  assert.equal(drainGuestDraftPushProbeForTests(), 0)
  resetMovieVoteGuestDraftDebounceForTests()
})

test('pending guest draft debounce cancelled on voting phase without flush', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  resetMovieVoteGuestDraftDebounceForTests()

  try {
    suppressGuestDraftPushForTests(true)
    const store = installMovieVotePinia()
    sessionPhase.value = 'guest_connected'
    store.setMyParticipantId('guest-1')
    drainGuestDraftPushProbeForTests()

    store.addDraftPick(customPick('p1', 'One'))
    assert.equal(drainGuestDraftPushProbeForTests(), 0)

    store.setVotingState(
      [ballotMovie('a'), ballotMovie('b')],
      ['a', 'b'],
      [HOST_PARTICIPANT_ID, 'guest-1'],
    )

    mock.timers.tick(320)
    assert.equal(drainGuestDraftPushProbeForTests(), 0)
  } finally {
    resetMovieVoteGuestDraftDebounceForTests()
    mock.timers.reset()
  }
})

test('pending guest draft debounce cancelled on room exit without flush', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  resetMovieVoteGuestDraftDebounceForTests()

  try {
    suppressGuestDraftPushForTests(true)
    const store = installMovieVotePinia()
    sessionPhase.value = 'guest_connected'
    store.setMyParticipantId('guest-1')
    drainGuestDraftPushProbeForTests()

    store.addDraftPick(customPick('p1', 'One'))
    assert.equal(drainGuestDraftPushProbeForTests(), 0)

    leaveSession()

    mock.timers.tick(320)
    assert.equal(drainGuestDraftPushProbeForTests(), 0)
  } finally {
    resetMovieVoteGuestDraftDebounceForTests()
    mock.timers.reset()
  }
})

test('pending guest draft debounce cancelled on submitVote without flush', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  resetMovieVoteGuestDraftDebounceForTests()

  try {
    suppressGuestDraftPushForTests(true)
    const store = installMovieVotePinia()
    sessionPhase.value = 'guest_connected'
    store.setMyParticipantId('guest-1')
    drainGuestDraftPushProbeForTests()

    store.addDraftPick(customPick('p1', 'One'))
    assert.equal(drainGuestDraftPushProbeForTests(), 0)

    store.setVotingState(
      [ballotMovie('a'), ballotMovie('b')],
      ['a', 'b'],
      [HOST_PARTICIPANT_ID, 'guest-1'],
    )
    assert.equal(store.submitVote(['b', 'a']), true)

    mock.timers.tick(320)
    assert.equal(drainGuestDraftPushProbeForTests(), 0)
  } finally {
    resetMovieVoteGuestDraftDebounceForTests()
    mock.timers.reset()
  }
})

test('host setVotingMethod records sync and voting method in broadcast payload', () => {
  resetMovieVoteP2PSyncProbeForTests()
  resetMovieVoteHostSuggestProbeForTests()
  const store = installMovieVotePinia()
  sessionPhase.value = 'hosting'
  store.setVotingMethod('borda')
  assert.equal(store.votingMethod, 'borda')
  const payload = buildMovieVotePublicPayload(store, new Map())
  assert.equal(payload.votingMethod, 'borda')
  assert.deepEqual(drainMovieVoteP2PSyncProbeForTests(), ['setVotingMethod'])
  assert.deepEqual(drainMovieVoteHostSuggestProbeForTests(), ['votingMethodChanged'])
})

test('host suggest draft action wires localChanged not votingMethodChanged', () => {
  resetMovieVoteP2PSyncProbeForTests()
  resetMovieVoteHostSuggestProbeForTests()
  const store = installMovieVotePinia()
  sessionPhase.value = 'hosting'
  store.addDraftPick(customPick('p1', 'One'))
  assert.deepEqual(drainMovieVoteHostSuggestProbeForTests(), ['localChanged'])
})

test('host setVotingMethod in voting phase does not wire outbound sync', () => {
  resetMovieVoteP2PSyncProbeForTests()
  resetMovieVoteHostSuggestProbeForTests()
  const store = installMovieVotePinia()
  sessionPhase.value = 'hosting'
  store.setVotingMethod('borda')
  store.phase = 'voting'
  resetMovieVoteP2PSyncProbeForTests()
  resetMovieVoteHostSuggestProbeForTests()
  store.setVotingMethod('condorcet')
  assert.equal(store.votingMethod, 'borda')
  assert.deepEqual(drainMovieVoteP2PSyncProbeForTests(), [])
  assert.deepEqual(drainMovieVoteHostSuggestProbeForTests(), [])
})

test('inbound applyPublicPayload does not emit sync probe when session active', () => {
  resetMovieVoteP2PSyncProbeForTests()
  const store = installMovieVotePinia()
  sessionPhase.value = 'hosting'
  store.setMyParticipantId(HOST_PARTICIPANT_ID)

  applyInboundMovieVotePayloadForTests(
    suggestPhasePayload({
      participants: [{ id: HOST_PARTICIPANT_ID, ready: true, pickCount: 2 }],
      uniqueSuggestedMovieCount: 2,
    }),
  )

  assert.deepEqual(drainMovieVoteP2PSyncProbeForTests(), [])
})

test('host resetToSuggest wires reset broadcast when P2P session active', () => {
  resetMovieVoteHostResetToSuggestProbeForTests()
  const store = installMovieVotePinia()
  sessionPhase.value = 'hosting'
  store.phase = 'results'
  store.resetToSuggest()
  assert.deepEqual(drainMovieVoteHostResetToSuggestProbeForTests(), ['resetToSuggest'])
})

test('host resetToSuggest does not wire when session idle', () => {
  resetMovieVoteHostResetToSuggestProbeForTests()
  const store = installMovieVotePinia()
  sessionPhase.value = 'idle'
  store.resetToSuggest()
  assert.deepEqual(drainMovieVoteHostResetToSuggestProbeForTests(), [])
})

test('host setParticipants in suggest records probe without suggest wire', () => {
  resetMovieVoteP2PSyncProbeForTests()
  resetMovieVoteHostSuggestProbeForTests()
  const store = installMovieVotePinia()
  sessionPhase.value = 'hosting'
  store.setParticipants([{ id: HOST_PARTICIPANT_ID, ready: false, pickCount: 0 }])
  assert.deepEqual(drainMovieVoteP2PSyncProbeForTests(), ['setParticipants'])
  assert.deepEqual(drainMovieVoteHostSuggestProbeForTests(), [])
})

const HOST_SUGGEST_WIRE_ACTIONS = [
  ['addDraftPick', (s) => s.addDraftPick(customPick('w1', 'Wire'))],
  ['removeDraftPick', (s) => s.removeDraftPick('setup')],
  ['clearAllDraftPicks', (s) => s.clearAllDraftPicks()],
  ['reorderDraftPicks', (s) => s.reorderDraftPicks(s.myDraftPicks.map((p) => ({ ...p })))],
  ['setReadyToVote', (s) => s.setReadyToVote(true)],
]

for (const [name, run] of HOST_SUGGEST_WIRE_ACTIONS) {
  test(`host ${name} in suggest wires localChanged`, () => {
    const store = installMovieVotePinia()
    sessionPhase.value = 'hosting'
    if (name !== 'addDraftPick') {
      store.addDraftPick(customPick('setup', 'Setup'))
      resetMovieVoteHostSuggestProbeForTests()
    } else {
      resetMovieVoteHostSuggestProbeForTests()
    }
    run(store)
    assert.deepEqual(drainMovieVoteHostSuggestProbeForTests(), ['localChanged'])
  })
}

test('host suggest wire actions do not fire in voting phase', () => {
  resetMovieVoteHostSuggestProbeForTests()
  const store = installMovieVotePinia()
  sessionPhase.value = 'hosting'
  store.phase = 'voting'
  store.addDraftPick(customPick('p1', 'One'))
  assert.deepEqual(drainMovieVoteHostSuggestProbeForTests(), [])
})

test('setMyRanking does not outbound-sync when hosting session active', () => {
  resetMovieVoteP2PSyncProbeForTests()
  resetMovieVoteHostSuggestProbeForTests()
  const store = installMovieVotePinia()
  store.setMyParticipantId(HOST_PARTICIPANT_ID)
  store.setVotingState(
    [ballotMovie('a'), ballotMovie('b')],
    ['a', 'b'],
    [HOST_PARTICIPANT_ID],
  )
  sessionPhase.value = 'hosting'
  resetMovieVoteP2PSyncProbeForTests()
  resetMovieVoteHostSuggestProbeForTests()

  store.setMyRanking(['b', 'a'])

  assert.deepEqual(drainMovieVoteP2PSyncProbeForTests(), [])
  assert.deepEqual(drainMovieVoteHostSuggestProbeForTests(), [])
})

test('setMyRanking does not outbound-sync when guest session active', () => {
  resetMovieVoteP2PSyncProbeForTests()
  const store = installMovieVotePinia()
  store.setMyParticipantId('guest-1')
  store.setVotingState(
    [ballotMovie('a'), ballotMovie('b')],
    ['a', 'b'],
    [HOST_PARTICIPANT_ID, 'guest-1'],
  )
  sessionPhase.value = 'guest_connected'
  resetMovieVoteP2PSyncProbeForTests()

  store.setMyRanking(['b', 'a'])

  assert.deepEqual(drainMovieVoteP2PSyncProbeForTests(), [])
})

test('setUniqueSuggestedMovieCount does not host-suggest wire when session active', () => {
  resetMovieVoteP2PSyncProbeForTests()
  resetMovieVoteHostSuggestProbeForTests()
  const store = installMovieVotePinia()
  sessionPhase.value = 'hosting'
  store.setUniqueSuggestedMovieCount(4)
  assert.deepEqual(drainMovieVoteHostSuggestProbeForTests(), [])
})

test('mergeGuestVote does not host-suggest wire when session active', () => {
  resetMovieVoteHostSuggestProbeForTests()
  resetMovieVoteHostAfterSubmitProbeForTests()
  const store = installMovieVotePinia()
  store.setMyParticipantId(HOST_PARTICIPANT_ID)
  store.setVotingState(
    [ballotMovie('a'), ballotMovie('b')],
    ['a', 'b'],
    [HOST_PARTICIPANT_ID, 'guest-1'],
  )
  sessionPhase.value = 'hosting'
  store.mergeGuestVote('guest-1', ['b', 'a'])
  assert.deepEqual(drainMovieVoteHostSuggestProbeForTests(), [])
  assert.deepEqual(drainMovieVoteHostAfterSubmitProbeForTests(), [])
})

test('setResults does not host-suggest wire when session active', () => {
  resetMovieVoteHostSuggestProbeForTests()
  const store = installMovieVotePinia()
  store.setMyParticipantId(HOST_PARTICIPANT_ID)
  store.setVotingState([ballotMovie('a'), ballotMovie('b')], ['a', 'b'], [HOST_PARTICIPANT_ID])
  sessionPhase.value = 'hosting'
  store.setResults({
    winnerId: 'a',
    rounds: [],
    declaredTie: false,
  })
  assert.deepEqual(drainMovieVoteHostSuggestProbeForTests(), [])
})

test('resetSessionSoft does not host-suggest wire when session active', () => {
  resetMovieVoteP2PSyncProbeForTests()
  resetMovieVoteHostSuggestProbeForTests()
  const store = installMovieVotePinia()
  sessionPhase.value = 'hosting'
  store.resetSessionSoft()
  assert.deepEqual(drainMovieVoteHostSuggestProbeForTests(), [])
})
