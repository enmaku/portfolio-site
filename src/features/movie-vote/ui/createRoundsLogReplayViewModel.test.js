import assert from 'node:assert/strict'
import test from 'node:test'
import { createRoundsLogReplayViewModel } from './createRoundsLogReplayViewModel.js'

const ballotMovies = [
  { publicId: 'a', title: 'Alpha', posterPath: '/a.jpg' },
  { publicId: 'b', title: 'Beta', posterPath: null },
]

const irvElectionOutcome = {
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

test('replay view model shapes IRV round rows with bar targets and elimination ids', () => {
  const model = createRoundsLogReplayViewModel({
    electionOutcome: irvElectionOutcome,
    ballotMovies,
  })
  assert.equal(model.steps.length, 1)
  assert.equal(model.replayKey, 'b@1')
  assert.match(model.steps[0].heading, /^Round \d+ of \d+$/)
  assert.deepEqual(model.steps[0].eliminatedIds, ['b'])
  assert.equal(model.steps[0].rows[0].id, 'a')
  assert.equal(model.steps[0].rows[0].votes, 2)
  assert.equal(model.steps[0].rows[0].barTargetPct, 67)
  assert.equal(model.steps[0].poolLabel, '3')
  assert.equal(model.steps[0].showPoolSuffix, true)
})

test('replay view model uses final scores heading for borda', () => {
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
  assert.equal(model.steps[0].heading.length > 0, true)
  assert.equal(model.steps[0].showPoolSuffix, false)
})

test('replayKey is stable when only ballot movie poster paths change', () => {
  const before = createRoundsLogReplayViewModel({
    electionOutcome: irvElectionOutcome,
    ballotMovies,
  })
  const after = createRoundsLogReplayViewModel({
    electionOutcome: irvElectionOutcome,
    ballotMovies: [
      { publicId: 'a', title: 'Alpha', posterPath: '/updated.jpg' },
      { publicId: 'b', title: 'Beta', posterPath: '/b-new.jpg' },
    ],
  })
  assert.equal(before.replayKey, after.replayKey)
  assert.notEqual(before.steps[0].rows[0].posterPath, after.steps[0].rows[0].posterPath)
})
