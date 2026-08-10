/**
 * Ranking / filtering for BGG catalog search hits (client-side).
 * BGG /search is not popularity-ordered; we re-rank after filtering expansions.
 */

/**
 * @param {string | null | undefined} type
 * @returns {boolean}
 */
export function isExcludedCatalogSearchType(type) {
  const t = String(type || '')
    .trim()
    .toLowerCase()
  return (
    t === 'boardgameexpansion' ||
    t === 'boardgameaccessory' ||
    t === 'boardgameintegration' ||
    t === 'boardgamecompilation' ||
    t === 'boardgameimplementation'
  )
}

/**
 * @param {string | null | undefined} raw
 * @returns {string}
 */
export function normalizeCatalogTitle(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/&[#a-z0-9]+;/gi, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Higher is better title relevance for the typed query.
 * @param {string} query
 * @param {string} title
 * @returns {number}
 */
export function catalogTitleMatchScore(query, title) {
  const q = normalizeCatalogTitle(query)
  const t = normalizeCatalogTitle(title)
  if (!q || !t) return 0
  if (t === q) return 1000
  if (t.startsWith(`${q} `) || t.startsWith(q)) return 800
  const words = t.split(' ')
  if (words.some((w) => w === q || w.startsWith(q))) return 600
  if (t.includes(q)) return 200
  return 0
}

/**
 * @param {object} hit
 * @param {object | null | undefined} detail
 * @returns {object}
 */
export function mergeSearchHitWithDetail(hit, detail) {
  if (!detail) return { ...hit }
  return {
    ...hit,
    title: detail.title || hit.title,
    yearPublished: detail.yearPublished ?? hit.yearPublished ?? null,
    type: detail.thingType || hit.type || null,
    thumbnailUrl: detail.thumbnailUrl || hit.thumbnailUrl || null,
    imageUrl: detail.imageUrl || hit.imageUrl || null,
    minPlayers: detail.minPlayers ?? hit.minPlayers ?? null,
    maxPlayers: detail.maxPlayers ?? hit.maxPlayers ?? null,
    playingTime: detail.playingTime ?? hit.playingTime ?? null,
    usersRated: detail.usersRated ?? hit.usersRated ?? null,
    averageRating: detail.averageRating ?? hit.averageRating ?? null,
    bayesAverage: detail.bayesAverage ?? hit.bayesAverage ?? null,
    boardGameRank: detail.boardGameRank ?? hit.boardGameRank ?? null,
  }
}

/**
 * Filter expansions/accessories, prefer strong title matches, then popularity.
 *
 * @param {object[]} hits raw search hits
 * @param {string} query
 * @param {{ detailsById?: Record<string, object>, limit?: number, candidateLimit?: number }} [options]
 * @returns {object[]}
 */
export function rankCatalogSearchHits(hits, query, options = {}) {
  const limit = options.limit ?? 20
  const candidateLimit = options.candidateLimit ?? 20
  const detailsById = options.detailsById || {}

  const filtered = (hits || []).filter((hit) => {
    if (isExcludedCatalogSearchType(hit.type)) return false
    const detail = detailsById[hit.catalogEntryId]
    if (detail && isExcludedCatalogSearchType(detail.thingType)) return false
    return true
  })

  const scored = filtered.map((hit) => {
    const detail = detailsById[hit.catalogEntryId]
    const merged = mergeSearchHitWithDetail(hit, detail)
    const matchScore = catalogTitleMatchScore(query, merged.title)
    return { hit: merged, matchScore }
  })

  scored.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore
    return String(a.hit.catalogEntryId).localeCompare(String(b.hit.catalogEntryId))
  })

  const candidates = scored.slice(0, Math.max(limit, candidateLimit))

  candidates.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore

    const aBayes = a.hit.bayesAverage
    const bBayes = b.hit.bayesAverage
    if (aBayes != null || bBayes != null) {
      if (aBayes == null) return 1
      if (bBayes == null) return -1
      if (bBayes !== aBayes) return bBayes - aBayes
    }

    const aUsers = a.hit.usersRated
    const bUsers = b.hit.usersRated
    if (aUsers != null || bUsers != null) {
      if (aUsers == null) return 1
      if (bUsers == null) return -1
      if (bUsers !== aUsers) return bUsers - aUsers
    }

    const aRank = a.hit.boardGameRank
    const bRank = b.hit.boardGameRank
    if (aRank != null || bRank != null) {
      if (aRank == null) return 1
      if (bRank == null) return -1
      if (aRank !== bRank) return aRank - bRank
    }

    return String(a.hit.title).localeCompare(String(b.hit.title))
  })

  return candidates.slice(0, limit).map((row) => row.hit)
}

/**
 * Pick ids to enrich: best text matches first among non-excluded hits.
 *
 * @param {object[]} hits
 * @param {string} query
 * @param {number} [limit]
 * @returns {string[]}
 */
export function selectCatalogSearchEnrichmentIds(hits, query, limit = 20) {
  return rankCatalogSearchHits(hits, query, { limit, candidateLimit: limit }).map(
    (hit) => hit.catalogEntryId,
  )
}
