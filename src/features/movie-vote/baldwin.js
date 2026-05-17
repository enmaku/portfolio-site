/**
 * Baldwin method (Borda elimination). Pure tally — no side effects.
 */

import { bordaPointsForRank } from './borda.js'

/**
 * @typedef {import('./irv.js').IrvResult} BaldwinResult
 */

/**
 * @param {BaldwinResult | null | undefined} result
 * @returns {boolean}
 */
export function isDeclaredBaldwinTie(result) {
  return Array.isArray(result?.tieWinnerIds) && result.tieWinnerIds.length > 0
}

/**
 * Classic Borda on the active set only: each ballot awards points by rank among survivors.
 *
 * @param {string[][]} rankings
 * @param {string[]} activeIds
 * @returns {Record<string, number>}
 */
export function tallyBordaAmongActive(rankings, activeIds) {
  const active = new Set(activeIds)
  const n = activeIds.length
  /** @type {Record<string, number>} */
  const totals = {}
  for (const id of activeIds) totals[id] = 0

  for (const ranking of rankings) {
    /** @type {string[]} */
    const amongActive = []
    for (const id of ranking) {
      if (active.has(id)) amongActive.push(id)
    }
    for (let i = 0; i < amongActive.length; i++) {
      totals[amongActive[i]] += bordaPointsForRank(i, n)
    }
  }

  return totals
}

/**
 * @param {string[][]} rankings
 * @param {string[]} candidateIds
 * @returns {BaldwinResult}
 */
export function runBaldwin(rankings, candidateIds) {
  /** @type {import('./irv.js').IrvRoundLog[]} */
  const rounds = []
  const active = new Set(candidateIds)

  if (candidateIds.length === 0) {
    return { rounds, winnerId: null, tieWinnerIds: [] }
  }

  if (candidateIds.length === 1) {
    const only = candidateIds[0]
    const scores = tallyBordaAmongActive(rankings, [only])
    rounds.push({
      firstPreferenceCounts: scores,
      activeIds: [only],
      ballotsWithVote: rankings.length,
      eliminatedIds: [],
    })
    return { rounds, winnerId: only, tieWinnerIds: null }
  }

  while (true) {
    const activeIds = [...active]
    const scores = tallyBordaAmongActive(rankings, activeIds)
    const ballotsWithVote = rankings.length

    if (active.size === 0) {
      rounds.push({
        firstPreferenceCounts: scores,
        activeIds,
        ballotsWithVote,
        eliminatedIds: [],
      })
      return { rounds, winnerId: null, tieWinnerIds: [] }
    }

    if (active.size === 1) {
      const winner = activeIds[0]
      rounds.push({
        firstPreferenceCounts: scores,
        activeIds,
        ballotsWithVote,
        eliminatedIds: [],
      })
      return { rounds, winnerId: winner, tieWinnerIds: null }
    }

    let minScore = Infinity
    for (const id of active) {
      minScore = Math.min(minScore, scores[id] ?? 0)
    }

    const tiedForLast = activeIds.filter((id) => (scores[id] ?? 0) === minScore)

    if (tiedForLast.length === active.size) {
      rounds.push({
        firstPreferenceCounts: scores,
        activeIds,
        ballotsWithVote,
        eliminatedIds: [],
      })
      return { rounds, winnerId: null, tieWinnerIds: [...activeIds] }
    }

    for (const id of tiedForLast) active.delete(id)

    rounds.push({
      firstPreferenceCounts: scores,
      activeIds,
      ballotsWithVote,
      eliminatedIds: [...tiedForLast],
    })
  }
}
