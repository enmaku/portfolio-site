/**
 * @param {import('../types.js').BallotMovie[]} ballotMovies
 * @returns {Map<string, import('../types.js').BallotMovie>}
 */
export function buildBallotMovieIndex(ballotMovies) {
  const index = new Map()
  for (const movie of ballotMovies) {
    if (movie && typeof movie.publicId === 'string') {
      index.set(movie.publicId, movie)
    }
  }
  return index
}
