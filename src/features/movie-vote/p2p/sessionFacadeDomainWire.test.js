/**
 * Run: node --test src/features/movie-vote/p2p/sessionFacadeDomainWire.test.js
 *
 * Guest inbound monotonic authority broadcast on sequenced state — domain wire only
 * (not connection posture; see posture contract tests separately).
 */
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { HOST_PARTICIPANT_ID } from '../core.js'
import { useMovieVoteStore } from '../../../stores/movieVote.js'
import { encodeState, encodeWelcome, MSG_MV_STATE } from './protocol.js'
import {
  bindMovieVoteP2PHandlers,
  handleGuestInboundState,
  handleGuestWelcomeInbound,
  resetMovieVoteFacadeWireStateForTests,
  sessionPhase,
  sessionSuffix,
  teardownSession,
} from './session.js'

/** @returns {import('../types.js').BallotMovie} */
function ballotMovie(publicId, title) {
  return {
    publicId,
    source: 'custom',
    tmdbId: null,
    customKey: title.toLowerCase(),
    title,
    posterPath: null,
    overview: '',
  }
}

/** @returns {import('../types.js').MovieVotePublicPayload} */
function suggestPayload(overrides = {}) {
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

/**
 * @param {string[]} ballotOrderIds
 * @param {Partial<import('../types.js').MovieVotePublicPayload>} [overrides]
 * @returns {import('../types.js').MovieVotePublicPayload}
 */
function votingPayload(ballotOrderIds, overrides = {}) {
  const movies = ballotOrderIds.map((id) =>
    ballotMovie(id, id === 'm_a' ? 'Alpha' : id === 'm_b' ? 'Beta' : id),
  )
  return {
    phase: 'voting',
    participants: [
      { id: HOST_PARTICIPANT_ID, ready: true, pickCount: 1 },
      { id: 'guest-seat-1', ready: true, pickCount: 1 },
    ],
    ballotMovies: movies,
    ballotOrderIds: [...ballotOrderIds],
    voteProgress: { submitted: 0, total: 2 },
    irvResult: null,
    uniqueSuggestedMovieCount: 0,
    votingMethod: 'irv',
    ...overrides,
  }
}

function bindFakeMirrorHandlers() {
  /** @type {import('../types.js').MovieVotePublicPayload | null} */
  let mirror = null
  let applyCount = 0

  const outbound = bindMovieVoteP2PHandlers({
    applyPublicPayload: (payload) => {
      applyCount += 1
      mirror = structuredClone(payload)
    },
    onWireTeardown: () => {},
  })

  return {
    get mirror() {
      return mirror
    },
    get applyCount() {
      return applyCount
    },
    outbound,
    /** Simulates local mirror drift without host authority (e.g. reconnect fork). */
    setLocalFork(payload) {
      mirror = structuredClone(payload)
    },
  }
}

test('guest inbound state applies only when seq strictly increases', () => {
  const wire = bindFakeMirrorHandlers()
  const suggestA = suggestPayload({ uniqueSuggestedMovieCount: 1 })
  const suggestB = suggestPayload({ uniqueSuggestedMovieCount: 2 })

  handleGuestInboundState(encodeState(suggestA, 1))
  assert.equal(wire.applyCount, 1)
  assert.equal(wire.mirror?.phase, 'suggest')
  assert.equal(wire.mirror?.uniqueSuggestedMovieCount, 1)

  handleGuestInboundState(encodeState(suggestB, 1))
  assert.equal(wire.applyCount, 1, 'equal seq must not re-apply')
  assert.equal(wire.mirror?.uniqueSuggestedMovieCount, 1)

  handleGuestInboundState(encodeState(votingPayload(['m_a', 'm_b']), 2))
  assert.equal(wire.applyCount, 2)
  assert.equal(wire.mirror?.phase, 'voting')
  assert.deepEqual(wire.mirror?.ballotOrderIds, ['m_a', 'm_b'])
})

test('guest inbound state ignores regressive seq without changing mirror', () => {
  const wire = bindFakeMirrorHandlers()
  const authoritative = votingPayload(['m_a', 'm_b'])

  handleGuestInboundState(encodeState(authoritative, 5))
  assert.equal(wire.applyCount, 1)

  wire.setLocalFork(votingPayload(['m_b', 'm_a']))

  handleGuestInboundState(encodeState(votingPayload(['m_x', 'm_y']), 3))
  assert.equal(wire.applyCount, 1, 'regressive seq is a no-op on applyPublicPayload')
  assert.equal(wire.mirror?.phase, 'voting', 'regressive seq must not rewind phase')
  assert.deepEqual(wire.mirror?.ballotOrderIds, ['m_b', 'm_a'])

  handleGuestInboundState(encodeState(suggestPayload({ uniqueSuggestedMovieCount: 99 }), 4))
  assert.equal(wire.applyCount, 1, 'regressive suggest broadcast must not rewind voting phase')
  assert.equal(wire.mirror?.phase, 'voting')

  handleGuestInboundState(encodeState(authoritative, 5))
  assert.equal(wire.applyCount, 1, 'duplicate max seq is still ignored')
  assert.deepEqual(wire.mirror?.ballotOrderIds, ['m_b', 'm_a'])
})

test('guest inbound state ignores invalid and malformed wire shapes', () => {
  const wire = bindFakeMirrorHandlers()
  const valid = encodeState(suggestPayload(), 1)

  handleGuestInboundState(valid)
  assert.equal(wire.applyCount, 1)

  const malformed = [
    null,
    'not-an-object',
    {},
    { type: MSG_MV_STATE, seq: 0, payload: suggestPayload() },
    { type: MSG_MV_STATE, seq: 1 },
    { type: MSG_MV_STATE, seq: 1, payload: { phase: 'bad', participants: [] } },
    { type: 'mv-wrong', seq: 2, payload: suggestPayload() },
  ]

  for (const raw of malformed) {
    handleGuestInboundState(raw)
  }

  assert.equal(wire.applyCount, 1, 'malformed host state must not touch mirror handlers')
  assert.equal(wire.mirror?.phase, 'suggest')
})

test('guest reconnect coherence: welcome + sequenced state reattaches seat without local ballot promotion', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  const wire = bindFakeMirrorHandlers()
  const beforeDisconnect = suggestPayload({
    uniqueSuggestedMovieCount: 2,
    participants: [
      { id: HOST_PARTICIPANT_ID, ready: true, pickCount: 2 },
      { id: 'guest-seat-1', ready: false, pickCount: 1 },
    ],
  })

  handleGuestInboundState(encodeState(beforeDisconnect, 1))
  assert.equal(wire.mirror?.phase, 'suggest')

  store.setMyParticipantId('guest-seat-1')
  store.readyToVote = true
  store.myDraftPicks = [
    {
      localId: 'local-draft',
      source: 'custom',
      tmdbId: null,
      customKey: 'local draft',
      title: 'Local draft',
      posterPath: null,
      overview: '',
    },
    {
      localId: 'local-draft-2',
      source: 'custom',
      tmdbId: null,
      customKey: 'extra local',
      title: 'Extra local',
      posterPath: null,
      overview: '',
    },
  ]
  wire.setLocalFork(votingPayload(['m_b', 'm_a']))
  store.phase = 'voting'
  store.ballotOrderIds = ['m_b', 'm_a']
  store.myRanking = ['m_b', 'm_a']

  handleGuestWelcomeInbound(encodeWelcome('guest-seat-1', true))
  assert.equal(store.myParticipantId, 'guest-seat-1')

  const afterReconnect = votingPayload(['m_a', 'm_b'], {
    voteProgress: { submitted: 1, total: 2 },
    participants: [
      { id: HOST_PARTICIPANT_ID, ready: true, pickCount: 2 },
      { id: 'guest-seat-1', ready: true, pickCount: 1 },
    ],
  })
  handleGuestInboundState(encodeState(afterReconnect, 2))

  assert.equal(wire.applyCount, 2)
  assert.equal(wire.mirror?.phase, 'voting')
  assert.deepEqual(wire.mirror?.ballotOrderIds, ['m_a', 'm_b'])
  assert.deepEqual(wire.mirror?.voteProgress, { submitted: 1, total: 2 })
  const guestRow = wire.mirror?.participants.find((p) => p.id === 'guest-seat-1')
  assert.equal(guestRow?.pickCount, 1, 'draft payload seat reattach comes from host payload row')
  assert.equal(guestRow?.ready, true)

  sessionSuffix.value = 'WIRE01'
  sessionPhase.value = 'guest_connected'
  wire.outbound.guestPushDraft()
  wire.outbound.guestSubmitVote(['m_b', 'm_a'])
  assert.equal(wire.applyCount, 2, 'post-reconnect outbound must not promote local ballot or draft')
  assert.deepEqual(wire.mirror?.ballotOrderIds, ['m_a', 'm_b'])
})

