import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { useMovieVoteStore } from '../../stores/movieVote.js'

const movieVoteStoreSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../stores/movieVote.js'),
  'utf8',
)

function seedSessionState(store) {
  store.phase = 'voting'
  store.readyToVote = true
  store.setMyParticipantId('guest-1')
  store.setParticipants([{ id: 'guest-1', ready: true, pickCount: 2 }])
  store.ballotMovies = [{ id: 'm1', title: 'A', posterPath: null }]
  store.ballotOrderIds = ['m1']
  store.myRanking = ['m1']
  store.myVoteSubmitted = true
  store.voterIds = ['guest-1']
  store.votesByParticipant = { 'guest-1': ['m1'] }
  store.voteProgress = { submitted: 1, total: 1 }
  store.uniqueSuggestedMovieCount = 2
  store.setVotingMethod('borda')
}

test('resetForRoomExit keeps fullscreenEnabled preference', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  seedSessionState(store)
  store.setFullscreenEnabled(true)
  store.resetForRoomExit()
  assert.equal(store.fullscreenEnabled, true)
})

test('resetSessionSoft keeps fullscreenEnabled preference', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  seedSessionState(store)
  store.setFullscreenEnabled(true)
  store.resetSessionSoft()
  assert.equal(store.fullscreenEnabled, true)
})

test('resetToSuggest keeps fullscreenEnabled preference', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  seedSessionState(store)
  store.setFullscreenEnabled(true)
  store.resetToSuggest()
  assert.equal(store.fullscreenEnabled, true)
})

test('pinia persist pick includes fullscreenEnabled', () => {
  const pickBlock = movieVoteStoreSource.match(/pick:\s*\[([\s\S]*?)\],/)
  assert.ok(pickBlock, 'expected movie vote persist pick list')
  assert.match(pickBlock[1], /['"]fullscreenEnabled['"]/)
})
