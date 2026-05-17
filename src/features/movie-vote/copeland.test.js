/**
 * Run: node --test src/features/movie-vote/copeland.test.js
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { runCondorcet } from './condorcet.js'
import { buildPairwiseMatrix } from './condorcet.js'
import {
  copelandScore,
  copelandScoreFromMatrix,
  copelandScores,
  isDeclaredCopelandTie,
  runCopeland,
} from './copeland.js'

test('copelandScore: wins minus losses; pairwise ties count neither', () => {
  assert.equal(
    copelandScore(
      [
        ['a', 'b'],
        ['a', 'b'],
      ],
      'a',
      ['a', 'b'],
    ),
    1,
  )
  assert.equal(
    copelandScore(
      [
        ['a', 'b'],
        ['a', 'b'],
      ],
      'b',
      ['a', 'b'],
    ),
    -1,
  )
  assert.equal(
    copelandScore(
      [
        ['a', 'b'],
        ['b', 'a'],
      ],
      'a',
      ['a', 'b'],
    ),
    0,
  )
})

test('copelandScores: one score per candidate', () => {
  const scores = copelandScores(
    [
      ['a', 'b', 'c'],
      ['a', 'c', 'b'],
      ['b', 'a', 'c'],
    ],
    ['a', 'b', 'c'],
  )
  assert.equal(scores.a, 2)
  assert.equal(scores.b, 0)
  assert.equal(scores.c, -2)
})

test('runCopeland: unique Copeland leader wins', () => {
  const rankings = [
    ['a', 'b', 'c'],
    ['a', 'c', 'b'],
    ['b', 'a', 'c'],
  ]
  const r = runCopeland(rankings, ['a', 'b', 'c'])
  assert.equal(r.winnerId, 'a')
  assert.equal(r.tieWinnerIds, null)
  assert.equal(r.copelandScores?.a, 2)
  assert.equal(r.pairwiseMatrix?.cells.a.b, 'win')
  assert.equal(r.rounds.length, 0)
})

test('runCopeland: tied Copeland leaders → declared tie with leaders only', () => {
  const rankings = [
    ['a', 'b'],
    ['b', 'a'],
  ]
  const r = runCopeland(rankings, ['a', 'b'])
  assert.equal(r.winnerId, null)
  assert.deepEqual(new Set(r.tieWinnerIds ?? []), new Set(['a', 'b']))
  assert.equal(r.copelandScores?.a, 0)
  assert.equal(r.copelandScores?.b, 0)
  assert.equal(r.pairwiseMatrix?.cells.a.b, 'tie')
})

test('runCopeland: three-way cycle → declared tie on all leaders at top score', () => {
  const rankings = [
    ['a', 'b', 'c'],
    ['b', 'c', 'a'],
    ['c', 'a', 'b'],
  ]
  const r = runCopeland(rankings, ['a', 'b', 'c'])
  assert.equal(r.winnerId, null)
  assert.deepEqual(new Set(r.tieWinnerIds ?? []), new Set(['a', 'b', 'c']))
  assert.equal(r.copelandScores?.a, 0)
  assert.equal(r.copelandScores?.b, 0)
  assert.equal(r.copelandScores?.c, 0)
})

test('runCopeland: differs from Condorcet Smith-set tie policy', () => {
  const rankings = [
    ['a', 'b', 'c', 'd'],
    ['a', 'b', 'c', 'd'],
    ['b', 'c', 'd', 'a'],
    ['c', 'd', 'a', 'b'],
    ['d', 'a', 'b', 'c'],
  ]
  const ids = ['a', 'b', 'c', 'd']
  const cond = runCondorcet(rankings, ids)
  const cop = runCopeland(rankings, ids)
  assert.equal(cond.winnerId, null)
  assert.deepEqual(new Set(cond.tieWinnerIds ?? []), new Set(['a', 'b', 'c', 'd']))
  assert.equal(cop.winnerId, null)
  assert.deepEqual(new Set(cop.tieWinnerIds ?? []), new Set(['a', 'b']))
  assert.equal(cop.copelandScores?.a, 1)
  assert.equal(cop.copelandScores?.c, -1)
})

test('copelandScoreFromMatrix: matches pairwise cells (wins minus losses)', () => {
  const rankings = [
    ['a', 'b', 'c'],
    ['a', 'c', 'b'],
    ['b', 'a', 'c'],
  ]
  const matrix = buildPairwiseMatrix(rankings, ['a', 'b', 'c'])
  assert.equal(copelandScoreFromMatrix(matrix, 'a'), 2)
  assert.equal(copelandScoreFromMatrix(matrix, 'c'), -2)
})

test('runCopeland: partial top tie — co-winners are max-score leaders only', () => {
  const rankings = [
    ['a', 'b', 'c', 'd'],
    ['a', 'b', 'c', 'd'],
    ['b', 'c', 'd', 'a'],
    ['c', 'd', 'a', 'b'],
    ['d', 'a', 'b', 'c'],
  ]
  const ids = ['a', 'b', 'c', 'd']
  const r = runCopeland(rankings, ids)
  assert.equal(r.winnerId, null)
  assert.deepEqual(new Set(r.tieWinnerIds ?? []), new Set(['a', 'b']))
  assert.equal(r.copelandScores?.c, -1)
  assert.notEqual(r.copelandScores?.d, r.copelandScores?.a)
})

test('isDeclaredCopelandTie: non-empty tieWinnerIds only', () => {
  assert.equal(isDeclaredCopelandTie({ tieWinnerIds: ['a'], winnerId: null, rounds: [] }), true)
  assert.equal(isDeclaredCopelandTie({ tieWinnerIds: [], winnerId: null, rounds: [] }), false)
  assert.equal(isDeclaredCopelandTie({ tieWinnerIds: null, winnerId: 'a', rounds: [] }), false)
  assert.equal(isDeclaredCopelandTie(null), false)
})

test('runCopeland: zero and one candidate edge cases', () => {
  const empty = runCopeland([], [])
  assert.equal(empty.winnerId, null)
  assert.deepEqual(empty.tieWinnerIds, [])
  assert.equal(empty.pairwiseMatrix?.candidateIds.length, 0)

  const solo = runCopeland([['x']], ['x'])
  assert.equal(solo.winnerId, 'x')
  assert.equal(solo.tieWinnerIds, null)
})
