import assert from 'node:assert/strict'
import test from 'node:test'
import { getMovieVoteSessionTestWireAccess } from './session.testWireAccess.js'

test('roomAuthoritySeq tracks guest lastSeenSeq on monotonic apply', async () => {
  const sessionMod = await import('./session.js')
  const access = getMovieVoteSessionTestWireAccess(sessionMod.MOVIE_VOTE_SESSION_TEST_MODULE_KEY)

  access.setLastSeenSeq(3)
  assert.equal(access.getRoomAuthoritySeq(), 3)

  access.setLastSeenSeq(7)
  assert.equal(access.getRoomAuthoritySeq(), 7)
})

test('roomAuthoritySeq tracks host nextSeq on publish', async () => {
  const sessionMod = await import('./session.js')
  const access = getMovieVoteSessionTestWireAccess(sessionMod.MOVIE_VOTE_SESSION_TEST_MODULE_KEY)

  access.setNextSeq(5)
  sessionMod.roomAuthoritySeq.value = 5
  assert.equal(sessionMod.roomAuthoritySeq.value, 5)
})
