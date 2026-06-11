/**
 * Run: node --test src/features/movie-vote/irv.test.js
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  countFirstPreferences,
  currentVoteForBallot,
  runIrv,
} from './irv.js'

/** @param {import('./electionOutcomeTypes.js').ElectionRoundLog} round */
function assertFirstPreferenceRoundLog(round) {
  assert.ok('firstPreferenceCounts' in round)
  assert.ok('activeIds' in round)
  assert.ok('ballotsWithVote' in round)
  assert.ok(!('points' in round))
  assert.ok(!('totalPointsThisRound' in round))
  assert.ok(!('counts' in round))
  assert.ok(Array.isArray(round.eliminatedIds))
  let sum = 0
  for (const id of round.activeIds) {
    sum += round.firstPreferenceCounts[id] ?? 0
  }
  assert.equal(round.ballotsWithVote, sum)
}

/** @param {import('./electionOutcomeTypes.js').ElectionOutcome} result */
function assertAllRoundsUseFirstPreferenceFields(result) {
  for (const round of result.rounds) assertFirstPreferenceRoundLog(round)
}

test('currentVoteForBallot skips eliminated', () => {
  const active = new Set(['a', 'c'])
  assert.equal(currentVoteForBallot(['a', 'b', 'c'], active), 'a')
  assert.equal(currentVoteForBallot(['b', 'c', 'a'], active), 'c')
})

test('countFirstPreferences tallies first prefs among active', () => {
  const active = new Set(['a', 'b', 'c'])
  const { firstPreferenceCounts, ballotsWithVote } = countFirstPreferences(
    [
      ['a', 'b', 'c'],
      ['b', 'a', 'c'],
      ['c', 'a', 'b'],
    ],
    active,
  )
  assert.deepEqual(firstPreferenceCounts, { a: 1, b: 1, c: 1 })
  assert.equal(ballotsWithVote, 3)
})

test('runIrv: majority ends in one round', () => {
  const ids = ['x', 'y', 'z']
  const rankings = [
    ['x', 'y', 'z'],
    ['x', 'z', 'y'],
    ['x', 'y', 'z'],
  ]
  const r = runIrv(rankings, ids)
  assert.equal(r.winnerId, 'x')
  assert.equal(r.tieWinnerIds, null)
  assert.equal(r.rounds.length, 1)
  assert.deepEqual(r.rounds[0].firstPreferenceCounts, { x: 3, y: 0, z: 0 })
  assert.equal(r.rounds[0].ballotsWithVote, 3)
  assert.deepEqual(r.rounds[0].eliminatedIds, [])
  assertAllRoundsUseFirstPreferenceFields(r)
})

test('runIrv: transfers after eliminating sole last place', () => {
  const ids = ['a', 'b', 'c']
  const rankings = [
    ['a', 'b', 'c'],
    ['a', 'b', 'c'],
    ['b', 'a', 'c'],
    ['c', 'a', 'b'],
    ['c', 'b', 'a'],
  ]
  const r = runIrv(rankings, ids)
  assert.equal(r.winnerId, 'a')
  assert.equal(r.tieWinnerIds, null)
  assert.deepEqual(r.rounds[0].firstPreferenceCounts, { a: 2, b: 1, c: 2 })
  assert.deepEqual(r.rounds[0].eliminatedIds, ['b'])
  assert.deepEqual(r.rounds[1].activeIds, ['a', 'c'])
  assert.deepEqual(r.rounds[1].firstPreferenceCounts, { a: 3, c: 2 })
  assert.equal(r.rounds[1].ballotsWithVote, 5)
  assertAllRoundsUseFirstPreferenceFields(r)
})

