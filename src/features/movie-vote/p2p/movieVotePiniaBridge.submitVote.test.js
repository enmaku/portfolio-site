/**
 * Run: node --experimental-test-module-mocks --test src/features/movie-vote/p2p/movieVotePiniaBridge.submitVote.test.js
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { HOST_PARTICIPANT_ID } from '../core.js'
import { useMovieVoteStore } from '../../../stores/movieVote.js'
import {
  drainMovieVoteGuestVoteWireForTests,
  drainMovieVoteHostAfterSubmitProbeForTests,
  drainMovieVoteP2PSyncProbeForTests,
  movieVoteP2PPlugin,
  resetMovieVoteGuestVoteWireForTests,
  resetMovieVoteHostAfterSubmitProbeForTests,
  resetMovieVoteP2PSyncProbeForTests,
} from './movieVotePiniaBridge.js'
import { sessionPhase } from './session.js'

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

function installMovieVotePinia() {
  const pinia = createPinia()
  pinia.use(movieVoteP2PPlugin)
  const app = createApp({ render: () => null })
  app.use(pinia)
  setActivePinia(pinia)
  return useMovieVoteStore()
}

test('guest submitVote wires vote message when P2P session active', () => {
  resetMovieVoteGuestVoteWireForTests()
  const store = installMovieVotePinia()
  store.setMyParticipantId('guest-1')
  store.setVotingState(
    [ballotMovie('a'), ballotMovie('b')],
    ['a', 'b'],
    [HOST_PARTICIPANT_ID, 'guest-1'],
  )

  sessionPhase.value = 'guest_connected'
  assert.equal(store.submitVote(['b', 'a']), true)

  assert.deepEqual(drainMovieVoteGuestVoteWireForTests(), [
    { participantId: 'guest-1', ranking: ['b', 'a'] },
  ])
})

test('invalid submitVote does not wire when P2P session active', () => {
  resetMovieVoteGuestVoteWireForTests()
  const store = installMovieVotePinia()
  store.setMyParticipantId('guest-1')
  store.setVotingState(
    [ballotMovie('a'), ballotMovie('b')],
    ['a', 'b'],
    [HOST_PARTICIPANT_ID, 'guest-1'],
  )

  sessionPhase.value = 'guest_connected'
  assert.equal(store.submitVote(['a']), false)
  assert.equal(store.myVoteSubmitted, false)
  assert.deepEqual(drainMovieVoteGuestVoteWireForTests(), [])
})

test('guest submitVote does not wire when session idle', () => {
  resetMovieVoteGuestVoteWireForTests()
  const store = installMovieVotePinia()
  store.setMyParticipantId('guest-1')
  store.setVotingState(
    [ballotMovie('a'), ballotMovie('b')],
    ['a', 'b'],
    [HOST_PARTICIPANT_ID, 'guest-1'],
  )

  sessionPhase.value = 'idle'
  assert.equal(store.submitVote(['b', 'a']), true)
  assert.deepEqual(drainMovieVoteGuestVoteWireForTests(), [])
})

test('host submitVote triggers broadcast finish path when P2P session active', () => {
  resetMovieVoteHostAfterSubmitProbeForTests()
  const store = installMovieVotePinia()
  store.setMyParticipantId(HOST_PARTICIPANT_ID)
  store.setVotingState([ballotMovie('a'), ballotMovie('b')], ['a', 'b'], [HOST_PARTICIPANT_ID])

  sessionPhase.value = 'hosting'
  assert.equal(store.submitVote(['a', 'b']), true)

  assert.deepEqual(drainMovieVoteHostAfterSubmitProbeForTests(), ['afterVoteSubmit'])
})

test('setMyRanking does not emit P2P sync probe when session active', () => {
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
