/**
 * Run: node --test src/features/movie-vote/baldwin.test.js
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isDeclaredBaldwinTie,
  runBaldwin,
  tallyBordaAmongActive,
} from './baldwin.js'

/** @param {import('./irv.js').IrvResult['rounds'][number]} round */
function assertBaldwinRoundLog(round) {
  assert.ok('firstPreferenceCounts' in round)
  assert.ok('activeIds' in round)
  assert.ok('ballotsWithVote' in round)
  assert.ok(Array.isArray(round.eliminatedIds))
}

test('tallyBordaAmongActive uses classic scale on survivors only', () => {
  const totals = tallyBordaAmongActive(
    [
      ['a', 'b', 'c'],
      ['c', 'b', 'a'],
    ],
    ['b', 'c'],
  )
  assert.deepEqual(totals, { b: 1, c: 1 })
})

test('runBaldwin: multi-round elimination until one winner', () => {
  const ids = ['a', 'b', 'c']
  const rankings = [
    ['a', 'b', 'c'],
    ['a', 'b', 'c'],
    ['a', 'b', 'c'],
  ]
  const r = runBaldwin(rankings, ids)
  assert.equal(r.winnerId, 'a')
  assert.equal(r.tieWinnerIds, null)
  assert.ok(r.rounds.length >= 2)
  assert.deepEqual(r.rounds[0].eliminatedIds, ['c'])
  assert.deepEqual(r.rounds[0].firstPreferenceCounts, { a: 6, b: 3, c: 0 })
  const last = r.rounds[r.rounds.length - 1]
  assert.deepEqual(last.activeIds, ['a'])
  assert.equal(last.eliminatedIds.length, 0)
  for (const round of r.rounds) assertBaldwinRoundLog(round)
})

test('runBaldwin: eliminates all tied for lowest in one round', () => {
  const ids = ['a', 'b', 'c', 'd']
  const rankings = [
    ['a', 'b', 'c', 'd'],
    ['a', 'b', 'c', 'd'],
    ['b', 'a', 'd', 'c'],
    ['c', 'a', 'd', 'b'],
    ['d', 'a', 'b', 'c'],
  ]
  const r = runBaldwin(rankings, ids)
  assert.equal(r.winnerId, 'a')
  const r0 = r.rounds[0]
  const min = Math.min(
    r0.firstPreferenceCounts.a ?? 0,
    r0.firstPreferenceCounts.b ?? 0,
    r0.firstPreferenceCounts.c ?? 0,
    r0.firstPreferenceCounts.d ?? 0,
  )
  const tiedForMin = r0.activeIds.filter((id) => (r0.firstPreferenceCounts[id] ?? 0) === min)
  assert.ok(tiedForMin.length >= 2)
  assert.deepEqual(new Set(r0.eliminatedIds), new Set(tiedForMin))
})

test('runBaldwin: declared tie when two survivors tie on Borda', () => {
  const ids = ['a', 'b', 'c']
  const rankings = [
    ['a', 'b', 'c'],
    ['a', 'b', 'c'],
    ['b', 'a', 'c'],
    ['b', 'a', 'c'],
  ]
  const r = runBaldwin(rankings, ids)
  assert.equal(r.winnerId, null)
  assert.deepEqual(new Set(r.tieWinnerIds ?? []), new Set(['a', 'b']))
  assert.equal(r.rounds.length, 2)
  assert.deepEqual(r.rounds[0].eliminatedIds, ['c'])
  assert.deepEqual(r.rounds[1].eliminatedIds, [])
})

test('runBaldwin: declared tie when every active ties for lowest', () => {
  const ids = ['a', 'b', 'c']
  const rankings = [
    ['a', 'b', 'c'],
    ['b', 'c', 'a'],
    ['c', 'a', 'b'],
  ]
  const r = runBaldwin(rankings, ids)
  assert.equal(r.winnerId, null)
  assert.deepEqual(new Set(r.tieWinnerIds ?? []), new Set(['a', 'b', 'c']))
  assert.equal(r.rounds.length, 1)
  assert.deepEqual(r.rounds[0].eliminatedIds, [])
})

test('runBaldwin: empty ballot', () => {
  const r = runBaldwin([], [])
  assert.equal(r.winnerId, null)
  assert.deepEqual(r.tieWinnerIds, [])
  assert.equal(r.rounds.length, 0)
})

test('isDeclaredBaldwinTie matches tieWinnerIds shape', () => {
  assert.equal(isDeclaredBaldwinTie({ tieWinnerIds: ['a'], winnerId: null, rounds: [] }), true)
  assert.equal(isDeclaredBaldwinTie({ tieWinnerIds: null, winnerId: 'a', rounds: [] }), false)
})
