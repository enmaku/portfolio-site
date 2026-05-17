/**
 * Run: node --test src/features/movie-vote/finishVoting.test.js
 *
 * Mirrors tryFinishVoting in p2p/session.js (facade + locked votingMethod).
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { useMovieVoteStore } from '../../stores/movieVote.js'
import { HOST_PARTICIPANT_ID } from './core.js'
import { runElection } from './election.js'
import { isBordaScoreboardResult, shouldAnimateRoundsReplay } from './resultsScoreboard.js'

/**
 * @param {string} publicId
 * @param {string} [title]
 */
function ballotMovie(publicId, title = publicId) {
  return {
    publicId,
    source: /** @type {const} */ ('custom'),
    tmdbId: null,
    customKey: title.toLowerCase(),
    title,
    posterPath: null,
    overview: '',
  }
}

/**
 * @param {ReturnType<typeof useMovieVoteStore>} store
 * @returns {boolean}
 */
function finishVotingIfComplete(store) {
  if (store.phase !== 'voting') return false
  const { voterIds, votesByParticipant, ballotOrderIds } = store
  if (!voterIds.length) return false
  for (const id of voterIds) {
    const r = votesByParticipant[id]
    if (!r || r.length !== ballotOrderIds.length) return false
  }
  const rankings = voterIds.map((id) => votesByParticipant[id])
  const result = runElection(store.votingMethod, rankings, [...ballotOrderIds])
  store.setResults(result)
  return true
}

test('finish path: waits until every voter has a full ranking', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  store.setMyParticipantId(HOST_PARTICIPANT_ID)
  store.setVotingState(
    [ballotMovie('a'), ballotMovie('b')],
    ['a', 'b'],
    [HOST_PARTICIPANT_ID, 'guest1'],
  )
  store.submitMyVoteLocal(['a', 'b'])
  assert.equal(finishVotingIfComplete(store), false)
  assert.equal(store.phase, 'voting')
})

test('finish path: IRV majority winner and first-preference replay', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  store.setMyParticipantId(HOST_PARTICIPANT_ID)
  store.setVotingState(
    [ballotMovie('a'), ballotMovie('b'), ballotMovie('c')],
    ['a', 'b', 'c'],
    [HOST_PARTICIPANT_ID, 'guest1'],
  )
  store.submitMyVoteLocal(['a', 'b', 'c'])
  store.mergeGuestVote('guest1', ['a', 'c', 'b'])
  assert.equal(finishVotingIfComplete(store), true)
  assert.equal(store.phase, 'results')
  assert.equal(store.irvResult?.winnerId, 'a')
  assert.equal(store.irvResult?.votingMethod, 'irv')
  assert.equal(store.irvResult?.rounds[0]?.firstPreferenceCounts?.a, 2)
  assert.deepEqual(store.irvResult?.rounds[0]?.eliminatedIds, [])
})

test('finish path: locked borda winner and single scoreboard round', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  store.setVotingMethod('borda')
  store.setMyParticipantId(HOST_PARTICIPANT_ID)
  store.setVotingState(
    [ballotMovie('a'), ballotMovie('b')],
    ['a', 'b'],
    [HOST_PARTICIPANT_ID, 'guest1'],
  )
  store.submitMyVoteLocal(['a', 'b'])
  store.mergeGuestVote('guest1', ['a', 'b'])
  assert.equal(finishVotingIfComplete(store), true)
  assert.equal(store.phase, 'results')
  assert.equal(store.irvResult?.votingMethod, 'borda')
  assert.equal(store.irvResult?.winnerId, 'a')
  assert.equal(store.irvResult?.rounds.length, 1)
  assert.equal(store.irvResult?.rounds[0]?.firstPreferenceCounts?.a, 2)
  assert.deepEqual(store.irvResult?.rounds[0]?.eliminatedIds, [])
  assert.equal(isBordaScoreboardResult(store.irvResult), true)
  assert.equal(shouldAnimateRoundsReplay(store.irvResult), true)
})

test('finish path: locked borda top tie', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  store.setVotingMethod('borda')
  store.setMyParticipantId(HOST_PARTICIPANT_ID)
  store.setVotingState([ballotMovie('a'), ballotMovie('b')], ['a', 'b'], [HOST_PARTICIPANT_ID, 'guest1'])
  store.submitMyVoteLocal(['a', 'b'])
  store.mergeGuestVote('guest1', ['b', 'a'])
  assert.equal(finishVotingIfComplete(store), true)
  assert.equal(store.irvResult?.winnerId, null)
  assert.deepEqual(new Set(store.irvResult?.tieWinnerIds ?? []), new Set(['a', 'b']))
})

test('finish path: locked condorcet winner and pairwise matrix on result', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  store.setVotingMethod('condorcet')
  store.setMyParticipantId(HOST_PARTICIPANT_ID)
  store.setVotingState(
    [ballotMovie('a'), ballotMovie('b'), ballotMovie('c')],
    ['a', 'b', 'c'],
    [HOST_PARTICIPANT_ID, 'guest1'],
  )
  store.submitMyVoteLocal(['a', 'b', 'c'])
  store.mergeGuestVote('guest1', ['a', 'c', 'b'])
  assert.equal(finishVotingIfComplete(store), true)
  assert.equal(store.phase, 'results')
  assert.equal(store.irvResult?.votingMethod, 'condorcet')
  assert.equal(store.irvResult?.winnerId, 'a')
  assert.equal(store.irvResult?.tieWinnerIds, null)
  assert.equal(store.irvResult?.rounds.length, 0)
  assert.equal(store.irvResult?.pairwiseMatrix?.cells.a.b, 'win')
})

test('finish path: locked condorcet cycle → Smith tie set and matrix', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  store.setVotingMethod('condorcet')
  store.setMyParticipantId(HOST_PARTICIPANT_ID)
  store.setVotingState(
    [ballotMovie('a'), ballotMovie('b'), ballotMovie('c')],
    ['a', 'b', 'c'],
    [HOST_PARTICIPANT_ID, 'guest1', 'guest2'],
  )
  store.submitMyVoteLocal(['a', 'b', 'c'])
  store.mergeGuestVote('guest1', ['b', 'c', 'a'])
  store.mergeGuestVote('guest2', ['c', 'a', 'b'])
  assert.equal(finishVotingIfComplete(store), true)
  assert.equal(store.irvResult?.winnerId, null)
  assert.deepEqual(new Set(store.irvResult?.tieWinnerIds ?? []), new Set(['a', 'b', 'c']))
  assert.equal(store.irvResult?.pairwiseMatrix?.candidateIds.length, 3)
})

test('finish path: legacy ranked-points method string runs IRV', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  store.votingMethod = /** @type {import('./votingMethod.js').VotingMethod} */ (
    /** @type {unknown} */ ('ranked-points')
  )
  store.setMyParticipantId(HOST_PARTICIPANT_ID)
  store.setVotingState([ballotMovie('x'), ballotMovie('y')], ['x', 'y'], [HOST_PARTICIPANT_ID])
  store.submitMyVoteLocal(['x', 'y'])
  assert.equal(finishVotingIfComplete(store), true)
  assert.equal(store.irvResult?.votingMethod, 'irv')
  assert.equal(store.irvResult?.winnerId, 'x')
})
