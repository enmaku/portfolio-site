import assert from 'node:assert/strict'
import test from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { useMovieVoteStore } from '../../stores/movieVote.js'
import { DEFAULT_VOTING_METHOD } from './votingMethod.js'

test('new room defaults to instant-runoff voting', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  assert.equal(store.votingMethod, DEFAULT_VOTING_METHOD)
})

test('host can change voting method only during suggest phase', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  store.setVotingMethod('borda')
  assert.equal(store.votingMethod, 'borda')
  store.phase = 'voting'
  store.setVotingMethod('condorcet')
  assert.equal(store.votingMethod, 'borda')
})

test('applyPublicPayload syncs voting method from host broadcast', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  store.applyPublicPayload({
    phase: 'suggest',
    participants: [],
    ballotMovies: null,
    ballotOrderIds: null,
    voteProgress: null,
    votingMethod: 'condorcet',
  })
  assert.equal(store.votingMethod, 'condorcet')
})

test('applyPublicPayload defaults missing voting method to instant-runoff', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  store.setVotingMethod('borda')
  store.applyPublicPayload({
    phase: 'suggest',
    participants: [],
    ballotMovies: null,
    ballotOrderIds: null,
    voteProgress: null,
  })
  assert.equal(store.votingMethod, DEFAULT_VOTING_METHOD)
})

test('resetForRoomExit restores default voting method', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  store.setVotingMethod('condorcet')
  store.resetForRoomExit()
  assert.equal(store.votingMethod, DEFAULT_VOTING_METHOD)
})
