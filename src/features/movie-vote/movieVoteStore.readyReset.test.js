import assert from 'node:assert/strict'
import test from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { useMovieVoteStore } from '../../stores/movieVote.js'

test('applyPublicPayload: start-over from results wipes local picks when seat pickCount is 0', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  store.phase = 'results'
  store.readyToVote = true
  store.setMyParticipantId('guest-1')
  store.myDraftPicks = [
    {
      localId: '1',
      source: 'custom',
      tmdbId: null,
      customKey: 'old',
      title: 'Old',
      posterPath: null,
      overview: '',
    },
  ]

  store.applyPublicPayload({
    phase: 'suggest',
    participants: [{ id: 'guest-1', ready: false, pickCount: 0 }],
    ballotMovies: null,
    ballotOrderIds: null,
    voteProgress: null,
    electionOutcome: null,
    uniqueSuggestedMovieCount: 0,
    votingMethod: 'irv',
    suggestPicksByParticipant: { __host__: [] },
  })

  assert.equal(store.readyToVote, false)
  assert.deepEqual(store.myDraftPicks, [])
})

test('applyPublicPayload: results → voting with same ballot clears myVoteSubmitted', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  store.setMyParticipantId('guest-1')
  const movies = [
    {
      publicId: 'm-a',
      source: 'custom',
      tmdbId: null,
      customKey: 'a',
      title: 'A',
      posterPath: null,
      overview: '',
    },
    {
      publicId: 'm-b',
      source: 'custom',
      tmdbId: null,
      customKey: 'b',
      title: 'B',
      posterPath: null,
      overview: '',
    },
  ]
  store.setVotingState(movies, ['m-a', 'm-b'], ['__host__', 'guest-1'])
  store.submitVote(['m-b', 'm-a'])
  store.phase = 'results'
  store.electionOutcome = {
    votingMethod: 'irv',
    winnerId: 'm-b',
    tieWinnerIds: null,
    rounds: [],
  }
  assert.equal(store.myVoteSubmitted, true)

  store.applyPublicPayload({
    phase: 'voting',
    participants: [
      { id: '__host__', ready: true, pickCount: 1 },
      { id: 'guest-1', ready: true, pickCount: 1 },
    ],
    ballotMovies: movies,
    ballotOrderIds: ['m-a', 'm-b'],
    voteProgress: { submitted: 0, total: 2 },
    electionOutcome: null,
    uniqueSuggestedMovieCount: 0,
    votingMethod: 'irv',
  })

  assert.equal(store.phase, 'voting')
  assert.equal(store.myVoteSubmitted, false)
  assert.deepEqual(store.myRanking, ['m-a', 'm-b'])
})

test('applyPublicPayload: voting refresh with same ballot keeps myVoteSubmitted', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  store.setMyParticipantId('guest-1')
  const movies = [
    {
      publicId: 'm-a',
      source: 'custom',
      tmdbId: null,
      customKey: 'a',
      title: 'A',
      posterPath: null,
      overview: '',
    },
    {
      publicId: 'm-b',
      source: 'custom',
      tmdbId: null,
      customKey: 'b',
      title: 'B',
      posterPath: null,
      overview: '',
    },
  ]
  store.setVotingState(movies, ['m-a', 'm-b'], ['__host__', 'guest-1'])
  store.submitVote(['m-b', 'm-a'])

  store.applyPublicPayload({
    phase: 'voting',
    participants: [
      { id: '__host__', ready: true, pickCount: 1 },
      { id: 'guest-1', ready: true, pickCount: 1 },
    ],
    ballotMovies: movies,
    ballotOrderIds: ['m-a', 'm-b'],
    voteProgress: { submitted: 1, total: 2 },
    electionOutcome: null,
    uniqueSuggestedMovieCount: 0,
    votingMethod: 'irv',
  })

  assert.equal(store.myVoteSubmitted, true)
  assert.deepEqual(store.myRanking, ['m-b', 'm-a'])
})

test('applyPublicPayload: preserve-picks return keeps local picks from authority map', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  store.phase = 'results'
  store.readyToVote = true
  store.setMyParticipantId('guest-1')
  const mine = {
    localId: '1',
    source: 'custom',
    tmdbId: null,
    customKey: 'keep',
    title: 'Keep',
    posterPath: null,
    overview: '',
  }
  store.myDraftPicks = [mine]

  store.applyPublicPayload({
    phase: 'suggest',
    participants: [{ id: 'guest-1', ready: false, pickCount: 1 }],
    ballotMovies: null,
    ballotOrderIds: null,
    voteProgress: null,
    electionOutcome: null,
    uniqueSuggestedMovieCount: 1,
    votingMethod: 'irv',
    suggestPicksByParticipant: {
      __host__: [],
      'guest-1': [mine],
    },
  })

  assert.equal(store.readyToVote, false)
  assert.equal(store.myDraftPicks.length, 1)
  assert.equal(store.myDraftPicks[0]?.localId, '1')
  assert.equal(store.myDraftPicks[0]?.title, 'Keep')
})

