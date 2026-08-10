/**
 * Browser client for Game Manager BGG catalog Cloud Functions proxy.
 * Auth stays server-side; configure only the functions base URL in Vite env.
 */

/**
 * @typedef {object} CatalogSearchHit
 * @property {string} catalogEntryId
 * @property {string} title
 * @property {number | null} yearPublished
 * @property {string | null} [type]
 */

/**
 * @typedef {object} CatalogEntryDetail
 * @property {string} catalogEntryId
 * @property {string} title
 * @property {number | null} [yearPublished]
 * @property {number | null} [minPlayers]
 * @property {number | null} [maxPlayers]
 * @property {number | null} [playingTime]
 * @property {number | null} [minPlayTime]
 * @property {number | null} [maxPlayTime]
 * @property {string | null} [thumbnailUrl]
 * @property {string | null} [imageUrl]
 * @property {string | null} [description]
 */

/**
 * @returns {Record<string, string | undefined> | undefined}
 */
function viteEnv() {
  return typeof import.meta !== 'undefined' ? import.meta.env : undefined
}

/**
 * @param {string | undefined} override
 * @returns {string}
 */
function readFunctionsBase(override) {
  if (override) return String(override).trim().replace(/\/$/, '')

  const env = viteEnv()
  const explicit = env?.VITE_GAME_MANAGER_BGG_FUNCTIONS_BASE
  if (explicit) return String(explicit).trim().replace(/\/$/, '')

  const projectId = env?.VITE_FIREBASE_PROJECT_ID
  if (projectId) {
    return `https://us-central1-${String(projectId).trim()}.cloudfunctions.net`
  }
  return ''
}

/**
 * @param {{ functionsBase?: string }} [opts]
 * @returns {string}
 */
export function resolveBggFunctionsBase(opts = {}) {
  return readFunctionsBase(opts.functionsBase)
}

/**
 * @returns {boolean}
 */
export function isBggCatalogConfigured() {
  return resolveBggFunctionsBase() !== ''
}

/**
 * @param {string} name
 * @param {Record<string, string | number | boolean | undefined>} params
 * @param {{ signal?: AbortSignal, fetchImpl?: typeof fetch, functionsBase?: string }} [opts]
 */
async function callBggFunction(name, params, opts = {}) {
  const base = readFunctionsBase(opts.functionsBase)
  if (!base) {
    return { ok: false, error: 'not_configured' }
  }

  const fetchImpl = opts.fetchImpl ?? fetch
  const url = new URL(`${base}/${name}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  }

  let response
  try {
    response = await fetchImpl(url.toString(), { signal: opts.signal })
  } catch (err) {
    return { ok: false, error: 'network', cause: err }
  }

  if (!response.ok) {
    return { ok: false, error: 'http', status: response.status }
  }

  try {
    const body = await response.json()
    return { ok: true, body }
  } catch (err) {
    return { ok: false, error: 'invalid_json', cause: err }
  }
}

/**
 * @param {string} query
 * @param {{ type?: string, signal?: AbortSignal, fetchImpl?: typeof fetch, functionsBase?: string }} [opts]
 * @returns {Promise<{ ok: true, results: CatalogSearchHit[] } | { ok: false, error: string, results: [], status?: number }>}
 */
export async function searchBggCatalog(query, opts = {}) {
  const trimmed = String(query || '').trim()
  if (!trimmed) {
    return { ok: true, results: [] }
  }

  const response = await callBggFunction(
    'bggSearch',
    { query: trimmed, type: opts.type ?? 'boardgame' },
    opts,
  )

  if (!response.ok) {
    return { ok: false, error: response.error, results: [], status: response.status }
  }

  const results = Array.isArray(response.body?.results) ? response.body.results : []
  return { ok: true, results }
}

/**
 * @param {string} catalogEntryId
 * @param {{ stats?: boolean, signal?: AbortSignal, fetchImpl?: typeof fetch, functionsBase?: string }} [opts]
 * @returns {Promise<{ ok: true, entry: CatalogEntryDetail } | { ok: false, error: string, entry: null, status?: number }>}
 */
export async function fetchBggCatalogEntry(catalogEntryId, opts = {}) {
  const id = String(catalogEntryId || '').trim()
  if (!id) {
    return { ok: false, error: 'missing_id', entry: null }
  }

  const batched = await fetchBggCatalogEntries([id], opts)
  if (!batched.ok) {
    return { ok: false, error: batched.error, entry: null, status: batched.status }
  }
  const entry = batched.entries[0] || null
  if (!entry) {
    return { ok: false, error: 'not_found', entry: null }
  }
  return { ok: true, entry }
}

/**
 * Batch thing lookup (comma-separated BGG ids in one Cloud Function / upstream call).
 *
 * @param {string[]} catalogEntryIds
 * @param {{ stats?: boolean, signal?: AbortSignal, fetchImpl?: typeof fetch, functionsBase?: string }} [opts]
 * @returns {Promise<{ ok: true, entries: CatalogEntryDetail[] } | { ok: false, error: string, entries: [], status?: number }>}
 */
export async function fetchBggCatalogEntries(catalogEntryIds, opts = {}) {
  const ids = [...new Set((catalogEntryIds || []).map((id) => String(id || '').trim()).filter(Boolean))].slice(
    0,
    20,
  )
  if (ids.length === 0) {
    return { ok: true, entries: [] }
  }

  const response = await callBggFunction(
    'bggThing',
    { id: ids.join(','), stats: opts.stats === false ? undefined : '1' },
    opts,
  )

  if (!response.ok) {
    return { ok: false, error: response.error, entries: [], status: response.status }
  }

  const entries = Array.isArray(response.body?.entries)
    ? response.body.entries
    : response.body?.entry
      ? [response.body.entry]
      : []
  return { ok: true, entries }
}
