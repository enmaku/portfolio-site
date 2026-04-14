/**
 * PeerJS room id for Movie Vote: `dperry-movievote-<suffix>`.
 */

/** @type {string} */
export const MOVIE_VOTE_PEER_ID_PREFIX = 'dperry-movievote-'

const SUFFIX_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/**
 * @param {number} length
 * @returns {string}
 */
function randomAlphabetSuffix(length) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let s = ''
  for (let i = 0; i < length; i++) {
    s += SUFFIX_ALPHABET[bytes[i] % SUFFIX_ALPHABET.length]
  }
  return s
}

/**
 * @param {number} [length=6]
 * @returns {string}
 */
export function generateRoomSuffix(length = 6) {
  return randomAlphabetSuffix(length)
}

/**
 * Anonymous participant id (same alphabet as room codes; longer default).
 * @param {number} [length=8]
 * @returns {string}
 */
export function generateAnonymousVoterId(length = 8) {
  return randomAlphabetSuffix(length)
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeRoomSuffixInput(raw) {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
}

/**
 * @param {string} suffix
 * @returns {boolean}
 */
export function isValidRoomSuffix(suffix) {
  if (typeof suffix !== 'string' || suffix.length < 4 || suffix.length > 32) return false
  if (!/^[0-9A-Z]+$/.test(suffix)) return false
  return /^[A-Z0-9]/.test(suffix) && /[A-Z0-9]$/.test(suffix)
}

/**
 * @param {string} suffix
 * @returns {string}
 */
export function fullPeerIdFromSuffix(suffix) {
  return MOVIE_VOTE_PEER_ID_PREFIX + suffix
}

/** Query key for share/join links. */
export const MOVIE_VOTE_ROOM_QUERY_KEY = 'room'

/**
 * @param {string} suffix
 * @returns {string}
 */
export function buildMovieVoteRoomShareUrl(suffix) {
  const href = typeof window !== 'undefined' ? window.location.href : 'http://localhost/#/projects/movie-vote'
  const u = new URL(href)

  if (u.hash.startsWith('#/')) {
    const inner = u.hash.slice(1)
    const qIndex = inner.indexOf('?')
    const pathOnly = qIndex === -1 ? inner : inner.slice(0, qIndex)
    const existingSearch = qIndex === -1 ? '' : inner.slice(qIndex + 1)
    const params = new URLSearchParams(existingSearch)
    params.set(MOVIE_VOTE_ROOM_QUERY_KEY, suffix)
    const qs = params.toString()
    u.hash = qs ? `#${pathOnly}?${qs}` : `#${pathOnly}`
    return u.href
  }

  u.searchParams.set(MOVIE_VOTE_ROOM_QUERY_KEY, suffix)
  return u.href
}
