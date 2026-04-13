/**
 * PeerJS room id: fixed prefix + short user-facing suffix (`dperry-gametimer-X0F436`).
 * Suffix uses an alphanumeric alphabet without I/O ambiguity (Crockford-style).
 */

/** @type {string} */
export const GAME_TIMER_PEER_ID_PREFIX = 'dperry-gametimer-'

/** Uppercase letters and digits excluding I, O, L. */
const SUFFIX_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/**
 * Random room code suffix (uppercase alphanumerics excluding I, O, L).
 * @param {number} [length=6]
 * @returns {string}
 */
export function generateRoomSuffix(length = 6) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let s = ''
  for (let i = 0; i < length; i++) {
    s += SUFFIX_ALPHABET[bytes[i] % SUFFIX_ALPHABET.length]
  }
  return s
}

/**
 * Normalize user input for join (uppercase, strip non-alphanumerics).
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
 * PeerJS requires ids to start and end with alphanumeric; suffix-only codes must satisfy that.
 * @param {string} suffix
 * @returns {boolean}
 */
export function isValidRoomSuffix(suffix) {
  if (typeof suffix !== 'string' || suffix.length < 4 || suffix.length > 32) return false
  if (!/^[0-9A-Z]+$/.test(suffix)) return false
  return /^[A-Z0-9]/.test(suffix) && /[A-Z0-9]$/.test(suffix)
}

/**
 * @param {string} suffix Normalized suffix (see {@link normalizeRoomSuffixInput}).
 * @returns {string} Full PeerJS broker id.
 */
export function fullPeerIdFromSuffix(suffix) {
  return GAME_TIMER_PEER_ID_PREFIX + suffix
}

/** Query key used in share/join links for the game timer. */
export const GAME_TIMER_ROOM_QUERY_KEY = 'room'

/**
 * Full page URL for joining a room (sets {@link GAME_TIMER_ROOM_QUERY_KEY}).
 * Hash-mode apps put the query on the route inside `#/path?...`.
 * @param {string} suffix Normalized room suffix.
 * @returns {string}
 */
export function buildGameTimerRoomShareUrl(suffix) {
  const href = typeof window !== 'undefined' ? window.location.href : 'http://localhost/#/projects/game-timer'
  const u = new URL(href)

  if (u.hash.startsWith('#/')) {
    const inner = u.hash.slice(1)
    const qIndex = inner.indexOf('?')
    const pathOnly = qIndex === -1 ? inner : inner.slice(0, qIndex)
    const existingSearch = qIndex === -1 ? '' : inner.slice(qIndex + 1)
    const params = new URLSearchParams(existingSearch)
    params.set(GAME_TIMER_ROOM_QUERY_KEY, suffix)
    const qs = params.toString()
    u.hash = qs ? `#${pathOnly}?${qs}` : `#${pathOnly}`
    return u.href
  }

  u.searchParams.set(GAME_TIMER_ROOM_QUERY_KEY, suffix)
  return u.href
}
