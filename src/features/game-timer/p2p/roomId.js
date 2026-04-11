/**
 * PeerJS room id: fixed prefix + short user-facing suffix (`dperry-gametimer-X0F436`).
 * Suffix uses an alphanumeric alphabet without I/O ambiguity (Crockford-style).
 */

/** @type {string} */
export const GAME_TIMER_PEER_ID_PREFIX = 'dperry-gametimer-'

/** Uppercase letters and digits excluding I, O, L. */
const SUFFIX_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/**
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
