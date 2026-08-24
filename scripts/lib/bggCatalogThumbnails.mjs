/**
 * BGG /thing thumbnail harvest for catalog-search-docs.jsonl (no stats).
 */

export const THING_BATCH_SIZE = 20
export const THUMB_FETCH_GAP_MS = 5_000
export const BGG_THING_URL = 'https://boardgamegeek.com/xmlapi2/thing'

/**
 * @param {unknown} value
 * @returns {string}
 */
export function nonEmptyUrl(value) {
  const url = String(value ?? '').trim()
  return url.startsWith('http') ? url : ''
}

/**
 * @param {object[]} docs
 * @param {Iterable<string>} [alreadyDone]
 * @returns {string[]}
 */
export function idsMissingThumbnail(docs, alreadyDone = []) {
  const done = new Set([...alreadyDone].map((id) => String(id)))
  const ids = []
  const seen = new Set()
  for (const doc of docs) {
    const id = String(doc?.bggId ?? '').trim()
    if (!/^\d+$/.test(id) || seen.has(id) || done.has(id)) continue
    if (nonEmptyUrl(doc.thumbnailUrl)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

/**
 * @template T
 * @param {T[]} items
 * @param {number} [size]
 * @returns {T[][]}
 */
export function chunkIds(items, size = THING_BATCH_SIZE) {
  const chunks = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

/**
 * @param {string} xml
 * @returns {Map<string, string | null>}
 */
export function parseThingThumbnailsXml(xml) {
  /** @type {Map<string, string | null>} */
  const byId = new Map()
  const text = String(xml ?? '')
  const itemRe = /<item\b([^>]*)>([\s\S]*?)<\/item>/gi
  let match = itemRe.exec(text)
  while (match) {
    const idMatch = /\bid="(\d+)"/.exec(match[1] || '')
    const id = idMatch ? idMatch[1] : ''
    if (id) {
      const thumbMatch = /<thumbnail>([^<]*)<\/thumbnail>/i.exec(match[2] || '')
      const url = nonEmptyUrl(decodeXmlText(thumbMatch ? thumbMatch[1] : ''))
      byId.set(id, url || null)
    }
    match = itemRe.exec(text)
  }
  return byId
}

/**
 * @param {object[]} docs
 * @param {Map<string, string | null>} urlById
 * @returns {number}
 */
export function applyThumbnailsToDocs(docs, urlById) {
  let updated = 0
  for (const doc of docs) {
    const id = String(doc?.bggId ?? '').trim()
    if (!urlById.has(id)) continue
    const url = urlById.get(id)
    if (typeof url === 'string' && url) {
      if (doc.thumbnailUrl !== url) {
        doc.thumbnailUrl = url
        updated += 1
      }
    } else if (!nonEmptyUrl(doc.thumbnailUrl)) {
      doc.thumbnailUrl = null
    }
  }
  return updated
}

/**
 * @param {string} apiKey
 * @param {string[]} ids
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 */
export async function fetchThingThumbnailsXml(apiKey, ids, opts = {}) {
  const key = String(apiKey || '').trim()
  if (!key) throw new Error('GAME_MANAGER_API_KEY is not configured')
  const idList = ids.map((id) => String(id).trim()).filter((id) => /^\d+$/.test(id))
  if (idList.length === 0) return ''

  const url = new URL(BGG_THING_URL)
  url.searchParams.set('id', idList.join(','))

  const fetchImpl = opts.fetchImpl ?? fetch
  const response = await fetchImpl(url.toString(), {
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/xml,text/xml,*/*',
    },
  })
  const body = await response.text()
  if (!response.ok) {
    const err = new Error(`BGG /thing HTTP ${response.status}`)
    err.status = response.status
    err.body = body
    throw err
  }
  return body
}

/**
 * @param {string} apiKey
 * @param {string[]} ids
 * @param {{
 *   fetchImpl?: typeof fetch,
 *   sleep?: (ms: number) => Promise<void>,
 *   gapMs?: number,
 *   onBatch?: (info: { ids: string[], urlById: Map<string, string | null> }) => Promise<void> | void,
 * }} [opts]
 * @returns {Promise<Map<string, string | null>>}
 */
export async function fetchThumbnailUrlsForIds(apiKey, ids, opts = {}) {
  const sleep = opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  const gapMs = opts.gapMs ?? THUMB_FETCH_GAP_MS
  /** @type {Map<string, string | null>} */
  const all = new Map()
  const chunks = chunkIds(ids, THING_BATCH_SIZE)

  for (let i = 0; i < chunks.length; i += 1) {
    if (i > 0) await sleep(gapMs)
    const chunk = chunks[i]
    const urlById = await fetchThingChunkWithRetry(apiKey, chunk, opts)
    for (const [id, url] of urlById) all.set(id, url)
    if (opts.onBatch) await opts.onBatch({ ids: chunk, urlById })
  }
  return all
}

/**
 * @param {string} apiKey
 * @param {string[]} ids
 * @param {{ fetchImpl?: typeof fetch, sleep?: (ms: number) => Promise<void> }} [opts]
 */
async function fetchThingChunkWithRetry(apiKey, ids, opts = {}) {
  const sleep = opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  let delayMs = THUMB_FETCH_GAP_MS
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const xml = await fetchThingThumbnailsXml(apiKey, ids, opts)
      return parseThingThumbnailsXml(xml)
    } catch (err) {
      const status = typeof err?.status === 'number' ? err.status : 0
      const retryable = status === 429 || status === 500 || status === 502 || status === 503
      if (!retryable || attempt === 5) throw err
      await sleep(delayMs)
      delayMs = Math.min(delayMs * 2, 60_000)
    }
  }
  return new Map()
}

/**
 * @param {string} raw
 * @returns {string}
 */
function decodeXmlText(raw) {
  return String(raw ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim()
}
