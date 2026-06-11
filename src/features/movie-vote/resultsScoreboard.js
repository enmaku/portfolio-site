/**
 * Pure helpers for results-phase scoreboard copy and bar targets.
 */

/**
 * @param {import('./electionOutcomeTypes.js').ElectionOutcome | null | undefined} result
 * @returns {boolean}
 */
export function isBordaScoreboardResult(result) {
  return result?.votingMethod === 'borda'
}

/**
 * @param {import('./electionOutcomeTypes.js').ElectionOutcome | null | undefined} result
 * @returns {boolean}
 */
export function isDowdallScoreboardResult(result) {
  return result?.votingMethod === 'dowdall'
}

/**
 * @param {import('./electionOutcomeTypes.js').ElectionOutcome | null | undefined} result
 * @returns {boolean}
 */
function isSinglePassPointsScoreboard(result) {
  return isBordaScoreboardResult(result) || isDowdallScoreboardResult(result)
}

/**
 * @param {import('./electionOutcomeTypes.js').ElectionOutcome | null | undefined} result
 * @returns {boolean}
 */
export function isBaldwinMultiRoundResult(result) {
  return result?.votingMethod === 'baldwin'
}

/**
 * @param {import('./electionOutcomeTypes.js').ElectionOutcome | null | undefined} result
 * @returns {boolean}
 */
export function isCoombsScoreboardResult(result) {
  return result?.votingMethod === 'coombs'
}

/**
 * @param {import('./electionOutcomeTypes.js').ElectionOutcome | null | undefined} result
 * @returns {string}
 */
export function scoreUnitForResult(result) {
  if (isBordaScoreboardResult(result)) return 'Borda points'
  if (isDowdallScoreboardResult(result)) return 'Dowdall points'
  if (isBaldwinMultiRoundResult(result)) return 'points'
  return 'votes'
}

/**
 * @param {import('./electionOutcomeTypes.js').ElectionRoundLog[]} rounds
 * @returns {number}
 */
export function totalRoundsForReplay(rounds) {
  return Math.max(1, rounds?.length ?? 0)
}

/**
 * @param {import('./electionOutcomeTypes.js').ElectionOutcome | null | undefined} result
 * @param {number} roundIdx zero-based index into `result.rounds`
 * @param {number} totalRounds from {@link totalRoundsForReplay}
 * @returns {string}
 */
export function replayHeadingForResult(result, roundIdx, totalRounds) {
  if (isBordaScoreboardResult(result)) return 'Final scores'
  if (isDowdallScoreboardResult(result)) return 'Dowdall scores'
  return `Round ${roundIdx + 1} of ${totalRounds}`
}

/**
 * Whether the animated multi-round replay runs (Borda: single pass; Condorcet/Copeland: skip).
 *
 * @param {import('./electionOutcomeTypes.js').ElectionOutcome | null | undefined} result
 * @returns {boolean}
 */
export function shouldAnimateRoundsReplay(result) {
  if (!result || result.votingMethod === 'condorcet' || result.votingMethod === 'copeland') {
    return false
  }
  return Array.isArray(result.rounds) && result.rounds.length > 0
}

/**
 * @param {import('./electionOutcomeTypes.js').ElectionRoundLog | null | undefined} round
 * @param {import('./votingMethod.js').VotingMethod | undefined} votingMethod
 * @returns {Record<string, number>}
 */
export function countsForScoreboardRound(round, votingMethod) {
  if (!round) return {}
  if (votingMethod === 'coombs') return round.lastPlaceCounts ?? {}
  return round.firstPreferenceCounts ?? {}
}

/**
 * Bar target %: IRV first-preference share, Coombs last-place share, or Borda points vs leader.
 *
 * @param {import('./electionOutcomeTypes.js').ElectionRoundLog | null | undefined} round
 * @param {import('./votingMethod.js').VotingMethod | undefined} votingMethod
 * @returns {Record<string, number>}
 */
export function targetPctsForScoreboardRound(round, votingMethod) {
  if (!round || !Array.isArray(round.activeIds) || !round.activeIds.length) return {}

  const counts = countsForScoreboardRound(round, votingMethod)

  /** @type {Record<string, number>} */
  const out = {}

  if (votingMethod === 'borda' || votingMethod === 'dowdall' || votingMethod === 'baldwin') {
    let maxScore = 0
    for (const id of round.activeIds) {
      maxScore = Math.max(maxScore, counts[id] ?? 0)
    }
    const denom = maxScore > 0 ? maxScore : 1
    for (const id of round.activeIds) {
      const points = counts[id] ?? 0
      out[id] = Math.min(100, Math.round((100 * points) / denom))
    }
    return out
  }

  const denom =
    typeof round.ballotsWithVote === 'number' && round.ballotsWithVote > 0
      ? round.ballotsWithVote
      : 1
  for (const id of round.activeIds) {
    const votes = counts[id] ?? 0
    out[id] = Math.min(100, Math.round((100 * votes) / denom))
  }
  return out
}

/**
 * @param {import('./electionOutcomeTypes.js').ElectionOutcome | null | undefined} result
 * @returns {boolean}
 */
export function showVotePoolSuffix(result) {
  return !isSinglePassPointsScoreboard(result) && !isBaldwinMultiRoundResult(result)
}