test('guest reconnect coherence: suggest-phase welcome + state reattaches draft payload row', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  const wire = bindFakeMirrorHandlers()

  handleGuestInboundState(
    encodeState(
      suggestPayload({
        uniqueSuggestedMovieCount: 1,
        participants: [
          { id: HOST_PARTICIPANT_ID, ready: false, pickCount: 1 },
          { id: 'guest-seat-1', ready: false, pickCount: 0 },
        ],
      }),
      1,
    ),
  )

  store.setMyParticipantId('guest-seat-1')
  store.readyToVote = true
  store.myDraftPicks = [
    {
      localId: 'local-only',
      source: 'custom',
      tmdbId: null,
      customKey: 'local only',
      title: 'Local only',
      posterPath: null,
      overview: '',
    },
  ]
  wire.setLocalFork(
    suggestPayload({
      uniqueSuggestedMovieCount: 99,
      participants: [{ id: HOST_PARTICIPANT_ID, ready: true, pickCount: 99 }],
    }),
  )

  handleGuestWelcomeInbound(encodeWelcome('guest-seat-1', true))
  assert.equal(store.myParticipantId, 'guest-seat-1')

  const hostTruth = suggestPayload({
    uniqueSuggestedMovieCount: 2,
    participants: [
      { id: HOST_PARTICIPANT_ID, ready: true, pickCount: 1 },
      { id: 'guest-seat-1', ready: false, pickCount: 1 },
    ],
  })
  handleGuestInboundState(encodeState(hostTruth, 2))

  assert.equal(wire.applyCount, 2)
  assert.equal(wire.mirror?.phase, 'suggest')
  assert.equal(wire.mirror?.uniqueSuggestedMovieCount, 2)
  const guestRow = wire.mirror?.participants.find((p) => p.id === 'guest-seat-1')
  assert.equal(guestRow?.pickCount, 1)
  assert.equal(guestRow?.ready, false)

  sessionSuffix.value = 'WIRE02'
  sessionPhase.value = 'guest_connected'
  wire.outbound.guestPushDraft()
  assert.equal(wire.applyCount, 2, 'post-reconnect draft push must not promote local mirror')
  assert.equal(wire.mirror?.uniqueSuggestedMovieCount, 2)
})

test('guest outbound draft and vote sync do not promote local state as mirror truth', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  const wire = bindFakeMirrorHandlers()
  const hostTruth = votingPayload(['m_a', 'm_b'])

  handleGuestInboundState(encodeState(hostTruth, 1))
  assert.equal(wire.applyCount, 1)

  sessionSuffix.value = 'WIRE01'
  sessionPhase.value = 'guest_connected'
  store.setMyParticipantId('guest-seat-1')
  store.phase = 'voting'
  store.ballotOrderIds = ['m_b', 'm_a']
  store.myDraftPicks = [
    {
      localId: 'local-1',
      source: 'custom',
      tmdbId: null,
      customKey: 'local pick',
      title: 'Local pick',
      posterPath: null,
      overview: '',
    },
  ]

  wire.outbound.guestPushDraft()
  wire.outbound.guestSubmitVote(['m_b', 'm_a'])

  assert.equal(wire.applyCount, 1, 'guest outbound sync must not call applyPublicPayload')
  assert.deepEqual(wire.mirror?.ballotOrderIds, ['m_a', 'm_b'])
  assert.equal(wire.mirror?.phase, 'voting')
})

afterEach(() => {
  teardownSession()
  resetMovieVoteFacadeWireStateForTests()
})
