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
