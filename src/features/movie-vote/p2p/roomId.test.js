import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMovieVoteRoomShareUrl } from './roomId.js'

test('buildMovieVoteRoomShareUrl emits canonical non-hash room link', () => {
  const originalWindow = globalThis.window
  globalThis.window = /** @type {Window} */ ({
    location: {
      href: 'https://focusdisorder.com/#/projects/movie-vote',
    },
  })

  try {
    const url = buildMovieVoteRoomShareUrl('ZX90PQ')
    assert.equal(url, 'https://focusdisorder.com/projects/movie-vote?room=ZX90PQ')
  } finally {
    globalThis.window = originalWindow
  }
})
