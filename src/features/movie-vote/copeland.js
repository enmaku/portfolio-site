/**
 * Copeland method (pairwise wins minus losses). Pure tally — no side effects.
 */

import { buildPairwiseMatrix } from './condorcet.js'

/**
 * @typedef {import('./condorcet.js').PairwiseMatrix} PairwiseMatrix
 */

/**
 * @typedef {import('./electionOutcomeTypes.js').ElectionOutcome & {
 *   pairwiseMatrix?: PairwiseMatrix,
 *   copelandScores?: Record<string, number>,
 * }} CopelandResult
 */

/**
 * @param {CopelandResult | null | undefined} result
 * @returns {boolean}
 */
export function isDeclaredCopelandTie(result) {
  return Array.isArray(result?.tieWinnerIds) && result.tieWinnerIds.length > 0
}

/**
 * @param {PairwiseMatrix} matrix
 * @param {string} candidateId
 * @returns {number}
 */
export function copelandScoreFromMatrix(matrix, candidateId) {
  let wins = 0
  let losses = 0
  for (const otherId of matrix.candidateIds) {
    if (otherId === candidateId) continue
    const outcome = matrix.cells[candidateId]?.[otherId]
    if (outcome === 'win') wins++
    else if (outcome === 'loss') losses++
  }
  return wins - losses
}

/**
 * @param {string[][]} rankings
 * @param {string} candidateId
 * @param {string[]} candidateIds
 * @returns {number}
 */
export function copelandScore(rankings, candidateId, candidateIds) {
  const matrix = buildPairwiseMatrix(rankings, candidateIds)
  return copelandScoreFromMatrix(matrix, candidateId)
}

/**
 * @param {string[][]} rankings
 * @param {string[]} candidateIds
 * @returns {Record<string, number>}
 */
export function copelandScores(rankings, candidateIds) {
  const matrix = buildPairwiseMatrix(rankings, candidateIds)
  /** @type {Record<string, number>} */
  const scores = {}
  for (const id of candidateIds) {
    scores[id] = copelandScoreFromMatrix(matrix, id)
  }
  return scores
}

/**
 * @param {string[][]} rankings
 * @param {string[]} candidateIds
 * @returns {CopelandResult}
 */
export function runCopeland(rankings, candidateIds) {
  const pairwiseMatrix = buildPairwiseMatrix(rankings, candidateIds)
  /** @type {Record<string, number>} */
  const scores = {}
  for (const id of candidateIds) {
    scores[id] = copelandScoreFromMatrix(pairwiseMatrix, id)
  }

  if (candidateIds.length === 0) {
    return { rounds: [], winnerId: null, tieWinnerIds: [], pairwiseMatrix, copelandScores: scores }
  }

  if (candidateIds.length === 1) {
    return {
      rounds: [],
      winnerId: candidateIds[0],
      tieWinnerIds: null,
      pairwiseMatrix,
      copelandScores: scores,
    }
  }

  let maxScore = -Infinity
  for (const id of candidateIds) {
    maxScore = Math.max(maxScore, scores[id] ?? 0)
  }

  const leaders = candidateIds.filter((id) => (scores[id] ?? 0) === maxScore)

  if (leaders.length === 1) {
    return {
      rounds: [],
      winnerId: leaders[0],
      tieWinnerIds: null,
      pairwiseMatrix,
      copelandScores: scores,
    }
  }

  return {
    rounds: [],
    winnerId: null,
    tieWinnerIds: [...leaders],
    pairwiseMatrix,
    copelandScores: scores,
  }
}
