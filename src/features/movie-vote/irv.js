/**
 * Instant-runoff voting (textbook Hare IRV). Pure tally — no side effects.
 */

/**
 * @typedef {object} IrvRoundLog
 * @property {Record<string, number>} firstPreferenceCounts First-preference votes per active candidate (0 if none).
 * @property {string[]} activeIds Candidates still in the race at start of this round.
 * @property {number} ballotsWithVote Ballots expressing a first preference among active candidates.
 * @property {string[]} eliminatedIds Removed after this round (empty if election ended without elimination).
 */

/**
 * @typedef {object} IrvResult
 * @property {IrvRoundLog[]} rounds
 * @property {string | null} winnerId
 * @property {string[] | null} tieWinnerIds `null` if a single winner (or single-candidate trivial case); non-empty
 *   array for a **declared tie**; `[]` only when there are no candidates.
 * @property {import('./votingMethod.js').VotingMethod} [votingMethod]
 * @property {import('./condorcet.js').PairwiseMatrix} [pairwiseMatrix] Condorcet method only.
 */

/**
 * @param {IrvResult | null | undefined} result
 * @returns {boolean}
 */
export function isDeclaredIrvTie(result) {
  return Array.isArray(result?.tieWinnerIds) && result.tieWinnerIds.length > 0
}

/**
 * First preference among active candidates for one ballot ranking.
 * @param {string[]} ranking Most preferred first.
 * @param {Set<string>} active
 * @returns {string | null}
 */
export function currentVoteForBallot(ranking, active) {
  for (const id of ranking) {
    if (active.has(id)) return id
  }
  return null
}

/**
 * @param {string[][]} rankings
 * @param {Set<string>} active
 * @returns {{ firstPreferenceCounts: Record<string, number>, ballotsWithVote: number }}
 */
export function countFirstPreferences(rankings, active) {
  /** @type {Record<string, number>} */
  const firstPreferenceCounts = {}
  for (const id of active) firstPreferenceCounts[id] = 0

  let ballotsWithVote = 0
  for (const ballot of rankings) {
    const vote = currentVoteForBallot(ballot, active)
    if (vote) {
      firstPreferenceCounts[vote] = (firstPreferenceCounts[vote] ?? 0) + 1
      ballotsWithVote++
    }
  }

  return { firstPreferenceCounts, ballotsWithVote }
}

/**
 * @param {string[][]} rankings Each ballot: full ranking (permutation of candidate ids).
 * @param {string[]} candidateIds Stable list of all candidates (same ids as on ballot).
 * @returns {IrvResult}
 */
export function runIrv(rankings, candidateIds) {
  /** @type {IrvRoundLog[]} */
  const rounds = []
  const active = new Set(candidateIds)

  if (candidateIds.length === 0) {
    return { rounds, winnerId: null, tieWinnerIds: [] }
  }

  if (candidateIds.length === 1) {
    const only = candidateIds[0]
    const { firstPreferenceCounts, ballotsWithVote } = countFirstPreferences(rankings, active)
    rounds.push({
      firstPreferenceCounts,
      activeIds: [only],
      ballotsWithVote,
      eliminatedIds: [],
    })
    return { rounds, winnerId: only, tieWinnerIds: null }
  }

  while (true) {
    const activeIds = [...active]
    const { firstPreferenceCounts, ballotsWithVote } = countFirstPreferences(rankings, active)

    if (active.size === 0) {
      rounds.push({
        firstPreferenceCounts,
        activeIds,
        ballotsWithVote,
        eliminatedIds: [],
      })
      return { rounds, winnerId: null, tieWinnerIds: [] }
    }

    if (active.size === 1) {
      const winner = activeIds[0]
      rounds.push({
        firstPreferenceCounts,
        activeIds,
        ballotsWithVote,
        eliminatedIds: [],
      })
      return { rounds, winnerId: winner, tieWinnerIds: null }
    }

    if (ballotsWithVote === 0) {
      rounds.push({
        firstPreferenceCounts,
        activeIds,
        ballotsWithVote,
        eliminatedIds: [],
      })
      return { rounds, winnerId: null, tieWinnerIds: [...activeIds] }
    }

    let majorityWinner = null
    for (const id of active) {
      const n = firstPreferenceCounts[id] ?? 0
      if (n > ballotsWithVote / 2) {
        majorityWinner = id
        break
      }
    }

    if (majorityWinner) {
      rounds.push({
        firstPreferenceCounts,
        activeIds,
        ballotsWithVote,
        eliminatedIds: [],
      })
      return { rounds, winnerId: majorityWinner, tieWinnerIds: null }
    }

    let minVotes = Infinity
    for (const id of active) {
      minVotes = Math.min(minVotes, firstPreferenceCounts[id] ?? 0)
    }

    const tiedForLast = activeIds.filter((id) => (firstPreferenceCounts[id] ?? 0) === minVotes)

    if (tiedForLast.length === active.size) {
      rounds.push({
        firstPreferenceCounts,
        activeIds,
        ballotsWithVote,
        eliminatedIds: [],
      })
      return { rounds, winnerId: null, tieWinnerIds: [...activeIds] }
    }

    for (const id of tiedForLast) active.delete(id)

    rounds.push({
      firstPreferenceCounts,
      activeIds,
      ballotsWithVote,
      eliminatedIds: [...tiedForLast],
    })
  }
}
