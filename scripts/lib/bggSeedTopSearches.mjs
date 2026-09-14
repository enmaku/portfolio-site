/**
 * Progressive title searches for the top-ranked catalog games.
 */
import { SEARCH_STOPWORDS, normalizeTitle } from './bggCatalogSearchIndex.mjs'

export const TOP_GAMES_LIMIT = 500
export const TYPING_LOOKUP_MIN_LEN = 2

/**
 * Same first-token rule as functions/bgg/catalogQuery.js queryTokens.
 * @param {string} query
 * @returns {boolean}
 */
export function queryWouldSearch(query) {
  const raw = normalizeTitle(query)
    .split(' ')
    .filter((t) => t.length > 0 && !SEARCH_STOPWORDS.has(t))
  return raw.length > 0 && raw[0].length >= TYPING_LOOKUP_MIN_LEN
}

/**
 * Growing prefixes of the title as a person would type it, plus prefixes of
 * searchable tokens when the raw title starts with a stopword or 1-char word.
 *
 * @param {string} name
 * @returns {string[]}
 */
export function typingQueriesFromTitle(name) {
  const words = normalizeTitle(name)
    .split(' ')
    .filter((t) => t.length > 0)
  /** @type {string[]} */
  const out = []
  const seen = new Set()
  const add = (q) => {
    if (!q || seen.has(q) || !queryWouldSearch(q)) return
    seen.add(q)
    out.push(q)
  }
  for (let i = 1; i <= words.length; i += 1) {
    add(words.slice(0, i).join(' '))
  }
  if (out.length === 0) {
    const searchable = words.filter((t) => t.length >= TYPING_LOOKUP_MIN_LEN && !SEARCH_STOPWORDS.has(t))
    for (let i = 1; i <= searchable.length; i += 1) {
      add(searchable.slice(0, i).join(' '))
    }
  }
  return out
}

/**
 * @param {object[]} docs
 * @param {number} [limit]
 * @returns {object[]}
 */
export function topRankedCatalogDocs(docs, limit = TOP_GAMES_LIMIT) {
  return [...(docs || [])]
    .filter((doc) => Number.isFinite(doc?.rank) && doc.rank > 0)
    .sort((a, b) => a.rank - b.rank || String(a.bggId || '').localeCompare(String(b.bggId || '')))
    .slice(0, limit)
}

/**
 * @param {object[]} docs
 * @param {number} [limit]
 * @returns {string[]}
 */
export function uniqueTypingQueriesForTopGames(docs, limit = TOP_GAMES_LIMIT) {
  const seen = new Set()
  const queries = []
  for (const doc of topRankedCatalogDocs(docs, limit)) {
    for (const query of typingQueriesFromTitle(doc.name)) {
      if (seen.has(query)) continue
      seen.add(query)
      queries.push(query)
    }
  }
  return queries
}
