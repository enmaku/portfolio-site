/**
 * @import '../features/movie-vote/types.js'
 * @import '../features/movie-vote/irv.js'
 */

import { defineStore, acceptHMRUpdate } from 'pinia'
import { HOST_PARTICIPANT_ID } from '../features/movie-vote/core.js'
import { runIrv } from '../features/movie-vote/irv.js'

/** @returns {MoviePick} */
function clonePick(p) {
  return {
    localId: p.localId,
    tmdbId: p.tmdbId,
    title: p.title,
    posterPath: p.posterPath,
    overview: p.overview,
    releaseDate: p.releaseDate,
  }
}

export const useMovieVoteStore = defineStore('movieVote', {
  state: () => ({
    /** @type {MovieVotePhase} */
    phase: 'suggest',
    displayName: 'You',
    /** @type {MoviePick[]} */
    myDraftPicks: [],
    readyToVote: false,
    /** @type {string | null} */
    myParticipantId: null,
    /** @type {MovieVoteParticipantSummary[]} */
    participants: [],
    /** @type {BallotMovie[]} */
    ballotMovies: [],
    /** @type {string[]} */
    ballotOrderIds: [],
    /** @type {string[]} */
    myRanking: [],
    myVoteSubmitted: false,
    /** @type {string[]} */
    voterIds: [],
    /** @type {Record<string, string[]>} */
    votesByParticipant: {},
    /** @type {import('../features/movie-vote/irv.js').IrvResult | null} */
    irvResult: null,
    /** @type {{ submitted: number, total: number } | null} */
    voteProgress: null,
  }),

  getters: {
    tmdbIdsInDraft(state) {
      return new Set(state.myDraftPicks.map((p) => p.tmdbId))
    },
  },

  actions: {
    setDisplayName(name) {
      const t = String(name ?? '').trim()
      this.displayName = t || 'You'
    },

    /** @param {MoviePick} pick */
    addDraftPick(pick) {
      if (this.myDraftPicks.some((p) => p.tmdbId === pick.tmdbId)) return
      this.myDraftPicks.push(clonePick(pick))
    },

    /** @param {string} localId */
    removeDraftPick(localId) {
      this.myDraftPicks = this.myDraftPicks.filter((p) => p.localId !== localId)
    },

    /** @param {MoviePick[]} ordered */
    reorderDraftPicks(ordered) {
      this.myDraftPicks = ordered.map(clonePick)
    },

    setReadyToVote(v) {
      this.readyToVote = Boolean(v)
    },

    setMyParticipantId(id) {
      this.myParticipantId = id
    },

    /** @param {MovieVoteParticipantSummary[]} list */
    setParticipants(list) {
      this.participants = list.map((x) => ({ ...x }))
    },

    /**
     * Apply host broadcast (guest or host refresh).
     * @param {import('../features/movie-vote/types.js').MovieVotePublicPayload} p
     */
    applyPublicPayload(p) {
      this.phase = p.phase
      this.participants = p.participants.map((x) => ({ ...x }))
      if (p.phase === 'suggest') {
        this.ballotMovies = []
        this.ballotOrderIds = []
        this.myRanking = []
        this.myVoteSubmitted = false
        this.voterIds = []
        this.votesByParticipant = {}
        this.irvResult = null
        this.voteProgress = null
      } else if (p.ballotMovies && p.ballotOrderIds) {
        this.ballotMovies = p.ballotMovies.map((m) => ({ ...m }))
        this.ballotOrderIds = [...p.ballotOrderIds]
        if (p.phase === 'voting' && !this.myVoteSubmitted) {
          this.myRanking = [...p.ballotOrderIds]
        }
      }
      if (p.voteProgress) {
        this.voteProgress = { ...p.voteProgress }
      }
      this.irvResult = p.irvResult ?? null
    },

    /** Host / solo: enter voting with compiled ballot */
    setVotingState(movies, orderIds, voterIds) {
      this.phase = 'voting'
      this.ballotMovies = movies.map((m) => ({ ...m }))
      this.ballotOrderIds = [...orderIds]
      this.myRanking = [...orderIds]
      this.myVoteSubmitted = false
      this.voterIds = [...voterIds]
      this.votesByParticipant = {}
      this.irvResult = null
      this.voteProgress = { submitted: 0, total: voterIds.length }
    },

    /** @param {string[]} ranking */
    setMyRanking(ranking) {
      if (this.myVoteSubmitted) return
      this.myRanking = [...ranking]
    },

    /** Host records own vote */
    submitMyVoteLocal(ranking) {
      const pid = this.myParticipantId ?? HOST_PARTICIPANT_ID
      this.votesByParticipant = { ...this.votesByParticipant, [pid]: [...ranking] }
      this.myVoteSubmitted = true
      this.myRanking = [...ranking]
      this._updateVoteProgress()
    },

    /** Guest: lock ballot UI after sending vote (host will confirm via state). */
    markVoteSubmitted() {
      this.myVoteSubmitted = true
    },

    /** Offline solo: one voter, tally immediately. */
    submitSoloVoteAndTally(ranking) {
      this.submitMyVoteLocal(ranking)
      const result = runIrv([ranking], [...this.ballotOrderIds])
      this.setResults(result)
    },

    /** Host merges guest vote */
    mergeGuestVote(participantId, ranking) {
      this.votesByParticipant = { ...this.votesByParticipant, [participantId]: [...ranking] }
      this._updateVoteProgress()
    },

    _updateVoteProgress() {
      const total = this.voterIds.length
      const submitted = this.voterIds.filter((id) => this.votesByParticipant[id]?.length).length
      this.voteProgress = { submitted, total }
    },

    /** @param {import('../features/movie-vote/irv.js').IrvResult} result */
    setResults(result) {
      this.phase = 'results'
      this.irvResult = result
    },

    resetForRoomExit() {
      this.phase = 'suggest'
      this.readyToVote = false
      this.myParticipantId = null
      this.participants = []
      this.ballotMovies = []
      this.ballotOrderIds = []
      this.myRanking = []
      this.myVoteSubmitted = false
      this.voterIds = []
      this.votesByParticipant = {}
      this.irvResult = null
      this.voteProgress = null
    },

    /** Solo: start over without clearing name */
    resetSessionSoft() {
      this.phase = 'suggest'
      this.readyToVote = false
      this.myDraftPicks = []
      this.participants = []
      this.ballotMovies = []
      this.ballotOrderIds = []
      this.myRanking = []
      this.myVoteSubmitted = false
      this.voterIds = []
      this.votesByParticipant = {}
      this.irvResult = null
      this.voteProgress = null
    },

    /** New vote: back to nominations (keeps display name). */
    resetToSuggest() {
      this.phase = 'suggest'
      this.readyToVote = false
      this.ballotMovies = []
      this.ballotOrderIds = []
      this.myRanking = []
      this.myVoteSubmitted = false
      this.voterIds = []
      this.votesByParticipant = {}
      this.irvResult = null
      this.voteProgress = null
      this.participants = []
    },
  },

  persist: {
    key: 'portfolio-movie-vote',
    pick: ['displayName', 'myDraftPicks'],
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMovieVoteStore, import.meta.hot))
}
