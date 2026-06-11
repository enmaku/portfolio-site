/**
 * Borda count (classic scale). Pure tally — no side effects.
 */

/**
 * @typedef {import('./electionOutcomeTypes.js').ElectionOutcome} BordaResult
 */

/**
 * @param {BordaResult | null | undefined} result
 * @returns {boolean}
 */
export function isDeclaredBordaTie(result) {
  return Array.isArray(result?.tieWinnerIds) && result.tieWinnerIds.length > 0
}

/**
 * Classic Borda points for zero-based rank position on an n-candidate ballot.
 * Top rank earns n−1; bottom earns 0.
 *
 * @param {number} positionIndex 0 = most preferred.
 * @param {number} candidateCount
 * @returns {number}
 */
export function bordaPointsForRank(positionIndex, candidateCount) {
  if (candidateCount <= 0) return 0
  return Math.max(0, candidateCount - 1 - positionIndex)
}

/**
 * @param {string[][]} rankings
 * @param {string[]} candidateIds
 * @returns {Record<string, number>}
 */
export function tallyBordaScores(rankings, candidateIds) {
  const n = candidateIds.length
  /** @type {Record<string, number>} */
  const totals = {}
  for (const id of candidateIds) totals[id] = 0

  for (const ranking of rankings) {
    for (let i = 0; i < ranking.length; i++) {
      const id = ranking[i]
      if (Object.hasOwn(totals, id)) {
        totals[id] += bordaPointsForRank(i, n)
      }
    }
  }

  return totals
}

/**
 * @param {string[][]} rankings
 * @param {string[]} candidateIds
 * @returns {BordaResult}
 */
export function runBorda(rankings, candidateIds) {
  if (candidateIds.length === 0) {
    return { rounds: [], winnerId: null, tieWinnerIds: [] }
  }

  const totals = tallyBordaScores(rankings, candidateIds)
  const activeIds = [...candidateIds]
  const ballotsWithVote = rankings.length

  /** @type {import('./electionOutcomeTypes.js').ElectionRoundLog} */
  const round = {
    firstPreferenceCounts: { ...totals },
    activeIds,
    ballotsWithVote,
    eliminatedIds: [],
  }

  if (candidateIds.length === 1) {
    return {
      rounds: [round],
      winnerId: candidateIds[0],
      tieWinnerIds: null,
    }
  }

  let maxScore = -Infinity
  for (const id of candidateIds) {
    maxScore = Math.max(maxScore, totals[id] ?? 0)
  }

  const leaders = candidateIds.filter((id) => (totals[id] ?? 0) === maxScore)

  if (leaders.length === 1) {
    return {
      rounds: [round],
      winnerId: leaders[0],
      tieWinnerIds: null,
    }
  }

  return {
    rounds: [round],
    winnerId: null,
    tieWinnerIds: [...leaders],
  }
}
