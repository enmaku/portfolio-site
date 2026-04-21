/**
 * Instant-runoff voting (single-winner RCV). Pure tally — no side effects.
 */

/**
 * @typedef {object} IrvRoundLog
 * @property {Record<string, number>} counts Votes per **active** candidate id this round (0 if none).
 * @property {string[]} activeIds Candidates still in the race at start of this round.
 * @property {number} ballotsWithVote Ballots contributing a vote this round.
 * @property {string[]} [eliminatedIds] Single id removed after this round (empty if election ended without elimination).
 */

/**
 * @typedef {object} IrvResult
 * @property {IrvRoundLog[]} rounds
 * @property {string | null} winnerId
 * @property {string[] | null} tieWinnerIds `null` if a single winner (or single-candidate trivial case); non-empty
 *   array for a declared tie; `[]` only when there are no candidates.
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
 * Among candidates tied for elimination, pick exactly one (deterministic).
 * Uses position on the ballot list: later index is eliminated first so the
 * order matches a stable reading of the published ballot.
 * @param {string[]} tiedIds
 * @param {string[]} candidateIds
 */
export function pickSingleElimination(tiedIds, candidateIds) {
  const index = new Map(candidateIds.map((id, i) => [id, i]))
  let pick = tiedIds[0]
  let pickI = index.get(pick) ?? -1
  for (const id of tiedIds) {
    const i = index.get(id) ?? -1
    if (i > pickI) {
      pickI = i
      pick = id
    }
  }
  return pick
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
    rounds.push({
      counts: { [only]: rankings.length },
      activeIds: [only],
      ballotsWithVote: rankings.length,
      eliminatedIds: [],
    })
    return { rounds, winnerId: only, tieWinnerIds: null }
  }

  while (true) {
    /** @type {Map<string, number>} */
    const counts = new Map()
    for (const id of active) counts.set(id, 0)

    let ballotsWithVote = 0
    for (const ballot of rankings) {
      const v = currentVoteForBallot(ballot, active)
      if (v !== null) {
        counts.set(v, (counts.get(v) ?? 0) + 1)
        ballotsWithVote += 1
      }
    }

    const activeIds = [...active]
    const countsObj = /** @type {Record<string, number>} */ ({})
    for (const id of activeIds) countsObj[id] = counts.get(id) ?? 0

    if (active.size === 0) {
      rounds.push({
        counts: countsObj,
        activeIds,
        ballotsWithVote,
        eliminatedIds: [],
      })
      return { rounds, winnerId: null, tieWinnerIds: [] }
    }

    if (active.size === 1) {
      const winner = activeIds[0]
      rounds.push({
        counts: countsObj,
        activeIds,
        ballotsWithVote,
        eliminatedIds: [],
      })
      return { rounds, winnerId: winner, tieWinnerIds: null }
    }

    for (const id of active) {
      const c = counts.get(id) ?? 0
      if (c > ballotsWithVote / 2) {
        rounds.push({
          counts: countsObj,
          activeIds,
          ballotsWithVote,
          eliminatedIds: [],
        })
        return { rounds, winnerId: id, tieWinnerIds: null }
      }
    }

    if (ballotsWithVote === 0 && active.size > 1) {
      rounds.push({
        counts: countsObj,
        activeIds,
        ballotsWithVote,
        eliminatedIds: [],
      })
      return { rounds, winnerId: null, tieWinnerIds: [...active] }
    }

    let minCount = Infinity
    let maxCount = -Infinity
    for (const id of active) {
      const c = counts.get(id) ?? 0
      minCount = Math.min(minCount, c)
      maxCount = Math.max(maxCount, c)
    }
    const tiedForLast = activeIds.filter((id) => (counts.get(id) ?? 0) === minCount)

    /* Everyone left has the same count and nobody has a majority — declare a tie instead of breaking it arbitrarily. */
    if (active.size >= 2 && ballotsWithVote > 0 && minCount === maxCount) {
      rounds.push({
        counts: countsObj,
        activeIds,
        ballotsWithVote,
        eliminatedIds: [],
      })
      return { rounds, winnerId: null, tieWinnerIds: [...activeIds] }
    }

    const elimId = pickSingleElimination(tiedForLast, candidateIds)
    active.delete(elimId)

    rounds.push({
      counts: countsObj,
      activeIds,
      ballotsWithVote,
      eliminatedIds: [elimId],
    })
  }
}