test('applyPublicPayload: legacy irvResult inbound populates electionOutcome', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  const legacyOutcome = {
    votingMethod: 'irv',
    winnerId: 'movie-a',
    tieWinnerIds: null,
    rounds: [],
  }

  store.applyPublicPayload({
    phase: 'results',
    participants: [],
    ballotMovies: [],
    ballotOrderIds: [],
    voteProgress: null,
    irvResult: legacyOutcome,
    uniqueSuggestedMovieCount: 0,
    votingMethod: 'irv',
  })

  assert.deepEqual(store.electionOutcome, legacyOutcome)
})

test('applyPublicPayload: suggest refresh without leaving suggest keeps ready from row', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  store.phase = 'suggest'
  store.readyToVote = true
  store.setMyParticipantId('guest-1')

  store.applyPublicPayload({
    phase: 'suggest',
    participants: [{ id: 'guest-1', ready: true, pickCount: 1 }],
    ballotMovies: null,
    ballotOrderIds: null,
    voteProgress: null,
    electionOutcome: null,
    uniqueSuggestedMovieCount: 2,
    votingMethod: 'irv',
  })

  assert.equal(store.readyToVote, true)
})

test('applyPublicPayload: suggest with others picks does not clobber myDraftPicks', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  store.phase = 'suggest'
  store.setMyParticipantId('guest-1')
  const mine = {
    localId: 'mine',
    source: 'custom',
    tmdbId: null,
    customKey: 'mine',
    title: 'Mine',
    posterPath: null,
    overview: '',
  }
  store.myDraftPicks = [mine]
  const otherPick = {
    localId: 'other',
    source: 'custom',
    tmdbId: null,
    customKey: 'other',
    title: 'Other',
    posterPath: null,
    overview: '',
  }

  store.applyPublicPayload({
    phase: 'suggest',
    participants: [
      { id: '__host__', name: 'Host', quorumRequired: true, ready: false, pickCount: 1 },
      { id: 'guest-1', name: 'Sam', quorumRequired: true, ready: false, pickCount: 1 },
    ],
    ballotMovies: null,
    ballotOrderIds: null,
    voteProgress: null,
    electionOutcome: null,
    uniqueSuggestedMovieCount: 2,
    votingMethod: 'irv',
    suggestPicksByParticipant: {
      __host__: [otherPick],
      'guest-1': [mine],
    },
  })

  assert.deepEqual(store.myDraftPicks, [mine])
  assert.ok(store.othersDraftPicks?.length >= 1)
  assert.equal(
    store.othersDraftPicks.some((p) => p.localId === 'other' || p.title === 'Other'),
    true,
  )
})

test('returnToSuggestPreservePicks: from voting keeps myDraftPicks and clears ballot state', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  store.setMyParticipantId('__host__')
  const pick = {
    localId: '1',
    source: 'custom',
    tmdbId: null,
    customKey: 'keep',
    title: 'Keep',
    posterPath: null,
    overview: '',
  }
  store.myDraftPicks = [pick]
  store.setVotingState(
    [
      {
        publicId: 'a',
        source: 'custom',
        tmdbId: null,
        customKey: 'a',
        title: 'A',
        posterPath: null,
        overview: '',
      },
    ],
    ['a'],
    ['__host__'],
  )
  store.submitMyVoteLocal(['a'])
  store.electionOutcome = {
    votingMethod: 'irv',
    winnerId: 'a',
    tieWinnerIds: null,
    rounds: [],
  }

  store.returnToSuggestPreservePicks()

  assert.equal(store.phase, 'suggest')
  assert.deepEqual(store.myDraftPicks, [pick])
  assert.deepEqual(store.ballotOrderIds, [])
  assert.deepEqual(store.votesByParticipant, {})
  assert.equal(store.electionOutcome, null)
  assert.equal(store.myVoteSubmitted, false)
})

test('resetToSuggest still wipes myDraftPicks', () => {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  store.myDraftPicks = [
    {
      localId: '1',
      source: 'custom',
      tmdbId: null,
      customKey: 'gone',
      title: 'Gone',
      posterPath: null,
      overview: '',
    },
  ]
  store.resetToSuggest()
  assert.deepEqual(store.myDraftPicks, [])
  assert.equal(store.phase, 'suggest')
})
