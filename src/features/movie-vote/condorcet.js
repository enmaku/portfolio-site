/**
 * Condorcet method (pairwise majority + Smith set). Pure tally — no side effects.
 */

/**
 * @typedef {'win' | 'loss' | 'tie'} PairwiseOutcome
 */

/**
 * @typedef {object} PairwiseMatrix
 * @property {string[]} candidateIds
 * @property {Record<string, Record<string, PairwiseOutcome>>} cells Row vs column from the row candidate's perspective.
 */

/**
 * @typedef {import('./electionOutcomeTypes.js').ElectionOutcome & { pairwiseMatrix?: PairwiseMatrix }} CondorcetResult
 */

/**
 * @param {CondorcetResult | null | undefined} result
 * @returns {boolean}
 */
export function isDeclaredCondorcetTie(result) {
  return Array.isArray(result?.tieWinnerIds) && result.tieWinnerIds.length > 0
}

/**
 * @param {string[][]} rankings
 * @param {string} a
 * @param {string} b
 * @returns {{ preferA: number, preferB: number }}
 */
export function comparePairwisePreference(rankings, a, b) {
  let preferA = 0
  let preferB = 0
  for (const ranking of rankings) {
    const posA = ranking.indexOf(a)
    const posB = ranking.indexOf(b)
    if (posA < 0 || posB < 0) continue
    if (posA < posB) preferA++
    else if (posB < posA) preferB++
  }
  return { preferA, preferB }
}

/**
 * @param {string[][]} rankings
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function pairwiseBeats(rankings, a, b) {
  const { preferA, preferB } = comparePairwisePreference(rankings, a, b)
  return preferA > preferB
}

/**
 * @param {string[][]} rankings
 * @param {string} a
 * @param {string} b
 * @returns {PairwiseOutcome}
 */
export function pairwiseOutcome(rankings, a, b) {
  const { preferA, preferB } = comparePairwisePreference(rankings, a, b)
  if (preferA > preferB) return 'win'
  if (preferB > preferA) return 'loss'
  return 'tie'
}

/**
 * @param {string[][]} rankings
 * @param {string[]} candidateIds
 * @returns {PairwiseMatrix}
 */
export function buildPairwiseMatrix(rankings, candidateIds) {
  /** @type {Record<string, Record<string, PairwiseOutcome>>} */
  const cells = {}
  for (const rowId of candidateIds) {
    cells[rowId] = {}
    for (const colId of candidateIds) {
      if (rowId === colId) continue
      cells[rowId][colId] = pairwiseOutcome(rankings, rowId, colId)
    }
  }
  return { candidateIds: [...candidateIds], cells }
}

/**
 * @param {string[][]} rankings
 * @param {string} from
 * @param {string} to
 * @param {string[]} candidates
 * @returns {boolean}
 */
export function hasBeatOrTiePath(rankings, from, to, candidates) {
  if (from === to) return true
  if (pairwiseBeats(rankings, from, to)) return true
  if (pairwiseOutcome(rankings, from, to) === 'tie') return true

  /** @type {Set<string>} */
  const visited = new Set([from])
  /** @type {string[]} */
  const queue = [from]

  while (queue.length) {
    const current = queue.shift()
    for (const next of candidates) {
      if (current === next || visited.has(next)) continue
      if (!pairwiseBeats(rankings, current, next) && pairwiseOutcome(rankings, current, next) !== 'tie') {
        continue
      }
      if (next === to) return true
      visited.add(next)
      queue.push(next)
    }
  }
  return false
}

/**
 * Smith set via beatpaths (pairwise majority steps, with ties as mutual reachability).
 *
 * @param {string[]} candidateIds
 * @param {string[][]} rankings
 * @returns {string[]}
 */
export function smithSetFromBeatpaths(candidateIds, rankings) {
  if (candidateIds.length === 0) return []
  return candidateIds.filter((a) =>
    candidateIds.every((b) => a === b || hasBeatOrTiePath(rankings, a, b, candidateIds)),
  )
}

/**
 * @param {string[][]} rankings
 * @param {string[]} candidateIds
 * @returns {CondorcetResult}
 */
export function runCondorcet(rankings, candidateIds) {
  const pairwiseMatrix = buildPairwiseMatrix(rankings, candidateIds)

  if (candidateIds.length === 0) {
    return { rounds: [], winnerId: null, tieWinnerIds: [], pairwiseMatrix }
  }

  if (candidateIds.length === 1) {
    return {
      rounds: [],
      winnerId: candidateIds[0],
      tieWinnerIds: null,
      pairwiseMatrix,
    }
  }

  const smith = smithSetFromBeatpaths(candidateIds, rankings)

  if (smith.length === 1) {
    return {
      rounds: [],
      winnerId: smith[0],
      tieWinnerIds: null,
      pairwiseMatrix,
    }
  }

  return {
    rounds: [],
    winnerId: null,
    tieWinnerIds: [...smith],
    pairwiseMatrix,
  }
}
