/**
 * Run: node --test src/features/movie-vote/condorcet.test.js
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPairwiseMatrix,
  comparePairwisePreference,
  isDeclaredCondorcetTie,
  pairwiseBeats,
  runCondorcet,
  smithSetFromBeatpaths,
} from './condorcet.js'

test('comparePairwisePreference: strict majority and pairwise tie', () => {
  const split = comparePairwisePreference(
    [
      ['a', 'b'],
      ['b', 'a'],
    ],
    'a',
    'b',
  )
  assert.equal(split.preferA, 1)
  assert.equal(split.preferB, 1)

  const win = comparePairwisePreference(
    [
      ['a', 'b'],
      ['a', 'b'],
    ],
    'a',
    'b',
  )
  assert.equal(win.preferA, 2)
  assert.equal(win.preferB, 0)
})

test('runCondorcet: Condorcet winner beats all head-to-head', () => {
  const rankings = [
    ['a', 'b', 'c'],
    ['a', 'c', 'b'],
    ['b', 'a', 'c'],
  ]
  const r = runCondorcet(rankings, ['a', 'b', 'c'])
  assert.equal(r.winnerId, 'a')
  assert.equal(r.tieWinnerIds, null)
  assert.equal(r.rounds.length, 0)
  assert.equal(r.pairwiseMatrix?.candidateIds.length, 3)
  assert.equal(r.pairwiseMatrix?.cells.a.b, 'win')
  assert.equal(r.pairwiseMatrix?.cells.b.a, 'loss')
})

test('runCondorcet: Condorcet cycle → declared tie with Smith set only', () => {
  const rankings = [
    ['a', 'b', 'c'],
    ['b', 'c', 'a'],
    ['c', 'a', 'b'],
  ]
  const r = runCondorcet(rankings, ['a', 'b', 'c'])
  assert.equal(r.winnerId, null)
  assert.deepEqual(new Set(r.tieWinnerIds ?? []), new Set(['a', 'b', 'c']))
  assert.equal(r.rounds.length, 0)
})

test('runCondorcet: pairwise tie on matrix diagonal-off cells', () => {
  const rankings = [
    ['a', 'b'],
    ['b', 'a'],
  ]
  const r = runCondorcet(rankings, ['a', 'b'])
  assert.equal(r.winnerId, null)
  assert.deepEqual(new Set(r.tieWinnerIds ?? []), new Set(['a', 'b']))
  assert.equal(r.pairwiseMatrix?.cells.a.b, 'tie')
  assert.equal(r.pairwiseMatrix?.cells.b.a, 'tie')
})

test('smithSetFromBeatpaths: dominated candidate excluded from Smith set', () => {
  const rankings = [
    ['a', 'b', 'c', 'd'],
    ['b', 'c', 'a', 'd'],
    ['c', 'a', 'b', 'd'],
  ]
  assert.deepEqual(
    new Set(smithSetFromBeatpaths(['a', 'b', 'c', 'd'], rankings)),
    new Set(['a', 'b', 'c']),
  )
})

test('isDeclaredCondorcetTie: non-empty tieWinnerIds only', () => {
  assert.equal(isDeclaredCondorcetTie({ tieWinnerIds: ['a'], winnerId: null, rounds: [] }), true)
  assert.equal(isDeclaredCondorcetTie({ tieWinnerIds: null, winnerId: 'a', rounds: [] }), false)
  assert.equal(isDeclaredCondorcetTie(null), false)
})

test('runCondorcet: zero and one candidate edge cases', () => {
  const empty = runCondorcet([], [])
  assert.equal(empty.winnerId, null)
  assert.deepEqual(empty.tieWinnerIds, [])
  assert.equal(empty.pairwiseMatrix?.candidateIds.length, 0)

  const solo = runCondorcet([['x']], ['x'])
  assert.equal(solo.winnerId, 'x')
  assert.equal(solo.tieWinnerIds, null)
})

test('pairwiseBeats: ignores ballots missing either candidate', () => {
  assert.equal(pairwiseBeats([['a', 'b'], ['b']], 'a', 'b'), true)
  assert.equal(pairwiseBeats([['a', 'b'], ['b']], 'b', 'a'), false)
})

test('buildPairwiseMatrix: win loss tie from row perspective', () => {
  const matrix = buildPairwiseMatrix(
    [
      ['a', 'b'],
      ['a', 'b'],
    ],
    ['a', 'b'],
  )
  assert.equal(matrix.cells.a.b, 'win')
  assert.equal(matrix.cells.b.a, 'loss')
  assert.equal(matrix.cells.a.a, undefined)
})
