/**
 * Host quorum-list progress cue for one seat (suggest / voting). Not connection status.
 *
 * @param {{
 *   phase: import('./types.js').MovieVotePhase,
 *   pickCount?: number,
 *   ready?: boolean,
 *   quorumRequired?: boolean,
 *   hasVoted?: boolean,
 * }} args
 * @returns {{ icon: string, color: string, key: string } | null}
 */
export function participantProgressStatus(args) {
  const phase = args?.phase
  if (phase !== 'suggest' && phase !== 'voting') return null

  const quorumRequired = args.quorumRequired !== false
  const pickCount = typeof args.pickCount === 'number' && args.pickCount > 0 ? args.pickCount : 0

  if (phase === 'voting') {
    if (!quorumRequired) {
      return { icon: 'visibility', color: 'grey-5', key: 'watching' }
    }
    if (args.hasVoted) {
      return { icon: 'ballot', color: 'positive', key: 'voted' }
    }
    return { icon: 'ballot', color: 'grey-5', key: 'not_voted' }
  }

  if (quorumRequired && args.ready) {
    return { icon: 'how_to_vote', color: 'positive', key: 'ready' }
  }
  if (pickCount > 0) {
    return { icon: 'movie_edit', color: 'positive', key: 'has_picks' }
  }
  return { icon: 'movie_edit', color: 'grey-5', key: 'no_picks' }
}
