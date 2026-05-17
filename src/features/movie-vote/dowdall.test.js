/**
 * Run: node --test src/features/movie-vote/dowdall.test.js
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { tallyBordaScores } from './borda.js'
import {
  dowdallPointsForRank,
  isDeclaredDowdallTie,
  runDowdall,
  tallyDowdallScores,
} from './dowdall.js'

test('dowdallPointsForRank: harmonic scale (table)', () => {
  /** @type {[number, number][]} */
  const cases = [
    [0, 1],
    [1, 0.5],
    [2, 1 / 3],
    [3, 0.25],
    [4, 0.2],
  ]
  for (const [position, expected] of cases) {
    assert.equal(dowdallPointsForRank(position), expected, `pos=${position}`)
  }
})

test('tallyDowdallScores ignores ids not on the ballot', () => {
  const totals = tallyDowdallScores([['a', 'ghost', 'b']], ['a', 'b'])
  assert.equal(totals.a, 1)
  assert.equal(totals.b, 1 / 3)
})

test('tallyDowdallScores uses harmonic scale, not classic Borda', () => {
  const rankings = [['a', 'b', 'c']]
  const ids = ['a', 'b', 'c']
  const dowdall = tallyDowdallScores(rankings, ids)
  const borda = tallyBordaScores(rankings, ids)
  assert.equal(dowdall.a, 1)
  assert.equal(dowdall.b, 0.5)
  assert.equal(dowdall.c, 1 / 3)
  assert.equal(borda.a, 2)
  assert.equal(borda.b, 1)
  assert.equal(borda.c, 0)
  assert.notDeepEqual(dowdall, borda)
})

test('tallyDowdallScores sums ballots on full ballot', () => {
  const totals = tallyDowdallScores(
    [
      ['a', 'b', 'c'],
      ['b', 'a', 'c'],
    ],
    ['a', 'b', 'c'],
  )
  assert.equal(totals.a, 1 + 0.5)
  assert.equal(totals.b, 0.5 + 1)
  assert.equal(totals.c, 1 / 3 + 1 / 3)
})

test('runDowdall: unique highest wins (table)', () => {
  /** @type {[string[][], string[], string][]} */
  const cases = [
    [
      [
        ['a', 'b'],
        ['a', 'b'],
      ],
      ['a', 'b'],
      'a',
    ],
    [
      [
        ['a', 'b', 'c'],
        ['a', 'c', 'b'],
        ['a', 'b', 'c'],
      ],
      ['a', 'b', 'c'],
      'a',
    ],
    [[['solo']], ['solo'], 'solo'],
  ]
  for (const [rankings, ids, winner] of cases) {
    const r = runDowdall(rankings, ids)
    assert.equal(r.winnerId, winner, JSON.stringify({ rankings, ids }))
    assert.equal(r.tieWinnerIds, null)
    assert.equal(r.rounds.length, 1)
    assert.deepEqual(r.rounds[0].eliminatedIds, [])
  }
})

test('runDowdall: tied highest → declared tie (table)', () => {
  /** @type {[string[][], string[], string[]][]} */
  const cases = [
    [
      [
        ['a', 'b'],
        ['b', 'a'],
      ],
      ['a', 'b'],
      ['a', 'b'],
    ],
    [
      [
        ['a', 'b', 'c'],
        ['b', 'c', 'a'],
        ['c', 'a', 'b'],
      ],
      ['a', 'b', 'c'],
      ['a', 'b', 'c'],
    ],
    [
      [
        ['x', 'y', 'z'],
        ['y', 'x', 'z'],
      ],
      ['x', 'y', 'z'],
      ['x', 'y'],
    ],
  ]
  for (const [rankings, ids, leaders] of cases) {
    const r = runDowdall(rankings, ids)
    assert.equal(r.winnerId, null)
    assert.deepEqual(new Set(r.tieWinnerIds ?? []), new Set(leaders))
    assert.equal(r.rounds.length, 1)
  }
})

test('runDowdall: empty ballot', () => {
  const r = runDowdall([], [])
  assert.equal(r.winnerId, null)
  assert.deepEqual(r.tieWinnerIds, [])
  assert.equal(r.rounds.length, 0)
})

test('runDowdall: no ballots → all candidates tied at zero', () => {
  const r = runDowdall([], ['a', 'b'])
  assert.equal(r.winnerId, null)
  assert.deepEqual(new Set(r.tieWinnerIds ?? []), new Set(['a', 'b']))
  assert.equal(r.rounds[0].firstPreferenceCounts.a, 0)
  assert.equal(r.rounds[0].firstPreferenceCounts.b, 0)
})

test('isDeclaredDowdallTie matches tieWinnerIds shape', () => {
  assert.equal(isDeclaredDowdallTie({ tieWinnerIds: ['a'], winnerId: null, rounds: [] }), true)
  assert.equal(isDeclaredDowdallTie({ tieWinnerIds: null, winnerId: 'a', rounds: [] }), false)
  assert.equal(isDeclaredDowdallTie({ tieWinnerIds: [], winnerId: null, rounds: [] }), false)
})

test('runDowdall: partial top tie — co-winners are max-score leaders only', () => {
  const r = runDowdall(
    [
      ['x', 'y', 'z'],
      ['y', 'x', 'z'],
    ],
    ['x', 'y', 'z'],
  )
  assert.equal(r.winnerId, null)
  assert.deepEqual(new Set(r.tieWinnerIds ?? []), new Set(['x', 'y']))
  assert.ok(!r.tieWinnerIds?.includes('z'))
})
