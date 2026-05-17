/**
 * Run: node --test src/features/movie-vote/coombs.test.js
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  countLastPlaces,
  currentLastPlaceForBallot,
  isDeclaredCoombsTie,
  runCoombs,
} from './coombs.js'
import { runIrv } from './irv.js'

/** @param {import('./irv.js').IrvResult['rounds'][number]} round */
function assertLastPlaceRoundLog(round) {
  assert.ok('lastPlaceCounts' in round)
  assert.ok('activeIds' in round)
  assert.ok('ballotsWithVote' in round)
  assert.ok(!('firstPreferenceCounts' in round))
  assert.ok(Array.isArray(round.eliminatedIds))
  let sum = 0
  for (const id of round.activeIds) {
    sum += round.lastPlaceCounts[id] ?? 0
  }
  assert.equal(round.ballotsWithVote, sum)
}

/** @param {import('./irv.js').IrvResult} result */
function assertAllRoundsUseLastPlaceFields(result) {
  for (const round of result.rounds) assertLastPlaceRoundLog(round)
}

test('isDeclaredCoombsTie: true only for non-empty tieWinnerIds', () => {
  assert.equal(isDeclaredCoombsTie(null), false)
  assert.equal(isDeclaredCoombsTie({ tieWinnerIds: null, winnerId: 'x', rounds: [] }), false)
  assert.equal(isDeclaredCoombsTie({ tieWinnerIds: ['a', 'b'], winnerId: null, rounds: [] }), true)
})

test('currentLastPlaceForBallot picks worst active rank', () => {
  const active = new Set(['a', 'c'])
  assert.equal(currentLastPlaceForBallot(['a', 'b', 'c'], active), 'c')
  assert.equal(currentLastPlaceForBallot(['c', 'a', 'b'], active), 'a')
})

test('countLastPlaces tallies last prefs among active', () => {
  const active = new Set(['a', 'b', 'c'])
  const { lastPlaceCounts, ballotsWithVote } = countLastPlaces(
    [
      ['a', 'b', 'c'],
      ['b', 'a', 'c'],
      ['c', 'a', 'b'],
    ],
    active,
  )
  assert.deepEqual(lastPlaceCounts, { a: 0, b: 1, c: 2 })
  assert.equal(ballotsWithVote, 3)
})

const eliminationCases = [
  {
    name: 'sole most last-place eliminated, then winner',
    ids: ['a', 'b'],
    rankings: [
      ['a', 'b'],
      ['a', 'b'],
      ['a', 'b'],
      ['b', 'a'],
    ],
    expect: {
      winnerId: 'a',
      tieWinnerIds: null,
      roundsLen: 2,
      r0Last: { a: 1, b: 3 },
      r0Elim: ['b'],
    },
  },
  {
    name: 'eliminates all tied for most last-place in one round',
    ids: ['a', 'b', 'c', 'd'],
    rankings: [
      ['a', 'b', 'c', 'd'],
      ['a', 'b', 'd', 'c'],
      ['a', 'c', 'b', 'd'],
      ['a', 'c', 'd', 'b'],
      ['a', 'd', 'b', 'c'],
      ['a', 'd', 'c', 'b'],
    ],
    expect: {
      winnerId: 'a',
      tieWinnerIds: null,
      roundsLen: 2,
      r0Last: { a: 0, b: 2, c: 2, d: 2 },
      r0Elim: ['b', 'c', 'd'],
    },
  },
]

test('runCoombs: multi-round elimination until one winner', () => {
  const ids = ['a', 'b', 'c']
  const rankings = [
    ['a', 'b', 'c'],
    ['a', 'b', 'c'],
    ['a', 'b', 'c'],
  ]
  const r = runCoombs(rankings, ids)
  assert.equal(r.winnerId, 'a')
  assert.equal(r.tieWinnerIds, null)
  assert.ok(r.rounds.length >= 2)
  assert.deepEqual(r.rounds[0].eliminatedIds, ['c'])
  assert.deepEqual(r.rounds[0].lastPlaceCounts, { a: 0, b: 0, c: 3 })
  const last = r.rounds[r.rounds.length - 1]
  assert.deepEqual(last.activeIds, ['a'])
  assert.equal(last.eliminatedIds.length, 0)
  assertAllRoundsUseLastPlaceFields(r)
})

test('runCoombs round 1 eliminates most last-place, not IRV last-place first prefs', () => {
  const ids = ['a', 'b', 'c']
  const rankings = [
    ['a', 'b', 'c'],
    ['a', 'b', 'c'],
    ['b', 'a', 'c'],
    ['c', 'a', 'b'],
  ]
  const coombs = runCoombs(rankings, ids)
  assert.deepEqual(coombs.rounds[0].eliminatedIds, ['c'])
  assert.ok(!('firstPreferenceCounts' in coombs.rounds[0]))

  const irv = runIrv(rankings, ids)
  assert.deepEqual(new Set(irv.rounds[0].eliminatedIds), new Set(['b', 'c']))
})

for (const { name, ids, rankings, expect } of eliminationCases) {
  test(`runCoombs elimination: ${name}`, () => {
    const r = runCoombs(rankings, ids)
    assert.equal(r.winnerId, expect.winnerId)
    assert.equal(r.tieWinnerIds, expect.tieWinnerIds)
    assert.equal(r.rounds.length, expect.roundsLen)
    assert.deepEqual(r.rounds[0].lastPlaceCounts, expect.r0Last)
    assert.deepEqual(new Set(r.rounds[0].eliminatedIds), new Set(expect.r0Elim))
    assertAllRoundsUseLastPlaceFields(r)
  })
}

const declaredTieCases = [
  {
    name: 'two remain with equal last-place counts',
    ids: ['a', 'b'],
    rankings: [
      ['a', 'b'],
      ['b', 'a'],
    ],
    tieIds: ['a', 'b'],
  },
  {
    name: 'every active ties for most last-place',
    ids: ['a', 'b', 'c'],
    rankings: [
      ['a', 'b', 'c'],
      ['b', 'c', 'a'],
      ['c', 'a', 'b'],
    ],
    tieIds: ['a', 'b', 'c'],
  },
  {
    name: 'no ballot expresses a preference among active',
    ids: ['a', 'b'],
    rankings: [],
    tieIds: ['a', 'b'],
  },
]

for (const { name, ids, rankings, tieIds } of declaredTieCases) {
  test(`runCoombs declared tie: ${name}`, () => {
    const r = runCoombs(rankings, ids)
    assert.equal(r.winnerId, null)
    assert.deepEqual(new Set(r.tieWinnerIds ?? []), new Set(tieIds))
    assert.equal(r.rounds.length, 1)
    assert.deepEqual(r.rounds[0].eliminatedIds, [])
    assertAllRoundsUseLastPlaceFields(r)
  })
}

test('zero candidates: empty rounds and tieWinnerIds', () => {
  const r = runCoombs([], [])
  assert.equal(r.winnerId, null)
  assert.deepEqual(r.tieWinnerIds, [])
  assert.equal(r.rounds.length, 0)
})

test('single candidate: one round, no elimination', () => {
  const r = runCoombs([['only'], ['only']], ['only'])
  assert.equal(r.winnerId, 'only')
  assert.equal(r.tieWinnerIds, null)
  assert.equal(r.rounds.length, 1)
  assert.deepEqual(r.rounds[0], {
    lastPlaceCounts: { only: 2 },
    activeIds: ['only'],
    ballotsWithVote: 2,
    eliminatedIds: [],
  })
})
