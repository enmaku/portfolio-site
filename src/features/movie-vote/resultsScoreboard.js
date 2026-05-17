/**
 * Pure helpers for results-phase scoreboard copy and bar targets.
 */

/**
 * @param {import('./irv.js').IrvResult | null | undefined} result
 * @returns {boolean}
 */
export function isBordaScoreboardResult(result) {
  return result?.votingMethod === 'borda'
}

/**
 * @param {import('./irv.js').IrvResult | null | undefined} result
 * @returns {'points' | 'votes'}
 */
export function scoreUnitForResult(result) {
  return isBordaScoreboardResult(result) ? 'points' : 'votes'
}

/**
 * @param {import('./irv.js').IrvRoundLog[]} rounds
 * @returns {number}
 */
export function totalRoundsForReplay(rounds) {
  return Math.max(1, rounds?.length ?? 0)
}

/**
 * @param {import('./irv.js').IrvResult | null | undefined} result
 * @param {number} roundIdx zero-based index into `result.rounds`
 * @param {number} totalRounds from {@link totalRoundsForReplay}
 * @returns {string}
 */
export function replayHeadingForResult(result, roundIdx, totalRounds) {
  if (isBordaScoreboardResult(result)) return 'Final scores'
  return `Round ${roundIdx + 1} of ${totalRounds}`
}

/**
 * Whether the animated multi-round replay runs (Borda: single pass; Condorcet: skip).
 *
 * @param {import('./irv.js').IrvResult | null | undefined} result
 * @returns {boolean}
 */
export function shouldAnimateRoundsReplay(result) {
  if (!result || result.votingMethod === 'condorcet') return false
  return Array.isArray(result.rounds) && result.rounds.length > 0
}

/**
 * Bar target %: IRV first-preference share, or Borda points relative to round leader.
 *
 * @param {import('./irv.js').IrvRoundLog | null | undefined} round
 * @param {import('./votingMethod.js').VotingMethod | undefined} votingMethod
 * @returns {Record<string, number>}
 */
export function targetPctsForScoreboardRound(round, votingMethod) {
  if (!round || !Array.isArray(round.activeIds) || !round.activeIds.length) return {}

  /** @type {Record<string, number>} */
  const out = {}

  if (votingMethod === 'borda') {
    let maxScore = 0
    for (const id of round.activeIds) {
      maxScore = Math.max(maxScore, round.firstPreferenceCounts[id] ?? 0)
    }
    const denom = maxScore > 0 ? maxScore : 1
    for (const id of round.activeIds) {
      const points = round.firstPreferenceCounts[id] ?? 0
      out[id] = Math.min(100, Math.round((100 * points) / denom))
    }
    return out
  }

  const denom =
    typeof round.ballotsWithVote === 'number' && round.ballotsWithVote > 0
      ? round.ballotsWithVote
      : 1
  for (const id of round.activeIds) {
    const votes = round.firstPreferenceCounts[id] ?? 0
    out[id] = Math.min(100, Math.round((100 * votes) / denom))
  }
  return out
}

/**
 * @param {import('./irv.js').IrvResult | null | undefined} result
 * @returns {boolean}
 */
export function showVotePoolSuffix(result) {
  return !isBordaScoreboardResult(result)
}
