import assert from 'node:assert/strict'
import test from 'node:test'
import { createPairwiseMatrixViewModel } from './createPairwiseMatrixViewModel.js'

const ballotMovies = [
  { publicId: 'a', title: 'Alpha', posterPath: '/a.jpg' },
  { publicId: 'b', title: 'Beta', posterPath: null },
]

test('pairwise view model does not mount for IRV', () => {
  const model = createPairwiseMatrixViewModel({
    electionOutcome: {
      votingMethod: 'irv',
      winnerId: 'a',
      tieWinnerIds: null,
      rounds: [],
    },
    ballotMovies,
  })
  assert.equal(model.mount, false)
})

test('pairwise view model mounts condorcet matrix cells', () => {
  const model = createPairwiseMatrixViewModel({
    electionOutcome: {
      votingMethod: 'condorcet',
      winnerId: null,
      tieWinnerIds: ['a', 'b'],
      rounds: [],
      pairwiseMatrix: {
        candidateIds: ['a', 'b'],
        cells: { a: { b: 'tie' }, b: { a: 'tie' } },
      },
    },
    ballotMovies,
  })
  assert.equal(model.mount, true)
  assert.deepEqual(model.candidateIds, ['a', 'b'])
  assert.equal(model.cells?.a.b, 'tie')
  assert.equal(model.useCompactGrid, true)
})

test('pairwise view model includes copeland score rows with leader flags', () => {
  const model = createPairwiseMatrixViewModel({
    electionOutcome: {
      votingMethod: 'copeland',
      winnerId: 'a',
      tieWinnerIds: null,
      rounds: [],
      pairwiseMatrix: {
        candidateIds: ['a', 'b'],
        cells: { a: { b: 'win' }, b: { a: 'loss' } },
      },
      copelandScores: { a: 1, b: -1 },
    },
    ballotMovies,
  })
  assert.equal(model.mount, true)
  assert.equal(model.copelandScoreRows?.length, 2)
  assert.equal(model.copelandScoreRows?.[0].id, 'a')
  assert.equal(model.copelandScoreRows?.[0].score, 1)
  assert.equal(model.copelandScoreRows?.[0].isLeader, true)
})
