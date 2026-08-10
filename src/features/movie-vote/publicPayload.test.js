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
      electionOutcome: null,
      votingMethod: 'borda',
    },
    new Map(),
  )
  assert.equal(payload.votingMethod, 'borda')
})

test('public payload carries Dowdall electionOutcome for guests', () => {
  const dowdallResult = {
    votingMethod: 'dowdall',
    winnerId: 'a',
    tieWinnerIds: null,
    rounds: [
      {
        firstPreferenceCounts: { a: 1.5, b: 0.5 },
        activeIds: ['a', 'b'],
        ballotsWithVote: 1,
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
      electionOutcome: dowdallResult,
      votingMethod: 'dowdall',
    },
    new Map(),
  )
  assert.equal(payload.electionOutcome?.votingMethod, 'dowdall')
  assert.equal(payload.electionOutcome?.rounds[0]?.firstPreferenceCounts?.a, 1.5)
})

test('public payload carries Borda electionOutcome for guests', () => {
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
      electionOutcome: bordaResult,
      votingMethod: 'borda',
    },
    new Map(),
  )
  assert.equal(payload.phase, 'results')
  assert.equal(payload.electionOutcome?.votingMethod, 'borda')
  assert.equal(payload.electionOutcome?.winnerId, 'a')
  assert.equal(payload.electionOutcome?.rounds.length, 1)
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
      electionOutcome: null,
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
  const guestDrafts = new Map([['g1', { picks: [], ready: true, name: 'Guest', quorumRequired: true }]])
  clearGuestDraftReadyFlags(guestDrafts)
  const payload = buildMovieVotePublicPayload(
    {
      phase: 'suggest',
      readyToVote: false,
      myDraftPicks: [],
      myParticipantName: 'Host',
      myQuorumRequired: true,
      ballotMovies: [],
      ballotOrderIds: [],
      voteProgress: null,
      electionOutcome: null,
      votingMethod: 'irv',
    },
    guestDrafts,
  )
  assert.equal(payload.participants.find((p) => p.id === 'g1')?.ready, false)
})

test('public payload participant summaries include name and quorumRequired', () => {
  const guestDrafts = new Map([
    ['g1', { picks: [{ localId: '1', title: 'A', source: 'custom' }], ready: true, name: 'Sam', quorumRequired: false }],
    ['g2', { picks: [], ready: false, name: 'Alex', quorumRequired: true }],
  ])
  const payload = buildMovieVotePublicPayload(
    {
      phase: 'suggest',
      readyToVote: true,
      myDraftPicks: [],
      myParticipantName: 'Dana',
      myQuorumRequired: true,
      ballotMovies: [],
      ballotOrderIds: [],
      voteProgress: null,
      electionOutcome: null,
      votingMethod: 'irv',
    },
    guestDrafts,
  )
  const host = payload.participants.find((p) => p.id === '__host__')
  const sam = payload.participants.find((p) => p.id === 'g1')
  const alex = payload.participants.find((p) => p.id === 'g2')
  assert.equal(host?.name, 'Dana')
  assert.equal(host?.quorumRequired, true)
  assert.equal(sam?.name, 'Sam')
  assert.equal(sam?.quorumRequired, false)
  assert.equal(sam?.ready, false, 'optional seats never publish ready')
  assert.equal(sam?.pickCount, 1)
  assert.equal(alex?.name, 'Alex')
  assert.equal(alex?.quorumRequired, true)
})

test('public payload host ready is false when host quorum is off', () => {
  const payload = buildMovieVotePublicPayload(
    {
      phase: 'suggest',
      readyToVote: true,
      myDraftPicks: [],
      myParticipantName: 'Dana',
      myQuorumRequired: false,
      ballotMovies: [],
      ballotOrderIds: [],
      voteProgress: null,
      electionOutcome: null,
      votingMethod: 'irv',
    },
    new Map(),
  )
  const host = payload.participants.find((p) => p.id === '__host__')
  assert.equal(host?.quorumRequired, false)
  assert.equal(host?.ready, false)
})

test('public payload omits guest drafts with empty names', () => {
  const guestDrafts = new Map([
    ['g1', { picks: [], ready: false, name: '', quorumRequired: true }],
    ['g2', { picks: [], ready: false, name: 'Sam', quorumRequired: true }],
  ])
  const payload = buildMovieVotePublicPayload(
    {
      phase: 'suggest',
      readyToVote: false,
      myDraftPicks: [],
      myParticipantName: 'Dana',
      myQuorumRequired: true,
      ballotMovies: [],
      ballotOrderIds: [],
      voteProgress: null,
      electionOutcome: null,
      votingMethod: 'irv',
    },
    guestDrafts,
  )
  assert.deepEqual(
    payload.participants.map((p) => p.id),
    ['__host__', 'g2'],
  )
})

test('public payload voteProgress total counts only quorum-required seats', () => {
  const payload = buildMovieVotePublicPayload(
    {
      phase: 'voting',
      readyToVote: true,
      myDraftPicks: [],
      myParticipantName: 'Dana',
      myQuorumRequired: true,
      ballotMovies: [
        {
          publicId: 'a',
          source: 'custom',
          tmdbId: null,
          title: 'A',
          posterPath: null,
          overview: '',
        },
      ],
      ballotOrderIds: ['a'],
      voterIds: ['__host__', 'g2'],
      votesByParticipant: { __host__: ['a'] },
      voteProgress: { submitted: 1, total: 3 },
      electionOutcome: null,
      votingMethod: 'irv',
    },
    new Map([
      ['g1', { picks: [], ready: true, name: 'Sam', quorumRequired: false }],
      ['g2', { picks: [], ready: true, name: 'Alex', quorumRequired: true }],
    ]),
  )
  assert.deepEqual(payload.voteProgress, { submitted: 1, total: 2 })
})
