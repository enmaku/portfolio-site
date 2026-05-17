/**
 * Run: node --test src/features/movie-vote/resultsScoreboard.test.js
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { runBaldwin } from './baldwin.js'
import { runBorda } from './borda.js'
import { runDowdall } from './dowdall.js'
import { runCondorcet } from './condorcet.js'
import { runElection } from './election.js'
import { runIrv } from './irv.js'
import {
  countsForScoreboardRound,
  isBaldwinMultiRoundResult,
  isBordaScoreboardResult,
  isDowdallScoreboardResult,
  isCoombsScoreboardResult,
  shouldAnimateRoundsReplay,
  showVotePoolSuffix,
  targetPctsForScoreboardRound,
} from './resultsScoreboard.js'

test('Borda result: single scoreboard and bar scale (table)', () => {
  const result = runElection(
    'borda',
    [
      ['a', 'b', 'c'],
      ['a', 'c', 'b'],
    ],
    ['a', 'b', 'c'],
  )
  assert.equal(result.rounds.length, 1)
  assert.equal(isBordaScoreboardResult(result), true)
  assert.equal(showVotePoolSuffix(result), false)
  assert.deepEqual(targetPctsForScoreboardRound(result.rounds[0], 'borda'), {
    a: 100,
    b: 25,
    c: 25,
  })
})

test('Dowdall result: single scoreboard and bar scale (table)', () => {
  const result = runElection(
    'dowdall',
    [
      ['a', 'b', 'c'],
      ['a', 'c', 'b'],
    ],
    ['a', 'b', 'c'],
  )
  assert.equal(result.rounds.length, 1)
  assert.equal(isDowdallScoreboardResult(result), true)
  assert.equal(isBordaScoreboardResult(result), false)
  assert.equal(showVotePoolSuffix(result), false)
  const totals = result.rounds[0].firstPreferenceCounts
  assert.deepEqual(targetPctsForScoreboardRound(result.rounds[0], 'dowdall'), {
    a: 100,
    b: Math.round((100 * (totals.b ?? 0)) / (totals.a ?? 1)),
    c: Math.round((100 * (totals.c ?? 0)) / (totals.a ?? 1)),
  })
})

test('IRV result: multi-round vote-share bars', () => {
  const rankings = [
    ['a', 'b', 'c', 'd'],
    ['a', 'b', 'c', 'd'],
    ['b', 'a', 'c', 'd'],
    ['c', 'a', 'b', 'd'],
    ['d', 'a', 'b', 'c'],
  ]
  const result = runElection('irv', rankings, ['a', 'b', 'c', 'd'])
  assert.ok(result.rounds.length > 1)
  assert.equal(isBordaScoreboardResult(result), false)
  assert.equal(showVotePoolSuffix(result), true)
  const r0 = result.rounds[0]
  const pcts = targetPctsForScoreboardRound(r0, 'irv')
  assert.equal(pcts.a, Math.round((100 * (r0.firstPreferenceCounts.a ?? 0)) / (r0.ballotsWithVote ?? 1)))
})

test('Condorcet result: no replay; pairwise matrix on election result', () => {
  const rankings = [
    ['a', 'b', 'c'],
    ['a', 'c', 'b'],
    ['b', 'a', 'c'],
  ]
  const result = runElection('condorcet', rankings, ['a', 'b', 'c'])
  assert.equal(result.winnerId, 'a')
  assert.equal(shouldAnimateRoundsReplay(result), false)
  assert.equal(result.pairwiseMatrix?.cells.c.b, 'loss')

  const cycle = runCondorcet(
    [
      ['a', 'b', 'c'],
      ['b', 'c', 'a'],
      ['c', 'a', 'b'],
    ],
    ['a', 'b', 'c'],
  )
  assert.equal(shouldAnimateRoundsReplay({ ...cycle, votingMethod: 'condorcet' }), false)
  assert.equal(cycle.pairwiseMatrix?.cells.a.b, 'win')
})

test('Baldwin result: multi-round Borda points replay, not single scoreboard', () => {
  const rankings = [
    ['a', 'b', 'c'],
    ['a', 'b', 'c'],
    ['a', 'b', 'c'],
  ]
  const baldwin = runElection('baldwin', rankings, ['a', 'b', 'c'])
  const borda = runElection('borda', rankings, ['a', 'b', 'c'])
  assert.ok(baldwin.rounds.length >= 2)
  assert.equal(borda.rounds.length, 1)
  assert.equal(isBaldwinMultiRoundResult(baldwin), true)
  assert.equal(isBordaScoreboardResult(baldwin), false)
  assert.equal(showVotePoolSuffix(baldwin), false)
})

test('Coombs result: multi-round last-place replay', () => {
  const result = runElection(
    'coombs',
    [
      ['a', 'b'],
      ['a', 'b'],
      ['a', 'b'],
      ['b', 'a'],
    ],
    ['a', 'b'],
  )
  assert.equal(isCoombsScoreboardResult(result), true)
  assert.equal(isBordaScoreboardResult(result), false)
  assert.equal(showVotePoolSuffix(result), true)
  assert.equal(shouldAnimateRoundsReplay(result), true)
  const r0 = result.rounds[0]
  const counts = countsForScoreboardRound(r0, 'coombs')
  const pcts = targetPctsForScoreboardRound(r0, 'coombs')
  assert.equal(pcts.b, Math.round((100 * (counts.b ?? 0)) / (r0.ballotsWithVote ?? 1)))
})

test('Copeland result: no replay; pairwise matrix and copeland scores', () => {
  const result = runElection(
    'copeland',
    [
      ['a', 'b', 'c'],
      ['a', 'c', 'b'],
      ['b', 'a', 'c'],
    ],
    ['a', 'b', 'c'],
  )
  assert.equal(result.winnerId, 'a')
  assert.equal(shouldAnimateRoundsReplay(result), false)
  assert.equal(result.copelandScores?.a, 2)
  assert.equal(result.pairwiseMatrix?.cells.c.b, 'loss')
})

test('shouldAnimateRoundsReplay: Borda once, Condorcet skip, IRV multi', () => {
  const borda = runBorda(
    [
      ['a', 'b'],
      ['a', 'b'],
    ],
    ['a', 'b'],
  )
  assert.equal(shouldAnimateRoundsReplay({ ...borda, votingMethod: 'borda' }), true)

  const dowdall = runDowdall(
    [
      ['a', 'b'],
      ['a', 'b'],
    ],
    ['a', 'b'],
  )
  assert.equal(shouldAnimateRoundsReplay({ ...dowdall, votingMethod: 'dowdall' }), true)

  const irv = runIrv(
    [
      ['a', 'b', 'c'],
      ['b', 'a', 'c'],
      ['c', 'a', 'b'],
    ],
    ['a', 'b', 'c'],
  )
  assert.equal(shouldAnimateRoundsReplay({ ...irv, votingMethod: 'irv' }), true)

  const baldwin = runBaldwin(
    [
      ['a', 'b', 'c'],
      ['a', 'b', 'c'],
    ],
    ['a', 'b', 'c'],
  )
  assert.equal(shouldAnimateRoundsReplay({ ...baldwin, votingMethod: 'baldwin' }), true)

  assert.equal(
    shouldAnimateRoundsReplay({
      votingMethod: 'condorcet',
      rounds: [],
      winnerId: null,
      tieWinnerIds: ['a', 'b'],
    }),
    false,
  )

  assert.equal(
    shouldAnimateRoundsReplay({
      votingMethod: 'copeland',
      rounds: [],
      winnerId: 'a',
      tieWinnerIds: null,
      copelandScores: { a: 2, b: 0, c: -2 },
    }),
    false,
  )

  const coombs = runElection(
    'coombs',
    [
      ['a', 'b'],
      ['a', 'b'],
      ['a', 'b'],
      ['b', 'a'],
    ],
    ['a', 'b'],
  )
  assert.equal(shouldAnimateRoundsReplay(coombs), true)
  assert.equal(countsForScoreboardRound(coombs.rounds[0], 'coombs'), coombs.rounds[0].lastPlaceCounts)
  assert.equal(countsForScoreboardRound(coombs.rounds[0], 'irv').b, undefined)
})
