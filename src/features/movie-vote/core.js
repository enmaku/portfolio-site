/**
 * @import './types.js'
 */

export const HOST_PARTICIPANT_ID = '__host__'

const SUFFIX_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/**
 * @param {number} [length=8]
 * @returns {string}
 */
export function generateParticipantId(length = 8) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let s = ''
  for (let i = 0; i < length; i++) {
    s += SUFFIX_ALPHABET[bytes[i] % SUFFIX_ALPHABET.length]
  }
  return s
}

/**
 * @returns {string}
 */
export function generatePublicId() {
  const u = crypto.randomUUID().replace(/-/g, '')
  return `m_${u.slice(0, 16)}`
}

/**
 * Fisher–Yates shuffle (mutates array).
 * @template T
 * @param {T[]} arr
 * @returns {void}
 */
export function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
}

/**
 * Dedupe by tmdbId, shuffle, assign public ids.
 * @param {MoviePick[]} picks
 * @returns {BallotMovie[]}
 */
export function compileBallotMovies(picks) {
  const byTmdb = new Map()
  for (const p of picks) {
    if (!byTmdb.has(p.tmdbId)) {
      byTmdb.set(p.tmdbId, {
        publicId: generatePublicId(),
        tmdbId: p.tmdbId,
        title: p.title,
        posterPath: p.posterPath,
        overview: p.overview,
        releaseDate: p.releaseDate,
      })
    }
  }
  const out = [...byTmdb.values()]
  shuffleInPlace(out)
  return out
}
