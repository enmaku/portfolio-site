import assert from 'node:assert/strict'
import test from 'node:test'
import { createResultsSummaryViewModel } from './createResultsSummaryViewModel.js'

const ballotMovies = [
  { publicId: 'a', title: 'Alpha', posterPath: '/a.jpg' },
  { publicId: 'b', title: 'Beta', posterPath: null },
]

test('summary view model returns winner variant with poster path', () => {
  const model = createResultsSummaryViewModel({
    electionOutcome: {
      votingMethod: 'irv',
      winnerId: 'a',
      tieWinnerIds: null,
      rounds: [],
    },
    ballotMovies,
  })
  assert.equal(model.variant, 'winner')
  assert.equal(model.winnerId, 'a')
  assert.equal(model.winnerPosterPath, '/a.jpg')
})

test('summary view model returns declared tie with ordered co-winner ids', () => {
  const model = createResultsSummaryViewModel({
    electionOutcome: {
      votingMethod: 'irv',
      winnerId: null,
      tieWinnerIds: ['b', 'a'],
      rounds: [],
    },
    ballotMovies,
  })
  assert.equal(model.variant, 'declaredTie')
  assert.deepEqual(model.tieMovies?.map((m) => m.publicId), ['b', 'a'])
  assert.equal(model.tieMovies?.[1]?.posterPath, '/a.jpg')
})

test('summary view model returns empty without outcome', () => {
  const model = createResultsSummaryViewModel({
    electionOutcome: null,
    ballotMovies,
  })
  assert.equal(model.variant, 'empty')
})
