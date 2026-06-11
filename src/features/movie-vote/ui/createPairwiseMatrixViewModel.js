const PAIRWISE_COMPACT_MAX = 6

/**
 * @param {{
 *   electionOutcome: import('../electionOutcomeTypes.js').ElectionOutcome | null | undefined,
 *   ballotMovies: import('../types.js').BallotMovie[],
 * }} args
 * @returns {{
 *   mount: boolean,
 *   candidateIds?: string[],
 *   cells?: import('../condorcet.js').PairwiseMatrix['cells'],
 *   useCompactGrid?: boolean,
 *   copelandScoreRows?: Array<{ id: string, score: number, isLeader: boolean }>,
 * }}
 */
export function createPairwiseMatrixViewModel({ electionOutcome, ballotMovies }) {
  const method = electionOutcome?.votingMethod
  if (method !== 'condorcet' && method !== 'copeland') {
    return { mount: false }
  }

  const matrix = electionOutcome?.pairwiseMatrix
  if (!matrix) {
    return { mount: false }
  }

  const candidateIds =
    Array.isArray(matrix.candidateIds) && matrix.candidateIds.length > 0
      ? matrix.candidateIds
      : ballotMovies.map((m) => m.publicId).filter(Boolean)

  /** @type {Array<{ id: string, score: number, isLeader: boolean }>} */
  let copelandScoreRows = []
  if (method === 'copeland' && electionOutcome.copelandScores) {
    const scores = electionOutcome.copelandScores
    const leaderIds = new Set(
      electionOutcome.winnerId
        ? [electionOutcome.winnerId]
        : (electionOutcome.tieWinnerIds ?? []),
    )
    let maxScore = -Infinity
    for (const id of candidateIds) {
      maxScore = Math.max(maxScore, scores[id] ?? 0)
    }
    copelandScoreRows = candidateIds
      .map((id) => {
        const score = scores[id] ?? 0
        const atMax = score === maxScore
        return {
          id,
          score,
          isLeader: atMax && leaderIds.has(id),
        }
      })
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  }

  return {
    mount: true,
    candidateIds,
    cells: matrix.cells,
    useCompactGrid: candidateIds.length <= PAIRWISE_COMPACT_MAX,
    copelandScoreRows,
  }
}
