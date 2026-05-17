/**
 * @import './types.js'
 */

import { HOST_PARTICIPANT_ID, uniqueMoviesInPicks } from './core.js'
import { normalizeVotingMethod } from './votingMethod.js'

/**
 * @param {import('./types.js').MoviePick[]} picks
 */
function distinctSuggestedMovieCountFromPicks(picks) {
  return uniqueMoviesInPicks(picks)
}

/**
 * @param {{
 *   phase: import('./types.js').MovieVotePhase,
 *   readyToVote: boolean,
 *   myDraftPicks: import('./types.js').MoviePick[],
 *   ballotMovies: import('./types.js').BallotMovie[],
 *   ballotOrderIds: string[],
 *   voteProgress: { submitted: number, total: number } | null,
 *   irvResult: import('./irv.js').IrvResult | null,
 *   votingMethod: unknown,
 * }} store
 * @param {Map<string, { picks: import('./types.js').MoviePick[], ready: boolean }>} guestDrafts
 * @returns {import('./types.js').MovieVotePublicPayload}
 */
/**
 * @param {Map<string, { picks: import('./types.js').MoviePick[], ready: boolean }>} guestDrafts
 */
export function clearGuestDraftReadyFlags(guestDrafts) {
  for (const [pid, g] of guestDrafts) {
    guestDrafts.set(pid, { picks: g.picks, ready: false })
  }
}

export function buildMovieVotePublicPayload(store, guestDrafts) {
  const participants = [
    {
      id: HOST_PARTICIPANT_ID,
      ready: store.readyToVote,
      pickCount: store.myDraftPicks.length,
    },
  ]
  for (const [id, g] of guestDrafts) {
    participants.push({
      id,
      ready: g.ready,
      pickCount: g.picks.length,
    })
  }
  const suggest = store.phase === 'suggest'
  /** @type {import('./types.js').MoviePick[]} */
  const allPicks = [...store.myDraftPicks]
  for (const [, g] of guestDrafts) {
    for (const p of g.picks) allPicks.push(p)
  }
  return {
    phase: store.phase,
    participants,
    ballotMovies: suggest ? null : store.ballotMovies.map((m) => ({ ...m })),
    ballotOrderIds: suggest ? null : [...store.ballotOrderIds],
    voteProgress: store.voteProgress ? { ...store.voteProgress } : null,
    irvResult: store.irvResult,
    uniqueSuggestedMovieCount: suggest ? distinctSuggestedMovieCountFromPicks(allPicks) : 0,
    votingMethod: normalizeVotingMethod(store.votingMethod),
  }
}
