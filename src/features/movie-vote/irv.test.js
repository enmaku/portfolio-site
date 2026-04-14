/**
 * Run: node --test src/features/movie-vote/irv.test.js
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { currentVoteForBallot, pickSingleElimination, runIrv } from './irv.js'

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

test('two-way first-round tie: one elimination per round (ballot-order tie-break)', () => {
  const ids = ['a', 'b']
  const rankings = [
    ['a', 'b'],
    ['b', 'a'],
  ]
  const r = runIrv(rankings, ids)
  /* Both at min; later on ballot list ('b') is eliminated first → 'a' wins with both votes. */
  assert.equal(r.winnerId, 'a')
  assert.equal(r.tieWinnerIds, null)
  assert.ok(r.rounds.length >= 2)
})

test('pickSingleElimination prefers later ballot index', () => {
  assert.equal(pickSingleElimination(['x', 'z'], ['x', 'y', 'z']), 'z')
})

test('ABCD vs DABC: preferences flow after successive eliminations', () => {
  const ids = ['A', 'B', 'C', 'D']
  const rankings = [
    ['A', 'B', 'C', 'D'],
    ['D', 'A', 'B', 'C'],
  ]
  const r = runIrv(rankings, ids)
  assert.equal(r.winnerId, 'A')
  assert.equal(r.tieWinnerIds, null)
  assert.ok(r.rounds.length >= 3)
})
