import assert from 'node:assert/strict'
import test from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { useMovieVoteStore } from '../../stores/movieVote.js'

test('applyPublicPayload: returning to suggest from results clears ready', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  store.phase = 'results'
  store.readyToVote = true
  store.setMyParticipantId('guest-1')

  store.applyPublicPayload({
    phase: 'suggest',
    participants: [{ id: 'guest-1', ready: false, pickCount: 2 }],
    ballotMovies: null,
    ballotOrderIds: null,
    voteProgress: null,
    electionOutcome: null,
    uniqueSuggestedMovieCount: 2,
    votingMethod: 'irv',
  })

  assert.equal(store.readyToVote, false)
})

test('applyPublicPayload: legacy irvResult inbound populates electionOutcome', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  const legacyOutcome = {
    votingMethod: 'irv',
    winnerId: 'movie-a',
    tieWinnerIds: null,
    rounds: [],
  }

  store.applyPublicPayload({
    phase: 'results',
    participants: [],
    ballotMovies: [],
    ballotOrderIds: [],
    voteProgress: null,
    irvResult: legacyOutcome,
    uniqueSuggestedMovieCount: 0,
    votingMethod: 'irv',
  })

  assert.deepEqual(store.electionOutcome, legacyOutcome)
})

test('applyPublicPayload: suggest refresh without leaving suggest keeps ready from row', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  store.phase = 'suggest'
  store.readyToVote = true
  store.setMyParticipantId('guest-1')

  store.applyPublicPayload({
    phase: 'suggest',
    participants: [{ id: 'guest-1', ready: true, pickCount: 1 }],
    ballotMovies: null,
    ballotOrderIds: null,
    voteProgress: null,
    electionOutcome: null,
    uniqueSuggestedMovieCount: 2,
    votingMethod: 'irv',
  })

  assert.equal(store.readyToVote, true)
})
