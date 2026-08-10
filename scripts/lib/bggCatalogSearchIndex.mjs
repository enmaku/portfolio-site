/**
 * Model A catalog search indexing: title tokens → edge n-gram prefixes on each game doc.
 */

export const SEARCH_STOPWORDS = new Set([
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

export const PREFIX_MIN_LEN = 2
export const PREFIX_MAX_LEN = 12

/**
 * @param {string} name
 * @returns {string}
 */
export function normalizeTitle(name) {
  return String(name ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * @param {string} name
 * @param {ReadonlySet<string>} [stopwords]
 * @returns {string[]}
 */
export function titleTokens(name, stopwords = SEARCH_STOPWORDS) {
  return normalizeTitle(name)
    .split(' ')
    .filter((t) => t.length > 0 && !stopwords.has(t))
}

/**
 * @param {string} token
 * @param {{ minLen?: number, maxLen?: number }} [opts]
 * @returns {string[]}
 */
export function edgeNgrams(token, opts = {}) {
  const minLen = opts.minLen ?? PREFIX_MIN_LEN
  const maxLen = opts.maxLen ?? PREFIX_MAX_LEN
  if (!token) return []
  const out = []
  const lim = Math.min(token.length, maxLen)
  for (let n = minLen; n <= lim; n += 1) {
    out.push(token.slice(0, n))
  }
  if (token.length > maxLen) {
    out.push(token)
  }
  return out
}

/**
 * Deduped search prefixes for a title (Model A `searchPrefixes` field).
 * @param {string} name
 * @returns {string[]}
 */
export function buildSearchPrefixes(name) {
  const seen = new Set()
  const prefixes = []
  for (const token of titleTokens(name)) {
    for (const prefix of edgeNgrams(token)) {
      if (seen.has(prefix)) continue
      seen.add(prefix)
      prefixes.push(prefix)
    }
  }
  return prefixes
}

/**
 * @param {string} raw
 * @returns {number | null}
 */
export function parseOptionalNumber(raw) {
  if (raw === undefined || raw === null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/**
 * @param {string} raw
 * @returns {number | null}
 */
export function parseRank(raw) {
  const n = parseOptionalNumber(raw)
  if (n === null || n <= 0) return null
  return n
}

/**
 * Lean catalog search doc (Firestore upload shape later; doc id = bggId).
 * @param {Record<string, string>} row CSV row map
 * @returns {{ bggId: string, name: string, yearPublished: number | null, rank: number | null, bayesAverage: number | null, average: number | null, usersRated: number | null, searchPrefixes: string[] } | null}
 */
export function catalogSearchDocFromRankRow(row) {
  if (String(row.is_expansion ?? '') === '1') return null
  const bggId = String(row.id ?? '').trim()
  const name = String(row.name ?? '').trim()
  if (!bggId || !name) return null
  return {
    bggId,
    name,
    yearPublished: parseOptionalNumber(row.yearpublished),
    rank: parseRank(row.rank),
    bayesAverage: parseOptionalNumber(row.bayesaverage),
    average: parseOptionalNumber(row.average),
    usersRated: parseOptionalNumber(row.usersrated),
    searchPrefixes: buildSearchPrefixes(name),
  }
}

/**
 * Minimal RFC4180-ish CSV line split (handles quotes and commas in names).
 * @param {string} line
 * @returns {string[]}
 */
export function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        cur += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out
}

/**
 * @param {string} headerLine
 * @param {string} dataLine
 * @returns {Record<string, string>}
 */
export function csvRowToObject(headerLine, dataLine) {
  const headers = parseCsvLine(headerLine)
  const values = parseCsvLine(dataLine)
  /** @type {Record<string, string>} */
  const row = {}
  for (let i = 0; i < headers.length; i += 1) {
    row[headers[i]] = values[i] ?? ''
  }
  return row
}
