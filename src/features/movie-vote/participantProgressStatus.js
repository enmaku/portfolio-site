/**
 * Host quorum-list progress cue key for one seat (suggest / voting). Not connection status.
 * Icon/color mapping lives in the Vue layer.
 *
 * @param {{
 *   phase: import('./types.js').MovieVotePhase,
 *   pickCount?: number,
 *   ready?: boolean,
 *   quorumRequired?: boolean,
 *   hasVoted?: boolean,
 * }} args
 * @returns {{ key: string } | null}
 */
export function participantProgressStatus(args) {
  const phase = args?.phase
  if (phase !== 'suggest' && phase !== 'voting') return null

  const quorumRequired = args.quorumRequired !== false
  const pickCount = typeof args.pickCount === 'number' && args.pickCount > 0 ? args.pickCount : 0

  if (phase === 'voting') {
    if (!quorumRequired) {
      return { key: 'watching' }
    }
    if (args.hasVoted) {
      return { key: 'voted' }
    }
    return { key: 'not_voted' }
  }

  if (quorumRequired && args.ready) {
    return { key: 'ready' }
  }
  if (pickCount > 0) {
    return { key: 'has_picks' }
  }
  return { key: 'no_picks' }
}
