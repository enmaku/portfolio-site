/**
 * Movie Vote JSDoc shapes (picks, ballot, P2P payloads, IRV).
 *
 * @typedef {'suggest' | 'voting' | 'results'} MovieVotePhase
 */

/**
 * @typedef {object} MoviePick
 * @property {string} localId
 * @property {number} tmdbId
 * @property {string} title
 * @property {string | null} posterPath
 * @property {string} overview
 * @property {string} [releaseDate]
 */

/**
 * @typedef {object} BallotMovie
 * @property {string} publicId
 * @property {number} tmdbId
 * @property {string} title
 * @property {string | null} posterPath
 * @property {string} overview
 * @property {string} [releaseDate]
 */

/**
 * @typedef {object} MovieVoteParticipantSummary
 * @property {string} id
 * @property {string} displayName
 * @property {boolean} ready
 * @property {number} pickCount
 */

/**
 * Serialized host → guest state (also used to build UI).
 *
 * @typedef {object} MovieVotePublicPayload
 * @property {MovieVotePhase} phase
 * @property {MovieVoteParticipantSummary[]} participants
 * @property {BallotMovie[] | null} ballotMovies
 * @property {string[] | null} ballotOrderIds
 * @property {{ submitted: number, total: number } | null} voteProgress
 * @property {import('./irv.js').IrvResult | null} [irvResult]
 */

export {}