test('runIrv: eliminates all tied for last in one round', () => {
  const ids = ['a', 'b', 'c', 'd']
  const rankings = [
    ['a', 'b', 'c', 'd'],
    ['a', 'b', 'c', 'd'],
    ['b', 'a', 'c', 'd'],
    ['c', 'a', 'b', 'd'],
    ['d', 'a', 'b', 'c'],
  ]
  const r = runIrv(rankings, ids)
  assert.equal(r.winnerId, 'a')
  assert.deepEqual(r.rounds[0].firstPreferenceCounts, { a: 2, b: 1, c: 1, d: 1 })
  assert.deepEqual(new Set(r.rounds[0].eliminatedIds), new Set(['b', 'c', 'd']))
  assertAllRoundsUseFirstPreferenceFields(r)
})

test('declared tie when two remain with equal first preferences', () => {
  const ids = ['a', 'b']
  const rankings = [
    ['a', 'b'],
    ['b', 'a'],
  ]
  const r = runIrv(rankings, ids)
  const r0 = r.rounds[0]
  assert.equal(r0.firstPreferenceCounts.a, r0.firstPreferenceCounts.b)
  assert.equal(r0.ballotsWithVote, 2)
  assert.equal(r.winnerId, null)
  assert.deepEqual(new Set(r.tieWinnerIds ?? []), new Set(['a', 'b']))
  assert.equal(r.rounds.length, 1)
  assert.deepEqual(r0.eliminatedIds, [])
  assertAllRoundsUseFirstPreferenceFields(r)
})

test('declared tie when every active candidate ties for last', () => {
  const ids = ['a', 'b', 'c']
  const rankings = [
    ['a', 'b', 'c'],
    ['b', 'c', 'a'],
    ['c', 'a', 'b'],
  ]
  const r = runIrv(rankings, ids)
  assert.equal(r.winnerId, null)
  assert.deepEqual(new Set(r.tieWinnerIds ?? []), new Set(['a', 'b', 'c']))
  assert.equal(r.rounds.length, 1)
  assertAllRoundsUseFirstPreferenceFields(r)
})

test('declared tie when no ballots express a preference', () => {
  const r = runIrv([], ['a', 'b'])
  assert.equal(r.winnerId, null)
  assert.deepEqual(new Set(r.tieWinnerIds ?? []), new Set(['a', 'b']))
  assert.equal(r.rounds.length, 1)
  assert.deepEqual(r.rounds[0].firstPreferenceCounts, { a: 0, b: 0 })
  assert.equal(r.rounds[0].ballotsWithVote, 0)
  assert.deepEqual(r.rounds[0].eliminatedIds, [])
  assertAllRoundsUseFirstPreferenceFields(r)
})

test('zero candidates: empty rounds and tieWinnerIds', () => {
  const r = runIrv([], [])
  assert.equal(r.winnerId, null)
  assert.deepEqual(r.tieWinnerIds, [])
  assert.equal(r.rounds.length, 0)
})

test('single candidate: one round, no elimination', () => {
  const r = runIrv([['only'], ['only']], ['only'])
  assert.equal(r.winnerId, 'only')
  assert.equal(r.tieWinnerIds, null)
  assert.equal(r.rounds.length, 1)
  assert.deepEqual(r.rounds[0], {
    firstPreferenceCounts: { only: 2 },
    activeIds: ['only'],
    ballotsWithVote: 2,
    eliminatedIds: [],
  })
})

test('preferences flow after successive eliminations', () => {
  const ids = ['A', 'B', 'C', 'D']
  const rankings = [
    ['D', 'A', 'C', 'B'],
    ['A', 'C', 'B', 'D'],
    ['A', 'C', 'D', 'B'],
    ['C', 'A', 'D', 'B'],
    ['B', 'A', 'D', 'C'],
    ['D', 'B', 'A', 'C'],
  ]
  const r = runIrv(rankings, ids)
  assert.equal(r.winnerId, 'A')
  assert.equal(r.tieWinnerIds, null)
  assert.deepEqual(r.rounds[0].firstPreferenceCounts, { A: 2, B: 1, C: 1, D: 2 })
  assert.deepEqual(r.rounds[0].eliminatedIds, ['B', 'C'])
  assertAllRoundsUseFirstPreferenceFields(r)
})
