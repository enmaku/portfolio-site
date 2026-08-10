/**
 * @import './types.js'
 */

import { HOST_PARTICIPANT_ID, uniqueMoviesInPicks } from './core.js'
import { normalizeParticipantName } from './participantName.js'
import { normalizeVotingMethod } from './votingMethod.js'

/**
 * @param {import('./types.js').MoviePick[]} picks
 */
function distinctSuggestedMovieCountFromPicks(picks) {
  return uniqueMoviesInPicks(picks)
}

/**
 * Start-over / return to nominations: drop ready flags and guest movie picks.
 * Seat names and quorum requirement stay.
 *
 * @param {Map<string, { picks: import('./types.js').MoviePick[], ready: boolean, name?: string, quorumRequired?: boolean }>} guestDrafts
 */
export function resetGuestDraftsForSuggestRound(guestDrafts) {
  for (const [pid, g] of guestDrafts) {
    guestDrafts.set(pid, {
      picks: [],
      ready: false,
      name: typeof g.name === 'string' ? g.name : '',
      quorumRequired: g.quorumRequired !== false,
    })
  }
}

/**
 * @param {{
 *   phase: import('./types.js').MovieVotePhase,
 *   readyToVote: boolean,
 *   myDraftPicks: import('./types.js').MoviePick[],
 *   myParticipantName?: string,
 *   myQuorumRequired?: boolean,
 *   ballotMovies: import('./types.js').BallotMovie[],
 *   ballotOrderIds: string[],
 *   voterIds?: string[],
 *   votesByParticipant?: Record<string, string[]>,
 *   voteProgress: { submitted: number, total: number } | null,
 *   electionOutcome: import('./electionOutcomeTypes.js').ElectionOutcome | null,
 *   votingMethod: unknown,
 * }} store
 * @param {Map<string, { picks: import('./types.js').MoviePick[], ready: boolean, name?: string, quorumRequired?: boolean }>} guestDrafts
 * @returns {import('./types.js').MovieVotePublicPayload}
 */
export function buildMovieVotePublicPayload(store, guestDrafts) {
  const hostName = normalizeParticipantName(store.myParticipantName ?? '')
  const hostQuorum = store.myQuorumRequired !== false
  const participants = [
    {
      id: HOST_PARTICIPANT_ID,
      name: hostName,
      quorumRequired: hostQuorum,
      ready: hostQuorum ? store.readyToVote : false,
      pickCount: store.myDraftPicks.length,
    },
  ]
  for (const [id, g] of guestDrafts) {
    const name = normalizeParticipantName(g.name ?? '')
    if (!name) continue
    const quorumRequired = g.quorumRequired !== false
    participants.push({
      id,
      name,
      quorumRequired,
      ready: quorumRequired ? Boolean(g.ready) : false,
      pickCount: g.picks.length,
    })
  }
  const suggest = store.phase === 'suggest'
  /** @type {import('./types.js').MoviePick[]} */
  const allPicks = [...store.myDraftPicks]
  for (const [, g] of guestDrafts) {
    for (const p of g.picks) allPicks.push(p)
  }

  /** @type {{ submitted: number, total: number } | null} */
  let voteProgress = store.voteProgress ? { ...store.voteProgress } : null
  if (store.phase === 'voting') {
    const requiredIds = participants.filter((p) => p.quorumRequired).map((p) => p.id)
    const votes = store.votesByParticipant ?? {}
    const ballotLen = store.ballotOrderIds?.length ?? 0
    let submitted = 0
    for (const id of requiredIds) {
      const r = votes[id]
      if (r && r.length === ballotLen) submitted += 1
    }
    voteProgress = { submitted, total: requiredIds.length }
  }

  return {
    phase: store.phase,
    participants,
    ballotMovies: suggest ? null : store.ballotMovies.map((m) => ({ ...m })),
    ballotOrderIds: suggest ? null : [...store.ballotOrderIds],
    voteProgress,
    electionOutcome: store.electionOutcome,
    uniqueSuggestedMovieCount: suggest ? distinctSuggestedMovieCountFromPicks(allPicks) : 0,
    votingMethod: normalizeVotingMethod(store.votingMethod),
  }
}
