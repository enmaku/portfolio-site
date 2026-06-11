import assert from 'node:assert/strict'
import test from 'node:test'
import { isRankingForBallot } from './core.js'

test('isRankingForBallot rejects partial permutations', () => {
  assert.equal(isRankingForBallot(['a'], ['a', 'b']), false)
  assert.equal(isRankingForBallot(['a', 'a'], ['a', 'b']), false)
  assert.equal(isRankingForBallot(['a', 'c'], ['a', 'b']), false)
})

test('isRankingForBallot accepts full permutation', () => {
  assert.equal(isRankingForBallot(['b', 'a'], ['a', 'b']), true)
})
