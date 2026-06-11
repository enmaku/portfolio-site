/**
 * @import '../features/movie-vote/types.js'
 */

import { defineStore, acceptHMRUpdate } from 'pinia'
import {
  clonePick,
  HOST_PARTICIPANT_ID,
  isRankingForBallot,
  pickDedupeKey,
} from '../features/movie-vote/core.js'
import { isDeclaredElectionTie } from '../features/movie-vote/election.js'
import { migrateLegacyPersistedElectionOutcome } from '../features/movie-vote/electionOutcomePersistMigration.js'
import {
  DEFAULT_VOTING_METHOD,
  normalizeVotingMethod,
} from '../features/movie-vote/votingMethod.js'

export const useMovieVoteStore = defineStore('movieVote', {
  state: () => ({
    /** @type {MovieVotePhase} */
    phase: 'suggest',
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
    /** @type {import('../features/movie-vote/electionOutcomeTypes.js').ElectionOutcome | null} */
    electionOutcome: null,
    /** @type {{ submitted: number, total: number } | null} */
    voteProgress: null,
    /** Distinct suggested movies in the room (host-computed; suggest phase). */
    uniqueSuggestedMovieCount: 0,
    /** @type {import('../features/movie-vote/votingMethod.js').VotingMethod} */
    votingMethod: DEFAULT_VOTING_METHOD,
    fullscreenEnabled: false,
  }),

  actions: {
    /** @param {MoviePick} pick */
    addDraftPick(pick) {
      const cloned = clonePick(pick)
      const key = pickDedupeKey(cloned)
      if (!key) return
      if (this.myDraftPicks.some((p) => pickDedupeKey(p) === key)) return
      this.myDraftPicks.push(cloned)
    },

    /** @param {string} localId */
    removeDraftPick(localId) {
      this.myDraftPicks = this.myDraftPicks.filter((p) => p.localId !== localId)
    },

    clearAllDraftPicks() {
      this.myDraftPicks = []
      this.readyToVote = false
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
      this.participants = list.map((x) => ({
        id: x.id,
        ready: Boolean(x.ready),
        pickCount: typeof x.pickCount === 'number' ? x.pickCount : 0,
      }))
    },

    /** @param {number} n */
    setUniqueSuggestedMovieCount(n) {
      this.uniqueSuggestedMovieCount =
        typeof n === 'number' && n >= 0 && Number.isFinite(n) ? Math.floor(n) : 0
    },

    /** @param {import('../features/movie-vote/votingMethod.js').VotingMethod} method */
    setVotingMethod(method) {
      if (this.phase !== 'suggest') return
      this.votingMethod = normalizeVotingMethod(method)
    },

    setFullscreenEnabled(value) {
      this.fullscreenEnabled = Boolean(value)
    },

    /**
     * Apply host broadcast (guest or host refresh).
     * @param {import('../features/movie-vote/types.js').MovieVotePublicPayload} p
     */
    applyPublicPayload(p) {
      const wasVoting = this.phase === 'voting'
      const wasResults = this.phase === 'results'
      this.phase = p.phase
      this.setParticipants(p.participants)
      if (p.phase === 'suggest') {
        this.ballotMovies = []
        this.ballotOrderIds = []
        this.myRanking = []
        this.myVoteSubmitted = false
        this.voterIds = []
        this.votesByParticipant = {}
        this.electionOutcome = null
        this.voteProgress = null
        if (wasVoting || wasResults) {
          this.readyToVote = false
        }
      } else if (p.ballotMovies && p.ballotOrderIds) {
        const incomingIds = [...p.ballotOrderIds]
        const prevIds = this.ballotOrderIds
        const ballotChanged =
          prevIds.length !== incomingIds.length || incomingIds.some((id, i) => id !== prevIds[i])

        this.ballotMovies = p.ballotMovies.map((m) => ({ ...m }))
        this.ballotOrderIds = incomingIds

        if (p.phase === 'voting' && ballotChanged) {
          this.myVoteSubmitted = false
        }
        if (p.phase === 'voting' && !this.myVoteSubmitted) {
          const enteringVoting = !wasVoting
          const rankingInvalid = !isRankingForBallot(this.myRanking, incomingIds)
          if (enteringVoting || ballotChanged || rankingInvalid) {
            this.myRanking = [...incomingIds]
          }
        }
      }
      if (p.voteProgress) {
        this.voteProgress = { ...p.voteProgress }
      }
      const electionOutcome = p.electionOutcome ?? p.irvResult ?? null
      this.electionOutcome = electionOutcome
      this.setUniqueSuggestedMovieCount(
        typeof p.uniqueSuggestedMovieCount === 'number' ? p.uniqueSuggestedMovieCount : 0,
      )
      this.votingMethod = normalizeVotingMethod(p.votingMethod)
      if (p.phase === 'results' && electionOutcome && !isDeclaredElectionTie(electionOutcome)) {
        this.myDraftPicks = []
      }
      const pid = this.myParticipantId
      if (pid) {
        const row = this.participants.find((x) => x.id === pid)
        if (row) this.setReadyToVote(row.ready)
      }
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
      this.electionOutcome = null
      this.voteProgress = { submitted: 0, total: voterIds.length }
      this.uniqueSuggestedMovieCount = 0
    },

    /** @param {string[]} ranking */
    setMyRanking(ranking) {
      if (this.myVoteSubmitted) return
      this.myRanking = [...ranking]
    },

    /**
     * Submit a full ballot ranking. Returns false without mutating when invalid.
     * Host merges locally; guest locks UI until host state confirms.
     * @param {string[]} ranking
     * @returns {boolean}
     */
    submitVote(ranking) {
      if (this.phase !== 'voting' || this.myVoteSubmitted) return false
      if (!isRankingForBallot(ranking, this.ballotOrderIds)) return false

      const pid = this.myParticipantId ?? HOST_PARTICIPANT_ID
      if (pid === HOST_PARTICIPANT_ID) {
        this.submitMyVoteLocal(ranking)
      } else {
        this.myRanking = [...ranking]
        this.markVoteSubmitted()
      }
      return true
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

    /** Host merges guest vote */
    mergeGuestVote(participantId, ranking) {
      this.votesByParticipant = { ...this.votesByParticipant, [participantId]: [...ranking] }
      this._updateVoteProgress()
    },

    /** Host: permanently remove a departed guest from the current voting state. */
    removeParticipantFromVote(participantId) {
      if (typeof participantId !== 'string' || !participantId) return
      const hadVoter = this.voterIds.includes(participantId)
      const hadVote = participantId in this.votesByParticipant
      if (!hadVoter && !hadVote) return

      this.voterIds = this.voterIds.filter((id) => id !== participantId)
      if (hadVote) {
        const rest = { ...this.votesByParticipant }
        delete rest[participantId]
        this.votesByParticipant = rest
      }
      this._updateVoteProgress()
    },

    _updateVoteProgress() {
      const total = this.voterIds.length
      const submitted = this.voterIds.filter((id) => this.votesByParticipant[id]?.length).length
      this.voteProgress = { submitted, total }
    },

    /** @param {import('../features/movie-vote/electionOutcomeTypes.js').ElectionOutcome} result */
    setElectionOutcome(result) {
      this.phase = 'results'
      this.electionOutcome = result
      if (!isDeclaredElectionTie(result)) {
        this.myDraftPicks = []
      }
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
      this.electionOutcome = null
      this.voteProgress = null
      this.uniqueSuggestedMovieCount = 0
      this.votingMethod = DEFAULT_VOTING_METHOD
    },

    /**
     * Clears ballot-phase state before joining/resuming a room. Draft picks are
     * the user's personal nominations and are intentionally preserved across
     * joins and refreshes — the host's welcome/state broadcast will bring the
     * rest of the ballot model back into sync.
     */
    resetSessionSoft() {
      this.phase = 'suggest'
      this.readyToVote = false
      this.participants = []
      this.ballotMovies = []
      this.ballotOrderIds = []
      this.myRanking = []
      this.myVoteSubmitted = false
      this.voterIds = []
      this.votesByParticipant = {}
      this.electionOutcome = null
      this.voteProgress = null
      this.uniqueSuggestedMovieCount = 0
    },

    /** New vote: back to nominations. */
    resetToSuggest() {
      this.phase = 'suggest'
      this.readyToVote = false
      this.ballotMovies = []
      this.ballotOrderIds = []
      this.myRanking = []
      this.myVoteSubmitted = false
      this.voterIds = []
      this.votesByParticipant = {}
      this.electionOutcome = null
      this.voteProgress = null
      this.participants = []
      this.uniqueSuggestedMovieCount = 0
    },
  },

  persist: {
    key: 'portfolio-movie-vote',
    pick: [
      'myDraftPicks',
      'phase',
      'readyToVote',
      'ballotMovies',
      'ballotOrderIds',
      'myRanking',
      'myVoteSubmitted',
      'voterIds',
      'votesByParticipant',
      'voteProgress',
      'electionOutcome',
      'votingMethod',
      'fullscreenEnabled',
    ],
    afterHydrate: (ctx) => {
      ctx.store.fullscreenEnabled = ctx.store.fullscreenEnabled === true
      migrateLegacyPersistedElectionOutcome(ctx.store)
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMovieVoteStore, import.meta.hot))
}
