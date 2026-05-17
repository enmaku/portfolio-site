/**
 * Run: node --test src/features/movie-vote/resultsScoreboard.test.js
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { runBorda } from './borda.js'
import { runCondorcet } from './condorcet.js'
import { runElection } from './election.js'
import { runIrv } from './irv.js'
import {
  isBordaScoreboardResult,
  replayHeadingForResult,
  scoreUnitForResult,
  shouldAnimateRoundsReplay,
  showVotePoolSuffix,
  targetPctsForScoreboardRound,
  totalRoundsForReplay,
} from './resultsScoreboard.js'

test('Borda result: single scoreboard copy and bar scale (table)', () => {
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
  assert.equal(scoreUnitForResult(result), 'points')
  assert.equal(showVotePoolSuffix(result), false)
  assert.equal(replayHeadingForResult(result, 0, totalRoundsForReplay(result.rounds)), 'Final scores')
  assert.equal(replayHeadingForResult(result, 99, 99), 'Final scores')
  assert.deepEqual(targetPctsForScoreboardRound(result.rounds[0], 'borda'), {
    a: 100,
    b: 25,
    c: 25,
  })
})

test('IRV result: multi-round heading and vote-share bars', () => {
  const rankings = [
    ['a', 'b', 'c', 'd'],
    ['a', 'b', 'c', 'd'],
    ['b', 'a', 'c', 'd'],
    ['c', 'a', 'b', 'd'],
    ['d', 'a', 'b', 'c'],
  ]
  const result = runElection('irv', rankings, ['a', 'b', 'c', 'd'])
  const total = totalRoundsForReplay(result.rounds)
  assert.ok(result.rounds.length > 1)
  assert.equal(isBordaScoreboardResult(result), false)
  assert.equal(scoreUnitForResult(result), 'votes')
  assert.equal(showVotePoolSuffix(result), true)
  assert.equal(replayHeadingForResult(result, 0, total), `Round 1 of ${total}`)
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

test('shouldAnimateRoundsReplay: Borda once, Condorcet skip, IRV multi', () => {
  const borda = runBorda(
    [
      ['a', 'b'],
      ['a', 'b'],
    ],
    ['a', 'b'],
  )
  assert.equal(shouldAnimateRoundsReplay({ ...borda, votingMethod: 'borda' }), true)

  const irv = runIrv(
    [
      ['a', 'b', 'c'],
      ['b', 'a', 'c'],
      ['c', 'a', 'b'],
    ],
    ['a', 'b', 'c'],
  )
  assert.equal(shouldAnimateRoundsReplay({ ...irv, votingMethod: 'irv' }), true)

  assert.equal(
    shouldAnimateRoundsReplay({
      votingMethod: 'condorcet',
      rounds: [],
      winnerId: null,
      tieWinnerIds: ['a', 'b'],
    }),
    false,
  )
})
