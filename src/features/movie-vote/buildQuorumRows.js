/**
 * @import './types.js'
 */

import { HOST_PARTICIPANT_ID } from './core.js'
import { participantProgressStatus } from './participantProgressStatus.js'

/**
 * @typedef {object} MovieVoteQuorumRow
 * @property {string} id
 * @property {string} name
 * @property {boolean} quorumRequired
 * @property {boolean} isHost
 * @property {{ key: string } | null} progress
 */

/**
 * Host quorum-list view model (suggest / voting).
 *
 * @param {{
 *   phase: import('./types.js').MovieVotePhase,
 *   participants: import('./types.js').MovieVoteParticipantSummary[],
 *   voterIds?: string[],
 *   votesByParticipant?: Record<string, string[]>,
 *   ballotOrderIds?: string[],
 * }} args
 * @returns {MovieVoteQuorumRow[]}
 */
export function buildQuorumRows(args) {
  const phase = args.phase
  const ballotLen = args.ballotOrderIds?.length ?? 0
  const votes = args.votesByParticipant ?? {}
  const voters = args.voterIds ?? []
  const voterSet = new Set(voters)
  return (args.participants ?? []).map((p) => {
    const quorumRequired = p.quorumRequired !== false
    const countsAsVoter =
      phase === 'voting' && voters.length > 0 ? voterSet.has(p.id) : quorumRequired
    const hasVoted =
      Array.isArray(votes[p.id]) && votes[p.id].length === ballotLen && ballotLen > 0
    return {
      id: p.id,
      name: p.name,
      quorumRequired,
      isHost: p.id === HOST_PARTICIPANT_ID,
      progress: participantProgressStatus({
        phase,
        pickCount: p.pickCount,
        ready: p.ready,
        quorumRequired: countsAsVoter,
        hasVoted,
      }),
    }
  })
}
