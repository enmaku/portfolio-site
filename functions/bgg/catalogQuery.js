/**
 * Model A catalog search against bggCatalogGames (query tokenization + ranking).
 * Keep stopwords / min length aligned with scripts/lib/bggCatalogSearchIndex.mjs.
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

const PREFIX_MIN_LEN = 2
const DEFAULT_CANDIDATE_LIMIT = 80
const DEFAULT_RESULT_LIMIT = 25

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
  return normalizeTitle(query)
    .split(' ')
    .filter((t) => t.length >= PREFIX_MIN_LEN && !SEARCH_STOPWORDS.has(t))
}

/**
 * Prefer the longest token (usually most selective for array-contains).
 * @param {string[]} tokens
 * @returns {string | null}
 */
function pickLookupToken(tokens) {
  if (!tokens.length) return null
  return [...tokens].sort((a, b) => b.length - a.length || a.localeCompare(b))[0]
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
 * } | null}
 */
function toSearchHit(data) {
  const catalogEntryId = data.bggId != null ? String(data.bggId) : ''
  const title = data.name != null ? String(data.name) : ''
  if (!catalogEntryId || !title) return null
  return {
    catalogEntryId,
    title,
    yearPublished: data.yearPublished ?? null,
    type: 'boardgame',
    usersRated: data.usersRated ?? null,
    averageRating: data.average ?? null,
    bayesAverage: data.bayesAverage ?? null,
    boardGameRank: data.rank ?? null,
  }
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} query
 * @param {{ candidateLimit?: number, resultLimit?: number }} [opts]
 */
async function searchCatalogGames(db, query, opts = {}) {
  const tokens = queryTokens(query)
  const lookup = pickLookupToken(tokens)
  if (!lookup) return []

  const candidateLimit = opts.candidateLimit ?? DEFAULT_CANDIDATE_LIMIT
  const resultLimit = opts.resultLimit ?? DEFAULT_RESULT_LIMIT

  const snap = await db
    .collection(BGG_CATALOG_GAMES_COLLECTION)
    .where('searchPrefixes', 'array-contains', lookup)
    .limit(candidateLimit)
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
      searchPrefixes: data.searchPrefixes,
    })
  }

  matched.sort(compareCatalogDocs)
  return matched
    .slice(0, resultLimit)
    .map((row) => toSearchHit(row))
    .filter(Boolean)
}

module.exports = {
  BGG_CATALOG_GAMES_COLLECTION,
  PREFIX_MIN_LEN,
  SEARCH_STOPWORDS,
  compareCatalogDocs,
  docMatchesAllTokens,
  normalizeTitle,
  pickLookupToken,
  queryTokens,
  searchCatalogGames,
  toSearchHit,
}
