/**
 * Run: node --test src/features/movie-vote/borda.test.js
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  bordaPointsForRank,
  isDeclaredBordaTie,
  runBorda,
  tallyBordaScores,
} from './borda.js'

test('bordaPointsForRank: classic scale (table)', () => {
  /** @type {[number, number, number][]} */
  const cases = [
    [3, 0, 2],
    [3, 1, 1],
    [3, 2, 0],
    [5, 0, 4],
    [5, 4, 0],
    [1, 0, 0],
    [2, 0, 1],
    [2, 1, 0],
  ]
  for (const [n, position, expected] of cases) {
    assert.equal(bordaPointsForRank(position, n), expected, `n=${n} pos=${position}`)
  }
})

test('tallyBordaScores ignores ids not on the ballot', () => {
  const totals = tallyBordaScores([['a', 'ghost', 'b']], ['a', 'b'])
  assert.deepEqual(totals, { a: 1, b: 0 })
})

test('tallyBordaScores sums ballots on full ballot', () => {
  const totals = tallyBordaScores(
    [
      ['a', 'b', 'c'],
      ['b', 'a', 'c'],
    ],
    ['a', 'b', 'c'],
  )
  assert.deepEqual(totals, { a: 3, b: 3, c: 0 })
})

test('runBorda: unique highest wins (table)', () => {
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
        ['b', 'a', 'c'],
      ],
      ['a', 'b', 'c'],
      'a',
    ],
    [[['solo']], ['solo'], 'solo'],
  ]
  for (const [rankings, ids, winner] of cases) {
    const r = runBorda(rankings, ids)
    assert.equal(r.winnerId, winner, JSON.stringify({ rankings, ids }))
    assert.equal(r.tieWinnerIds, null)
    assert.equal(r.rounds.length, 1)
    assert.deepEqual(r.rounds[0].eliminatedIds, [])
  }
})

test('runBorda: tied highest → declared tie (table)', () => {
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
    const r = runBorda(rankings, ids)
    assert.equal(r.winnerId, null)
    assert.deepEqual(new Set(r.tieWinnerIds ?? []), new Set(leaders))
    assert.equal(r.rounds.length, 1)
  }
})

test('runBorda: empty ballot', () => {
  const r = runBorda([], [])
  assert.equal(r.winnerId, null)
  assert.deepEqual(r.tieWinnerIds, [])
  assert.equal(r.rounds.length, 0)
})

test('runBorda: no ballots → all candidates tied at zero', () => {
  const r = runBorda([], ['a', 'b'])
  assert.equal(r.winnerId, null)
  assert.deepEqual(new Set(r.tieWinnerIds ?? []), new Set(['a', 'b']))
  assert.equal(r.rounds[0].firstPreferenceCounts.a, 0)
  assert.equal(r.rounds[0].firstPreferenceCounts.b, 0)
})

test('isDeclaredBordaTie matches tieWinnerIds shape', () => {
  assert.equal(isDeclaredBordaTie({ tieWinnerIds: ['a'], winnerId: null, rounds: [] }), true)
  assert.equal(isDeclaredBordaTie({ tieWinnerIds: null, winnerId: 'a', rounds: [] }), false)
})
