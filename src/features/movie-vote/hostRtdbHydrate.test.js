import assert from 'node:assert/strict'
import test from 'node:test'
import { applyHostStoreFromRtdbHydrate } from './hostRtdbHydrate.js'
import { DEFAULT_VOTING_METHOD } from './votingMethod.js'

test('applyHostStoreFromRtdbHydrate applies public payload when RTDB state exists', () => {
  /** @type {import('./types.js').MovieVotePublicPayload[]} */
  const applied = []
  const store = {
    applyPublicPayload: (p) => applied.push(p),
    votingMethod: 'irv',
  }
  const payload = {
    phase: 'suggest',
    participants: [],
    ballotMovies: null,
    ballotOrderIds: null,
    voteProgress: null,
    votingMethod: 'condorcet',
  }
  applyHostStoreFromRtdbHydrate({ payload }, store)
  assert.equal(applied.length, 1)
  assert.equal(applied[0].votingMethod, 'condorcet')
})

test('applyHostStoreFromRtdbHydrate defaults voting method for fresh room', () => {
  const store = {
    applyPublicPayload: () => assert.fail('should not apply payload'),
    votingMethod: 'borda',
  }
  applyHostStoreFromRtdbHydrate(null, store)
  assert.equal(store.votingMethod, DEFAULT_VOTING_METHOD)
})
