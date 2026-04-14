/**
 * TMDB v3 JSON API (browser).
 * Auth: either **Read Access Token** (Bearer) or **API key** (query param).
 * @see https://developer.themoviedb.org/reference/search-movie
 */

const TMDB_BASE = 'https://api.themoviedb.org/3'

/**
 * @returns {string}
 */
function readBearerToken() {
  const v = typeof import.meta.env !== 'undefined' && import.meta.env.VITE_TMDB_READ_ACCESS_TOKEN
  return v ? String(v).trim() : ''
}

/**
 * @returns {string}
 */
function readApiKey() {
  const v = typeof import.meta.env !== 'undefined' && import.meta.env.VITE_TMDB_API_KEY
  return v ? String(v).trim() : ''
}

/**
 * @returns {{ type: 'bearer', token: string } | { type: 'api_key', key: string } | { type: 'none' }}
 */
function authMode() {
  const token = readBearerToken()
  if (token) return { type: 'bearer', token }
  const key = readApiKey()
  if (key) return { type: 'api_key', key }
  return { type: 'none' }
}

/**
 * @returns {boolean}
 */
export function isTmdbConfigured() {
  return authMode().type !== 'none'
}

/**
 * @param {string} path e.g. `/configuration` or `/search/movie`
 * @param {{ searchParams?: Record<string, string>, signal?: AbortSignal }} [opts]
 * @returns {Promise<Response>}
 */
function tmdbFetch(path, opts = {}) {
  const mode = authMode()
  if (mode.type === 'none') {
    return Promise.reject(new Error('TMDB not configured'))
  }
  const url = new URL(`${TMDB_BASE}${path.startsWith('/') ? path : `/${path}`}`)
  const sp = opts.searchParams ?? {}
  for (const [k, v] of Object.entries(sp)) {
    url.searchParams.set(k, v)
  }
  if (mode.type === 'api_key') {
    url.searchParams.set('api_key', mode.key)
  }
  /** @type {HeadersInit} */
  const headers = {}
  if (mode.type === 'bearer') {
    headers.Authorization = `Bearer ${mode.token}`
  }
  return fetch(url.toString(), {
    signal: opts.signal,
    headers,
  })
}

/**
 * TMDB poster/backdrop CDN (stable; no `/configuration` call needed for list thumbs).
 * @see https://developer.themoviedb.org/docs/image-basics
 *
 * @param {string | null | undefined} posterPath TMDB `poster_path` (usually starts with `/`).
 * @param {string} [size='w185'] e.g. w92, w185, w342
 * @returns {string | null}
 */
export function posterUrl(posterPath, size = 'w185') {
  if (posterPath == null) return null
  const raw = String(posterPath).trim()
  if (!raw) return null
  const path = raw.startsWith('/') ? raw : `/${raw}`
  return `https://image.tmdb.org/t/p/${size}${path}`
}

/**
 * TMDB profile image CDN (`profile_path` on people / cast).
 * @param {string | null | undefined} profilePath
 * @param {string} [size='w92'] e.g. w45, w92, w185, h632
 * @returns {string | null}
 */
export function profileUrl(profilePath, size = 'w92') {
  if (profilePath == null) return null
  const raw = String(profilePath).trim()
  if (!raw) return null
  const path = raw.startsWith('/') ? raw : `/${raw}`
  return `https://image.tmdb.org/t/p/${size}${path}`
}

/**
 * @param {string} query
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<{ id: number, title: string, poster_path: string | null, overview: string, release_date?: string }[]>}
 */
export async function searchMovies(query, opts = {}) {
  if (!isTmdbConfigured()) return []
  const q = query.trim()
  if (q.length < 2) return []
  const res = await tmdbFetch('/search/movie', {
    signal: opts.signal,
    searchParams: {
      query: q,
      include_adult: 'false',
      language: 'en-US',
      page: '1',
    },
  })
  if (!res.ok) throw new Error('TMDB search failed')
  const data = await res.json()
  const results = data?.results
  return Array.isArray(results) ? results : []
}

/**
 * @param {number} tmdbId
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<{
 *   id: number,
 *   title: string,
 *   poster_path: string | null,
 *   overview: string,
 *   release_date?: string,
 *   runtime?: number,
 *   vote_average?: number,
 *   imdb_id?: string | null,
 *   credits?: { cast?: unknown[], crew?: unknown[] },
 * } | null>}
 */
export async function getMovieDetails(tmdbId, opts = {}) {
  if (!isTmdbConfigured()) return null
  const res = await tmdbFetch(`/movie/${tmdbId}`, {
    signal: opts.signal,
    searchParams: {
      language: 'en-US',
      append_to_response: 'credits',
    },
  })
  if (!res.ok) return null
  return await res.json()
}
