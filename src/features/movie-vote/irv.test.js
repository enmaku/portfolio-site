/**
 * Run: node --test src/features/movie-vote/irv.test.js
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { currentVoteForBallot, runIrv } from './irv.js'

test('currentVoteForBallot skips eliminated', () => {
  const active = new Set(['a', 'c'])
  assert.equal(currentVoteForBallot(['a', 'b', 'c'], active), 'a')
  assert.equal(currentVoteForBallot(['b', 'c', 'a'], active), 'c')
})

test('majority wins round 1', () => {
  const ids = ['x', 'y', 'z']
  const rankings = [
    ['x', 'y', 'z'],
    ['x', 'z', 'y'],
    ['x', 'y', 'z'],
  ]
  const r = runIrv(rankings, ids)
  assert.equal(r.winnerId, 'x')
  assert.equal(r.rounds.length, 1)
})

test('eliminate last place then majority', () => {
  const ids = ['a', 'b', 'c']
  const rankings = [
    ['a', 'b', 'c'],
    ['a', 'b', 'c'],
    ['b', 'a', 'c'],
    ['c', 'b', 'a'],
  ]
  const r = runIrv(rankings, ids)
  assert.equal(r.winnerId, 'a')
  assert.ok(r.rounds.length >= 2)
  assert.ok(r.rounds[0].eliminatedIds.includes('c'))
})

test('two-way tie all bottom eliminates co-winners', () => {
  const ids = ['a', 'b']
  const rankings = [
    ['a', 'b'],
    ['b', 'a'],
  ]
  const r = runIrv(rankings, ids)
  assert.equal(r.winnerId, null)
  assert.ok(r.tieWinnerIds && r.tieWinnerIds.length === 2)
})
