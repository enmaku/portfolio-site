/**
 * Run: node --experimental-test-module-mocks --test src/features/movie-vote/movieVoteStore.submitVote.test.js
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { HOST_PARTICIPANT_ID } from './core.js'
import { useMovieVoteStore } from '../../stores/movieVote.js'

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

test('submitVote returns false without mutating when phase is not voting', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  store.phase = 'suggest'
  store.myRanking = ['a', 'b']

  assert.equal(store.submitVote(['a', 'b']), false)
  assert.equal(store.myVoteSubmitted, false)
})

test('submitVote returns false when already submitted', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  store.setMyParticipantId(HOST_PARTICIPANT_ID)
  store.setVotingState([ballotMovie('a'), ballotMovie('b')], ['a', 'b'], [HOST_PARTICIPANT_ID])
  store.myVoteSubmitted = true

  assert.equal(store.submitVote(['a', 'b']), false)
  assert.deepEqual(store.votesByParticipant, {})
})

test('submitVote returns false for invalid ranking', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  store.setMyParticipantId(HOST_PARTICIPANT_ID)
  store.setVotingState([ballotMovie('a'), ballotMovie('b')], ['a', 'b'], [HOST_PARTICIPANT_ID])

  assert.equal(store.submitVote(['a']), false)
  assert.equal(store.submitVote(['a', 'a']), false)
  assert.equal(store.myVoteSubmitted, false)
})

test('submitVote host path records vote and locks ballot', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  store.setMyParticipantId(HOST_PARTICIPANT_ID)
  store.setVotingState([ballotMovie('a'), ballotMovie('b')], ['a', 'b'], [HOST_PARTICIPANT_ID])

  assert.equal(store.submitVote(['b', 'a']), true)
  assert.equal(store.myVoteSubmitted, true)
  assert.deepEqual(store.votesByParticipant[HOST_PARTICIPANT_ID], ['b', 'a'])
  assert.deepEqual(store.myRanking, ['b', 'a'])
  assert.deepEqual(store.voteProgress, { submitted: 1, total: 1 })
})

test('submitVote guest path locks ballot without merging vote locally', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  store.setMyParticipantId('guest-1')
  store.setVotingState(
    [ballotMovie('a'), ballotMovie('b')],
    ['a', 'b'],
    [HOST_PARTICIPANT_ID, 'guest-1'],
  )

  assert.equal(store.submitVote(['b', 'a']), true)
  assert.equal(store.myVoteSubmitted, true)
  assert.deepEqual(store.votesByParticipant, {})
})

test('setMyRanking does not change ranking after submit', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  store.setMyParticipantId('guest-1')
  store.setVotingState([ballotMovie('a'), ballotMovie('b')], ['a', 'b'], [HOST_PARTICIPANT_ID, 'guest-1'])
  store.submitVote(['b', 'a'])

  store.setMyRanking(['a', 'b'])
  assert.deepEqual(store.myRanking, ['b', 'a'])
})
