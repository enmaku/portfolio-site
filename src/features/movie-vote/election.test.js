/**
 * Run: node --test src/features/movie-vote/election.test.js
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { runBorda } from './borda.js'
import { runCondorcet } from './condorcet.js'
import { isDeclaredElectionTie, runElection } from './election.js'
import { runIrv } from './irv.js'

test('runElection dispatches IRV and echoes votingMethod', () => {
  const r = runElection('irv', [['a', 'b'], ['a', 'b']], ['a', 'b'])
  assert.equal(r.votingMethod, 'irv')
  assert.equal(r.winnerId, 'a')
  assert.equal(r.tieWinnerIds, null)
  assert.ok(r.rounds.length >= 1)
  assert.ok('firstPreferenceCounts' in r.rounds[0])
})

test('runElection normalizes unknown method string to IRV', () => {
  const r = runElection('ranked-points', [['x', 'y'], ['x', 'y']], ['x', 'y'])
  assert.equal(r.votingMethod, 'irv')
  assert.equal(r.winnerId, 'x')
})

test('runElection: borda dispatches and echoes votingMethod', () => {
  const r = runElection('borda', [['a', 'b'], ['b', 'a']], ['a', 'b'])
  assert.equal(r.votingMethod, 'borda')
  assert.equal(r.winnerId, null)
  assert.deepEqual(new Set(r.tieWinnerIds ?? []), new Set(['a', 'b']))
  assert.equal(r.rounds.length, 1)
  assert.equal(r.rounds[0].eliminatedIds.length, 0)
})

test('runElection: borda unique winner', () => {
  const r = runElection(
    'borda',
    [
      ['a', 'b'],
      ['a', 'b'],
    ],
    ['a', 'b'],
  )
  assert.equal(r.winnerId, 'a')
  assert.equal(r.tieWinnerIds, null)
  assert.equal(r.rounds[0].firstPreferenceCounts.a, 2)
})

test('runElection: condorcet dispatches with pairwise matrix', () => {
  const rankings = [
    ['a', 'b'],
    ['b', 'a'],
  ]
  const r = runElection('condorcet', rankings, ['a', 'b'])
  assert.equal(r.votingMethod, 'condorcet')
  assert.equal(r.winnerId, null)
  assert.deepEqual(new Set(r.tieWinnerIds ?? []), new Set(['a', 'b']))
  assert.equal(r.rounds.length, 0)
  assert.equal(r.pairwiseMatrix?.cells.a.b, 'tie')
})

test('runElection condorcet matches runCondorcet and adds votingMethod', () => {
  const rankings = [
    ['a', 'b', 'c'],
    ['b', 'c', 'a'],
    ['c', 'a', 'b'],
  ]
  const ids = ['a', 'b', 'c']
  const cond = runCondorcet(rankings, ids)
  const elect = runElection('condorcet', rankings, ids)
  assert.deepEqual(elect, { ...cond, votingMethod: 'condorcet' })
})

test('isDeclaredElectionTie matches tieWinnerIds shape', () => {
  assert.equal(isDeclaredElectionTie({ tieWinnerIds: ['a'], winnerId: null, rounds: [] }), true)
  assert.equal(isDeclaredElectionTie({ tieWinnerIds: null, winnerId: 'a', rounds: [] }), false)
})

test('runElection irv matches runIrv and adds votingMethod', () => {
  const rankings = [
    ['a', 'b', 'c', 'd'],
    ['a', 'b', 'c', 'd'],
    ['b', 'a', 'c', 'd'],
    ['c', 'a', 'b', 'd'],
    ['d', 'a', 'b', 'c'],
  ]
  const ids = ['a', 'b', 'c', 'd']
  const irv = runIrv(rankings, ids)
  const elect = runElection('irv', rankings, ids)
  assert.deepEqual(elect, { ...irv, votingMethod: 'irv' })
  assert.deepEqual(new Set(elect.rounds[0].eliminatedIds), new Set(['b', 'c', 'd']))
})

test('runElection borda matches runBorda and adds votingMethod', () => {
  const rankings = [
    ['a', 'b'],
    ['a', 'b'],
  ]
  const ids = ['a', 'b']
  const borda = runBorda(rankings, ids)
  const elect = runElection('borda', rankings, ids)
  assert.deepEqual(elect, { ...borda, votingMethod: 'borda' })
})

test('runElection irv: declared tie without algorithmic tiebreak', () => {
  const r = runElection(
    'irv',
    [
      ['a', 'b'],
      ['b', 'a'],
    ],
    ['a', 'b'],
  )
  assert.equal(r.winnerId, null)
  assert.deepEqual(new Set(r.tieWinnerIds ?? []), new Set(['a', 'b']))
  assert.equal(r.rounds.length, 1)
  assert.deepEqual(r.rounds[0].eliminatedIds, [])
})
