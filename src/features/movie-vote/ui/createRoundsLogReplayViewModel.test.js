import assert from 'node:assert/strict'
import test from 'node:test'
import { createRoundsLogReplayViewModel } from './createRoundsLogReplayViewModel.js'

const ballotMovies = [
  { publicId: 'a', title: 'Alpha', posterPath: '/a.jpg' },
  { publicId: 'b', title: 'Beta', posterPath: null },
]

test('replay view model shapes IRV round rows with bar targets and elimination ids', () => {
  const model = createRoundsLogReplayViewModel({
    electionOutcome: {
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
    },
    ballotMovies,
  })
  assert.equal(model.steps.length, 1)
  assert.equal(model.steps[0].headingKind, 'roundOfTotal')
  assert.equal(model.steps[0].totalRounds, 1)
  assert.deepEqual(model.steps[0].eliminatedIds, ['b'])
  assert.equal(model.steps[0].rows[0].id, 'a')
  assert.equal(model.steps[0].rows[0].votes, 2)
  assert.equal(model.steps[0].rows[0].barTargetPct, 67)
  assert.equal(model.steps[0].poolLabel, '3')
  assert.equal(model.steps[0].showPoolSuffix, true)
})

test('replay view model uses finalScores heading kind for borda', () => {
  const model = createRoundsLogReplayViewModel({
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
    ballotMovies,
  })
  assert.equal(model.steps[0].headingKind, 'finalScores')
  assert.equal(model.steps[0].showPoolSuffix, false)
})
