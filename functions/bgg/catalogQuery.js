/**
 * Model A catalog search against bggCatalogGames (query tokenization + ranking).
 * Indexer PREFIX_MIN_LEN is 1; lookup / first query token stay ≥ LOOKUP_MIN_LEN.
 */

const SEARCH_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'at',
  'by',
  'for',
  'from',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
])

const PREFIX_MIN_LEN = 1
const LOOKUP_MIN_LEN = 2
const DEFAULT_RESULT_LIMIT = 20

const BGG_CATALOG_GAMES_COLLECTION = 'bggCatalogGames'

/**
 * @param {string} name
 * @returns {string}
 */
function normalizeTitle(name) {
  return String(name ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * @param {string} query
 * @returns {string[]}
 */
function queryTokens(query) {
  const raw = normalizeTitle(query)
    .split(' ')
    .filter((t) => t.length > 0 && !SEARCH_STOPWORDS.has(t))
  if (!raw.length || raw[0].length < LOOKUP_MIN_LEN) return []
  return raw
}

/**
 * Prefer the longest token of length ≥ LOOKUP_MIN_LEN (never a 1-char Firestore lookup).
 * @param {string[]} tokens
 * @returns {string | null}
 */
function pickLookupToken(tokens) {
  const usable = (tokens || []).filter((t) => t.length >= LOOKUP_MIN_LEN)
  if (!usable.length) return null
  return [...usable].sort((a, b) => b.length - a.length || a.localeCompare(b))[0]
}

/**
 * @param {{ searchPrefixes?: string[] }} data
 * @param {string[]} tokens
 */
function docMatchesAllTokens(data, tokens) {
  const prefixes = Array.isArray(data.searchPrefixes) ? data.searchPrefixes : []
  const set = new Set(prefixes)
  return tokens.every((t) => set.has(t))
}

/**
 * @param {{ rank?: number | null, bayesAverage?: number | null, usersRated?: number | null, name?: string, bggId?: string }} a
 * @param {{ rank?: number | null, bayesAverage?: number | null, usersRated?: number | null, name?: string, bggId?: string }} b
 */
function compareCatalogDocs(a, b) {
  const ar = a.rank == null || a.rank <= 0 ? Number.POSITIVE_INFINITY : a.rank
  const br = b.rank == null || b.rank <= 0 ? Number.POSITIVE_INFINITY : b.rank
  if (ar !== br) return ar - br
  const ab = a.bayesAverage == null ? -1 : a.bayesAverage
  const bb = b.bayesAverage == null ? -1 : b.bayesAverage
  if (bb !== ab) return bb - ab
  const au = a.usersRated == null ? -1 : a.usersRated
  const bu = b.usersRated == null ? -1 : b.usersRated
  if (bu !== au) return bu - au
  const nameCmp = String(a.name || '').localeCompare(String(b.name || ''))
  if (nameCmp !== 0) return nameCmp
  return String(a.bggId || '').localeCompare(String(b.bggId || ''))
}

/**
 * @param {{
 *   bggId?: string,
 *   name?: string,
 *   yearPublished?: number | null,
 *   rank?: number | null,
 *   bayesAverage?: number | null,
 *   average?: number | null,
 *   usersRated?: number | null,
 *   thumbnailUrl?: string | null,
 * }} data
 * @returns {{
 *   catalogEntryId: string,
 *   title: string,
 *   yearPublished: number | null,
 *   type: string,
 *   usersRated: number | null,
 *   averageRating: number | null,
 *   bayesAverage: number | null,
 *   boardGameRank: number | null,
 *   thumbnailUrl: string | null,
 * } | null}
 */
function toSearchHit(data) {
  const catalogEntryId = data.bggId != null ? String(data.bggId) : ''
  const title = data.name != null ? String(data.name) : ''
  if (!catalogEntryId || !title) return null
  const thumbnailUrl =
    typeof data.thumbnailUrl === 'string' && data.thumbnailUrl ? data.thumbnailUrl : null
  return {
    catalogEntryId,
    title,
    yearPublished: data.yearPublished ?? null,
    type: 'boardgame',
    usersRated: data.usersRated ?? null,
    averageRating: data.average ?? null,
    bayesAverage: data.bayesAverage ?? null,
    boardGameRank: data.rank ?? null,
    thumbnailUrl,
  }
}

/**
 * @param {{ thumbnailUrl?: string | null }} row
 * @returns {boolean}
 */
function hasThumbnailUrl(row) {
  return typeof row?.thumbnailUrl === 'string' && Boolean(row.thumbnailUrl)
}

/**
 * Fill missing thumbnailUrl on ranked hits via one BGG /thing batch (writes catalog docs).
 * @param {object[]} rows
 * @param {(ids: string[]) => Promise<{ results?: { catalogEntryId: string, thumbnailUrl?: string | null }[] }>} resolveThumbs
 */
async function attachMissingThumbnails(rows, resolveThumbs) {
  const missingIds = rows.filter((row) => !hasThumbnailUrl(row)).map((row) => String(row.bggId))
  if (missingIds.length === 0) return rows
  const { results } = await resolveThumbs(missingIds)
  const urlById = new Map()
  for (const row of results || []) {
    const id = String(row?.catalogEntryId || '').trim()
    const url = typeof row?.thumbnailUrl === 'string' ? row.thumbnailUrl : ''
    if (id && url) urlById.set(id, url)
  }
  for (const row of rows) {
    const url = urlById.get(String(row.bggId))
    if (url) row.thumbnailUrl = url
  }
  return rows
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} query
 * @param {{ resultLimit?: number, resolveThumbs?: Function }} [opts]
 */
async function searchCatalogGames(db, query, opts = {}) {
  const tokens = queryTokens(query)
  const lookup = pickLookupToken(tokens)
  if (!lookup) return []

  const resultLimit = opts.resultLimit ?? DEFAULT_RESULT_LIMIT

  const snap = await db
    .collection(BGG_CATALOG_GAMES_COLLECTION)
    .where('searchPrefixes', 'array-contains', lookup)
    .get()

  const matched = []
  for (const doc of snap.docs) {
    const data = doc.data() || {}
    if (!docMatchesAllTokens(data, tokens)) continue
    matched.push({
      bggId: data.bggId != null ? String(data.bggId) : doc.id,
      name: data.name,
      yearPublished: data.yearPublished ?? null,
      rank: data.rank ?? null,
      bayesAverage: data.bayesAverage ?? null,
      usersRated: data.usersRated ?? null,
      thumbnailUrl: data.thumbnailUrl ?? null,
      searchPrefixes: data.searchPrefixes,
    })
  }

  matched.sort(compareCatalogDocs)
  const top = matched.slice(0, resultLimit)
  const resolveThumbs =
    opts.resolveThumbs ||
    (async (ids) => {
      const { resolveCatalogThumbs } = require('./bggThumb')
      return resolveCatalogThumbs(ids, { db })
    })
  try {
    await attachMissingThumbnails(top, resolveThumbs)
  } catch (err) {
    console.error('catalog search thumbnail fill failed', err)
  }
  return top.map((row) => toSearchHit(row)).filter(Boolean)
}

module.exports = {
  BGG_CATALOG_GAMES_COLLECTION,
  DEFAULT_RESULT_LIMIT,
  LOOKUP_MIN_LEN,
  PREFIX_MIN_LEN,
  SEARCH_STOPWORDS,
  attachMissingThumbnails,
  compareCatalogDocs,
  docMatchesAllTokens,
  normalizeTitle,
  pickLookupToken,
  queryTokens,
  searchCatalogGames,
  toSearchHit,
}
