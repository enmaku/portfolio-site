import assert from 'node:assert/strict'
import test from 'node:test'

test('nextInsufficientMoviesNotice: null when not all ready', async () => {
  const { nextInsufficientMoviesNotice } = await import('./roomNotice.js')
  assert.equal(
    nextInsufficientMoviesNotice({ allReady: false, uniqueCount: 0, prevNotice: null }),
    null,
  )
})

test('nextInsufficientMoviesNotice: null when all ready but uniqueCount > 1', async () => {
  const { nextInsufficientMoviesNotice } = await import('./roomNotice.js')
  assert.equal(
    nextInsufficientMoviesNotice({ allReady: true, uniqueCount: 2, prevNotice: null }),
    null,
  )
})

test('nextInsufficientMoviesNotice: insufficient_movies when all ready and uniqueCount ≤ 1', async () => {
  const { nextInsufficientMoviesNotice } = await import('./roomNotice.js')
  assert.deepEqual(
    nextInsufficientMoviesNotice({ allReady: true, uniqueCount: 1, prevNotice: null }),
    { kind: 'insufficient_movies', id: 1 },
  )
  assert.deepEqual(
    nextInsufficientMoviesNotice({ allReady: true, uniqueCount: 0, prevNotice: null }),
    { kind: 'insufficient_movies', id: 1 },
  )
  assert.deepEqual(
    nextInsufficientMoviesNotice({
      allReady: true,
      uniqueCount: 1,
      prevNotice: { kind: 'insufficient_movies', id: 4 },
    }),
    { kind: 'insufficient_movies', id: 5 },
  )
})
