/**
 * Dowdall method (harmonic scale). Pure tally — no side effects.
 */

/**
 * @typedef {import('./irv.js').IrvResult} DowdallResult
 */

/**
 * @param {DowdallResult | null | undefined} result
 * @returns {boolean}
 */
export function isDeclaredDowdallTie(result) {
  return Array.isArray(result?.tieWinnerIds) && result.tieWinnerIds.length > 0
}

/**
 * Harmonic points for zero-based rank position: 1, ½, ⅓, …
 *
 * @param {number} positionIndex 0 = most preferred.
 * @returns {number}
 */
export function dowdallPointsForRank(positionIndex) {
  if (positionIndex < 0) return 0
  return 1 / (positionIndex + 1)
}

/**
 * @param {string[][]} rankings
 * @param {string[]} candidateIds
 * @returns {Record<string, number>}
 */
export function tallyDowdallScores(rankings, candidateIds) {
  /** @type {Record<string, number>} */
  const totals = {}
  for (const id of candidateIds) totals[id] = 0

  for (const ranking of rankings) {
    for (let i = 0; i < ranking.length; i++) {
      const id = ranking[i]
      if (Object.hasOwn(totals, id)) {
        totals[id] += dowdallPointsForRank(i)
      }
    }
  }

  return totals
}

/**
 * @param {string[][]} rankings
 * @param {string[]} candidateIds
 * @returns {DowdallResult}
 */
export function runDowdall(rankings, candidateIds) {
  if (candidateIds.length === 0) {
    return { rounds: [], winnerId: null, tieWinnerIds: [] }
  }

  const totals = tallyDowdallScores(rankings, candidateIds)
  const activeIds = [...candidateIds]
  const ballotsWithVote = rankings.length

  /** @type {import('./irv.js').IrvRoundLog} */
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
