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
 * Normalize a free-form title so two users typing roughly the same custom movie
 * produce the same dedupe key. Casefolds, collapses whitespace, strips simple
 * punctuation, and removes trailing articles added by some search engines.
 *
 * @param {string} title
 * @returns {string}
 */
export function normalizeCustomTitle(title) {
  const raw = typeof title === 'string' ? title : ''
  return raw
    .normalize('NFKD')
    .replace(/[\p{Diacritic}]/gu, '')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Stable, cross-peer dedupe key for a pick or ballot movie.
 * TMDB picks dedupe on `tmdbId`; custom picks dedupe on `customKey` (normalized title).
 *
 * @param {MoviePick | BallotMovie} pick
 * @returns {string | null} null if the pick has neither a numeric tmdbId nor a customKey.
 */
export function pickDedupeKey(pick) {
  if (!pick) return null
  if (pick.source === 'tmdb' || (pick.source == null && typeof pick.tmdbId === 'number')) {
    return typeof pick.tmdbId === 'number' ? `tmdb:${pick.tmdbId}` : null
  }
  if (pick.source === 'custom') {
    const key = typeof pick.customKey === 'string' ? pick.customKey : normalizeCustomTitle(pick.title)
    return key ? `custom:${key}` : null
  }
  return null
}

/**
 * Count distinct movies in picks (TMDB ids and normalized custom titles together).
 *
 * @param {MoviePick[]} picks
 * @returns {number}
 */
export function uniqueMoviesInPicks(picks) {
  const seen = new Set()
  for (const p of picks) {
    const key = pickDedupeKey(p)
    if (key) seen.add(key)
  }
  return seen.size
}

/**
 * Dedupe by {@link pickDedupeKey}, shuffle, assign public ids.
 * @param {MoviePick[]} picks
 * @returns {BallotMovie[]}
 */
export function compileBallotMovies(picks) {
  const byKey = new Map()
  for (const p of picks) {
    const key = pickDedupeKey(p)
    if (!key || byKey.has(key)) continue
    const source = p.source ?? (typeof p.tmdbId === 'number' ? 'tmdb' : 'custom')
    byKey.set(key, {
      publicId: generatePublicId(),
      source,
      tmdbId: source === 'tmdb' ? p.tmdbId : null,
      customKey: source === 'custom' ? (p.customKey ?? normalizeCustomTitle(p.title)) : undefined,
      title: p.title,
      posterPath: p.posterPath,
      overview: p.overview,
      releaseDate: p.releaseDate,
      runtime: p.runtime,
    })
  }
  const out = [...byKey.values()]
  shuffleInPlace(out)
  return out
}
