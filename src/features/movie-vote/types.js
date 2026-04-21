/**
 * Movie Vote JSDoc shapes (picks, ballot, P2P payloads, IRV). Reference with a file-top `@import` of this module
 * from other `.js` / `<script>` files (path relative to that file). See `core.js`, `protocol.js`, `p2p/session.js`,
 * composables, and `stores/movieVote.js`.
 *
 * @see https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html
 *
 * @typedef {'suggest' | 'voting' | 'results'} MovieVotePhase
 */

/**
 * Multiplayer UI / PeerJS session phase (`p2p/session.js`, sync control).
 *
 * @typedef {'idle' | 'connecting' | 'reconnecting' | 'hosting' | 'guest_connected'} MovieVoteSessionPhase
 */

/**
 * Pick source. `tmdb` picks carry a numeric `tmdbId`; `custom` picks have
 * `tmdbId: null` and are deduped across the room by `customKey` (normalized title).
 *
 * @typedef {'tmdb' | 'custom'} MoviePickSource
 */

/**
 * @typedef {object} MoviePick
 * @property {string} localId
 * @property {MoviePickSource} source
 * @property {number | null} tmdbId     Null for `source === 'custom'`.
 * @property {string} [customKey]       Dedupe key for `source === 'custom'` (normalized title).
 * @property {string} title
 * @property {string | null} posterPath
 * @property {string} overview
 * @property {string} [releaseDate]
 * @property {number} [runtime] minutes
 */

/**
 * @typedef {object} BallotMovie
 * @property {string} publicId
 * @property {MoviePickSource} source
 * @property {number | null} tmdbId
 * @property {string} [customKey]
 * @property {string} title
 * @property {string | null} posterPath
 * @property {string} overview
 * @property {string} [releaseDate]
 * @property {number} [runtime] minutes
 */

/**
 * @typedef {object} MovieVoteParticipantSummary
 * @property {string} id
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
 * @property {number} [uniqueSuggestedMovieCount] Distinct titles across all draft picks (suggest phase); 0 otherwise.
 */

export {}
