import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMovieVotePublicPayload, clearGuestDraftReadyFlags } from './publicPayload.js'
import { DEFAULT_VOTING_METHOD } from './votingMethod.js'

test('public payload includes voting method from room store', () => {
  const payload = buildMovieVotePublicPayload(
    {
      phase: 'suggest',
      readyToVote: false,
      myDraftPicks: [],
      ballotMovies: [],
      ballotOrderIds: [],
      voteProgress: null,
      irvResult: null,
      votingMethod: 'borda',
    },
    new Map(),
  )
  assert.equal(payload.votingMethod, 'borda')
})

test('public payload carries Borda irvResult for guests', () => {
  const bordaResult = {
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
  }
  const payload = buildMovieVotePublicPayload(
    {
      phase: 'results',
      readyToVote: false,
      myDraftPicks: [],
      ballotMovies: [],
      ballotOrderIds: [],
      voteProgress: null,
      irvResult: bordaResult,
      votingMethod: 'borda',
    },
    new Map(),
  )
  assert.equal(payload.phase, 'results')
  assert.equal(payload.irvResult?.votingMethod, 'borda')
  assert.equal(payload.irvResult?.winnerId, 'a')
  assert.equal(payload.irvResult?.rounds.length, 1)
})

test('public payload defaults voting method when store value is invalid', () => {
  const payload = buildMovieVotePublicPayload(
    {
      phase: 'suggest',
      readyToVote: false,
      myDraftPicks: [],
      ballotMovies: [],
      ballotOrderIds: [],
      voteProgress: null,
      irvResult: null,
      votingMethod: 'legacy-hybrid',
    },
    new Map(),
  )
  assert.equal(payload.votingMethod, DEFAULT_VOTING_METHOD)
})

test('clearGuestDraftReadyFlags clears ready on every guest draft', () => {
  const guestDrafts = new Map([
    ['g1', { picks: [{ localId: '1', title: 'A', source: 'custom' }], ready: true }],
    ['g2', { picks: [], ready: true }],
  ])
  clearGuestDraftReadyFlags(guestDrafts)
  assert.equal(guestDrafts.get('g1')?.ready, false)
  assert.equal(guestDrafts.get('g2')?.ready, false)
  assert.equal(guestDrafts.get('g1')?.picks.length, 1)
})

test('buildMovieVotePublicPayload reflects cleared guest ready flags', () => {
  const guestDrafts = new Map([['g1', { picks: [], ready: true }]])
  clearGuestDraftReadyFlags(guestDrafts)
  const payload = buildMovieVotePublicPayload(
    {
      phase: 'suggest',
      readyToVote: false,
      myDraftPicks: [],
      ballotMovies: [],
      ballotOrderIds: [],
      voteProgress: null,
      irvResult: null,
      votingMethod: 'irv',
    },
    guestDrafts,
  )
  assert.equal(payload.participants.find((p) => p.id === 'g1')?.ready, false)
})
