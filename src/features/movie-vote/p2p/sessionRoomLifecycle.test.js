/**
 * Movie Vote facade room exit survival contracts — unit level (no RTDB mocks).
 *
 * Run: node --test src/features/movie-vote/p2p/sessionRoomLifecycle.test.js
 *
 * RTDB wire paths and cross-feature survival contrast live in sessionFacadeRoomExit.test.js.
 */
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { HOST_PARTICIPANT_ID } from '../core.js'
import { DEFAULT_VOTING_METHOD } from '../votingMethod.js'
import { useMovieVoteStore } from '../../../stores/movieVote.js'
import { useMovieVoteRoomSessionStore } from '../../../stores/movieVoteRoomSession.js'
import {
  bindMovieVoteP2PHandlers,
  leaveSession,
  sessionPhase,
  sessionSuffix,
  teardownSession,
} from './session.js'

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

/**
 * @param {ReturnType<typeof useMovieVoteStore>} store
 */
function seedCollaborationState(store) {
  store.phase = 'voting'
  store.readyToVote = true
  store.setMyParticipantId('guest-1')
  store.setParticipants([
    { id: HOST_PARTICIPANT_ID, ready: true, pickCount: 2 },
    { id: 'guest-1', ready: true, pickCount: 1 },
  ])
  store.setVotingMethod('borda')
  store.setVotingState(
    [ballotMovie('m-a'), ballotMovie('m-b')],
    ['m-a', 'm-b'],
    [HOST_PARTICIPANT_ID, 'guest-1'],
  )
  store.myRanking = ['m-a', 'm-b']
  store.myVoteSubmitted = true
  store.votesByParticipant = {
    [HOST_PARTICIPANT_ID]: ['m-a', 'm-b'],
    'guest-1': ['m-b', 'm-a'],
  }
  store.voteProgress = { submitted: 2, total: 2 }
  store.uniqueSuggestedMovieCount = 3
  store.phase = 'results'
  store.irvResult = {
    winnerId: 'm-a',
    tieWinnerIds: null,
    rounds: [{ activeIds: ['m-a', 'm-b'], ballotsWithVote: 2, eliminatedIds: [] }],
    votingMethod: 'borda',
  }
}

/**
 * @param {{
 *   phase: { value: string },
 *   suffix: { value: string | null },
 *   room: ReturnType<typeof useMovieVoteRoomSessionStore>,
 *   store: ReturnType<typeof useMovieVoteStore>,
 *   expectedDraftLocalIds?: string[],
 *   expectedFullscreen?: boolean,
 * }} ctx
 */
function assertMovieVoteRoomExitSurvival(ctx) {
  assert.equal(ctx.phase.value, 'idle', 'connection posture should be idle after room exit')
  assert.equal(ctx.suffix.value, null, 'session suffix should clear after room exit')
  assert.equal(ctx.room.role, null, 'persisted room role should clear after room exit')
  assert.equal(ctx.room.suffix, null, 'persisted room suffix should clear after room exit')
  assert.equal(ctx.store.phase, 'suggest', 'collaboration phase should reset to suggest')
  assert.equal(ctx.store.readyToVote, false, 'ready flag should clear after room exit')
  assert.equal(ctx.store.myParticipantId, null, 'participant seat should clear after room exit')
  assert.equal(ctx.store.participants.length, 0, 'participants should clear after room exit')
  assert.equal(ctx.store.ballotMovies.length, 0, 'ballot movies should clear after room exit')
  assert.equal(ctx.store.ballotOrderIds.length, 0, 'ballot order should clear after room exit')
  assert.equal(ctx.store.myVoteSubmitted, false, 'vote submission should clear after room exit')
  assert.equal(ctx.store.voterIds.length, 0, 'voter ids should clear after room exit')
  assert.equal(
    Object.keys(ctx.store.votesByParticipant).length,
    0,
    'votes by participant should clear after room exit',
  )
  assert.equal(ctx.store.myRanking.length, 0, 'personal ranking should clear after room exit')
  assert.equal(ctx.store.irvResult, null, 'election results should clear after room exit')
  assert.equal(ctx.store.voteProgress, null, 'vote progress should clear after room exit')
  assert.equal(
    ctx.store.uniqueSuggestedMovieCount,
    0,
    'suggested movie count should clear after room exit',
  )
  assert.equal(
    ctx.store.votingMethod,
    DEFAULT_VOTING_METHOD,
    'voting method should reset to default after room exit',
  )
  if (ctx.expectedDraftLocalIds) {
    assert.deepEqual(
      ctx.store.myDraftPicks.map((p) => p.localId),
      ctx.expectedDraftLocalIds,
      'personal draft picks should survive room exit',
    )
  }
  if (ctx.expectedFullscreen !== undefined) {
    assert.equal(
      ctx.store.fullscreenEnabled,
      ctx.expectedFullscreen,
      'fullscreen preference should survive room exit',
    )
  }
}

test('leaveSession clears collaboration but keeps personal drafts and fullscreen', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  const room = useMovieVoteRoomSessionStore()
  seedCollaborationState(store)
  store.addDraftPick(customPick('d1', 'Nomination One'))
  store.addDraftPick(customPick('d2', 'Nomination Two'))
  const draftLocalIds = store.myDraftPicks.map((p) => p.localId)
  store.setFullscreenEnabled(true)
  room.setGuest('MVROOM1')

  let teardownCalls = 0
  bindMovieVoteP2PHandlers({
    applyPublicPayload: (payload) => {
      store.applyPublicPayload(payload)
    },
    onWireTeardown: () => {
      teardownCalls += 1
    },
  })

  leaveSession()

  assert.equal(teardownCalls, 1, 'room exit should invoke onWireTeardown handler')
  assertMovieVoteRoomExitSurvival({
    phase: sessionPhase,
    suffix: sessionSuffix,
    room,
    store,
    expectedDraftLocalIds: draftLocalIds,
    expectedFullscreen: true,
  })
})

test('leaveSession as host clears room persistence and collaboration state', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  const room = useMovieVoteRoomSessionStore()
  seedCollaborationState(store)
  store.addDraftPick(customPick('h1', 'Host pick'))
  const draftLocalIds = store.myDraftPicks.map((p) => p.localId)
  room.setHost('HOST01')

  let teardownCalls = 0
  bindMovieVoteP2PHandlers({
    applyPublicPayload: (payload) => {
      store.applyPublicPayload(payload)
    },
    onWireTeardown: () => {
      teardownCalls += 1
    },
  })

  leaveSession()

  assert.equal(teardownCalls, 1, 'room exit should invoke onWireTeardown handler')
  assertMovieVoteRoomExitSurvival({
    phase: sessionPhase,
    suffix: sessionSuffix,
    room,
    store,
    expectedDraftLocalIds: draftLocalIds,
  })
})

afterEach(() => {
  teardownSession()
  bindMovieVoteP2PHandlers({
    applyPublicPayload: () => {},
    onWireTeardown: () => {},
  })
})
