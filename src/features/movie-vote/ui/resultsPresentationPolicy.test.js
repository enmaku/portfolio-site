import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveResultsPresentation } from './resultsPresentationPolicy.js'

const irvOutcome = {
  votingMethod: 'irv',
  winnerId: 'a',
  tieWinnerIds: null,
  rounds: [
    {
      firstPreferenceCounts: { a: 2, b: 1 },
      activeIds: ['a', 'b'],
      ballotsWithVote: 3,
      eliminatedIds: ['b'],
    },
  ],
}

const condorcetOutcome = {
  votingMethod: 'condorcet',
  winnerId: null,
  tieWinnerIds: ['a', 'b'],
  rounds: [],
  pairwiseMatrix: { candidateIds: ['a', 'b'], cells: { a: { b: 'tie' }, b: { a: 'tie' } } },
}

test('no election outcome mounts nothing', () => {
  const p = resolveResultsPresentation({
    votingMethod: 'irv',
    electionOutcome: null,
    roomAuthoritySeq: 5,
    lastReplayedSeq: null,
  })
  assert.equal(p.shouldAnimateReplay, false)
  assert.equal(p.showResultsSummaryNow, false)
  assert.equal(p.showPairwiseMatrixNow, false)
})

test('condorcet skips replay and shows summary and pairwise immediately', () => {
  const p = resolveResultsPresentation({
    votingMethod: 'condorcet',
    electionOutcome: condorcetOutcome,
    roomAuthoritySeq: 3,
    lastReplayedSeq: null,
  })
  assert.equal(p.shouldAnimateReplay, false)
  assert.equal(p.showResultsSummaryNow, true)
  assert.equal(p.showPairwiseMatrixNow, true)
})

test('copeland skips replay and shows summary and pairwise immediately', () => {
  const p = resolveResultsPresentation({
    votingMethod: 'copeland',
    electionOutcome: {
      ...condorcetOutcome,
      votingMethod: 'copeland',
      copelandScores: { a: 0, b: 0 },
    },
    roomAuthoritySeq: 3,
    lastReplayedSeq: null,
  })
  assert.equal(p.shouldAnimateReplay, false)
  assert.equal(p.showResultsSummaryNow, true)
  assert.equal(p.showPairwiseMatrixNow, true)
})

test('IRV fresh commit with authority seq runs replay and defers summary', () => {
  const p = resolveResultsPresentation({
    votingMethod: 'irv',
    electionOutcome: irvOutcome,
    roomAuthoritySeq: 7,
    lastReplayedSeq: null,
  })
  assert.equal(p.shouldAnimateReplay, true)
  assert.equal(p.showResultsSummaryNow, false)
  assert.equal(p.showPairwiseMatrixNow, false)
})

test('IRV re-enter with same authority seq skips replay', () => {
  const p = resolveResultsPresentation({
    votingMethod: 'irv',
    electionOutcome: irvOutcome,
    roomAuthoritySeq: 7,
    lastReplayedSeq: 7,
  })
  assert.equal(p.shouldAnimateReplay, false)
  assert.equal(p.showResultsSummaryNow, true)
  assert.equal(p.showPairwiseMatrixNow, false)
})

test('IRV without authority seq shows summary immediately without replay', () => {
  const p = resolveResultsPresentation({
    votingMethod: 'irv',
    electionOutcome: irvOutcome,
    roomAuthoritySeq: null,
    lastReplayedSeq: null,
  })
  assert.equal(p.shouldAnimateReplay, false)
  assert.equal(p.showResultsSummaryNow, true)
})

test('borda single-round replay defers summary on fresh commit', () => {
  const p = resolveResultsPresentation({
    votingMethod: 'borda',
    electionOutcome: {
      votingMethod: 'borda',
      winnerId: 'a',
      tieWinnerIds: null,
      rounds: [
        {
          firstPreferenceCounts: { a: 4, b: 2 },
          activeIds: ['a', 'b'],
          ballotsWithVote: 2,
          eliminatedIds: [],
        },
      ],
    },
    roomAuthoritySeq: 2,
    lastReplayedSeq: null,
  })
  assert.equal(p.shouldAnimateReplay, true)
  assert.equal(p.showResultsSummaryNow, false)
})
