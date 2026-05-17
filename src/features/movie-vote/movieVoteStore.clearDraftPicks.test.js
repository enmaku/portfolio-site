import assert from 'node:assert/strict'
import test from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { useMovieVoteStore } from '../../stores/movieVote.js'

test('clearAllDraftPicks removes every pick and clears ready', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  store.myDraftPicks = [
    {
      localId: 'a',
      source: 'custom',
      tmdbId: null,
      customKey: 'foo',
      title: 'Foo',
      posterPath: null,
      overview: '',
    },
    {
      localId: 'b',
      source: 'custom',
      tmdbId: null,
      customKey: 'bar',
      title: 'Bar',
      posterPath: null,
      overview: '',
    },
  ]
  store.readyToVote = true

  store.clearAllDraftPicks()

  assert.deepEqual(store.myDraftPicks, [])
  assert.equal(store.readyToVote, false)
})
