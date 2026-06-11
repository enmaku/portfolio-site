import { buildBallotMovieIndex } from './ballotMovieIndex.js'

/**
 * @param {{
 *   electionOutcome: import('../electionOutcomeTypes.js').ElectionOutcome | null | undefined,
 *   ballotMovies: import('../types.js').BallotMovie[],
 * }} args
 * @returns {{
 *   variant: 'empty' | 'winner' | 'declaredTie',
 *   winnerId?: string,
 *   winnerPosterPath?: string | null,
 *   tieMovies?: Array<{
 *     publicId: string,
 *     posterPath: string | null,
 *     releaseDate?: string,
 *     runtime?: number,
 *   }>,
 * }}
 */
export function createResultsSummaryViewModel({ electionOutcome, ballotMovies }) {
  if (!electionOutcome) {
    return { variant: 'empty' }
  }

  const index = buildBallotMovieIndex(ballotMovies)

  if (electionOutcome.winnerId) {
    const winner = index.get(electionOutcome.winnerId)
    return {
      variant: 'winner',
      winnerId: electionOutcome.winnerId,
      winnerPosterPath: winner?.posterPath ?? null,
    }
  }

  const tieIds = electionOutcome.tieWinnerIds
  if (Array.isArray(tieIds) && tieIds.length > 0) {
    return {
      variant: 'declaredTie',
      tieMovies: tieIds.map((id) => {
        const movie = index.get(id)
        return {
          publicId: id,
          posterPath: movie?.posterPath ?? null,
          releaseDate: movie?.releaseDate,
          runtime: movie?.runtime,
        }
      }),
    }
  }

  return { variant: 'empty' }
}
