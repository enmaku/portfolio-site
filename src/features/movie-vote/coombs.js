/**
 * Coombs method (textbook). Pure tally — no side effects.
 */

/**
 * @typedef {import('./irv.js').IrvResult} CoombsResult
 */

/**
 * @param {CoombsResult | null | undefined} result
 * @returns {boolean}
 */
export function isDeclaredCoombsTie(result) {
  return Array.isArray(result?.tieWinnerIds) && result.tieWinnerIds.length > 0
}

/**
 * Last preference among active candidates for one ballot ranking.
 * @param {string[]} ranking Most preferred first.
 * @param {Set<string>} active
 * @returns {string | null}
 */
export function currentLastPlaceForBallot(ranking, active) {
  for (let i = ranking.length - 1; i >= 0; i--) {
    const id = ranking[i]
    if (active.has(id)) return id
  }
  return null
}

/**
 * @param {string[][]} rankings
 * @param {Set<string>} active
 * @returns {{ lastPlaceCounts: Record<string, number>, ballotsWithVote: number }}
 */
export function countLastPlaces(rankings, active) {
  /** @type {Record<string, number>} */
  const lastPlaceCounts = {}
  for (const id of active) lastPlaceCounts[id] = 0

  let ballotsWithVote = 0
  for (const ballot of rankings) {
    const vote = currentLastPlaceForBallot(ballot, active)
    if (vote) {
      lastPlaceCounts[vote] = (lastPlaceCounts[vote] ?? 0) + 1
      ballotsWithVote++
    }
  }

  return { lastPlaceCounts, ballotsWithVote }
}

/**
 * @param {string[][]} rankings Each ballot: full ranking (permutation of candidate ids).
 * @param {string[]} candidateIds Stable list of all candidates (same ids as on ballot).
 * @returns {CoombsResult}
 */
export function runCoombs(rankings, candidateIds) {
  /** @type {import('./irv.js').IrvResult['rounds']} */
  const rounds = []
  const active = new Set(candidateIds)

  if (candidateIds.length === 0) {
    return { rounds, winnerId: null, tieWinnerIds: [] }
  }

  if (candidateIds.length === 1) {
    const only = candidateIds[0]
    const { lastPlaceCounts, ballotsWithVote } = countLastPlaces(rankings, active)
    rounds.push({
      lastPlaceCounts,
      activeIds: [only],
      ballotsWithVote,
      eliminatedIds: [],
    })
    return { rounds, winnerId: only, tieWinnerIds: null }
  }

  while (true) {
    const activeIds = [...active]
    const { lastPlaceCounts, ballotsWithVote } = countLastPlaces(rankings, active)

    if (active.size === 0) {
      rounds.push({
        lastPlaceCounts,
        activeIds,
        ballotsWithVote,
        eliminatedIds: [],
      })
      return { rounds, winnerId: null, tieWinnerIds: [] }
    }

    if (active.size === 1) {
      const winner = activeIds[0]
      rounds.push({
        lastPlaceCounts,
        activeIds,
        ballotsWithVote,
        eliminatedIds: [],
      })
      return { rounds, winnerId: winner, tieWinnerIds: null }
    }

    if (ballotsWithVote === 0) {
      rounds.push({
        lastPlaceCounts,
        activeIds,
        ballotsWithVote,
        eliminatedIds: [],
      })
      return { rounds, winnerId: null, tieWinnerIds: [...activeIds] }
    }

    let maxVotes = -1
    for (const id of active) {
      maxVotes = Math.max(maxVotes, lastPlaceCounts[id] ?? 0)
    }

    const tiedForMost = activeIds.filter((id) => (lastPlaceCounts[id] ?? 0) === maxVotes)

    if (tiedForMost.length === active.size) {
      rounds.push({
        lastPlaceCounts,
        activeIds,
        ballotsWithVote,
        eliminatedIds: [],
      })
      return { rounds, winnerId: null, tieWinnerIds: [...activeIds] }
    }

    for (const id of tiedForMost) active.delete(id)

    rounds.push({
      lastPlaceCounts,
      activeIds,
      ballotsWithVote,
      eliminatedIds: [...tiedForMost],
    })
  }
}
