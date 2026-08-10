const admin = require('firebase-admin')
const { fetchBgg } = require('./fetchBgg')
const { normalizeBggThingListXml } = require('./normalize')

const MAX_IDS = 40
const BGG_THING_CHUNK = 20
const BGG_CATALOG_GAMES_COLLECTION = 'bggCatalogGames'
const BGG_THING_CACHE_COLLECTION = 'bggThingCache'

/**
 * @returns {FirebaseFirestore.Firestore}
 */
function getFirestore() {
  if (!admin.apps.length) {
    admin.initializeApp()
  }
  return admin.firestore()
}

/**
 * Accept `?id=1,2,3`, repeated query ids, or a trailing path `/{id}`.
 *
 * @param {import('firebase-functions/v2/https').Request} req
 * @returns {string[]}
 */
function parseThumbIds(req) {
  /** @type {string[]} */
  const collected = []

  const queryId = req.query?.id
  if (Array.isArray(queryId)) {
    for (const part of queryId) {
      collected.push(...String(part).split(','))
    }
  } else if (queryId != null && String(queryId).trim()) {
    collected.push(...String(queryId).split(','))
  }

  if (collected.length === 0) {
    const candidates = [String(req.path || ''), String(req.url || '').split('?')[0]]
    for (const path of candidates) {
      const match = path.match(/\/(\d+)\/?$/)
      if (match) {
        collected.push(match[1])
        break
      }
    }
  }

  const seen = new Set()
  /** @type {string[]} */
  const ids = []
  for (const raw of collected) {
    const id = String(raw || '').trim()
    if (!/^\d+$/.test(id) || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
    if (ids.length >= MAX_IDS) break
  }
  return ids
}

/**
 * @param {FirebaseFirestore.DocumentData | undefined | null} data
 * @returns {string | null}
 */
function cachedThumbnailUrl(data) {
  if (!data || typeof data !== 'object') return null
  return typeof data.thumbnailUrl === 'string' && data.thumbnailUrl ? data.thumbnailUrl : null
}

/**
 * @param {FirebaseFirestore.DocumentData | undefined | null} data
 * @returns {string | null}
 */
function thingCacheThumbnailUrl(data) {
  if (!data || typeof data !== 'object') return null
  const entry = data.entry
  if (!entry || typeof entry !== 'object') return null
  return typeof entry.thumbnailUrl === 'string' && entry.thumbnailUrl ? entry.thumbnailUrl : null
}

/**
 * @param {string[]} ids
 * @param {number} size
 * @returns {string[][]}
 */
function chunkIds(ids, size) {
  /** @type {string[][]} */
  const chunks = []
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size))
  }
  return chunks
}

/**
 * Cache-first batch thumbnail resolver (search list art only).
 *
 * @param {string[]} bggIds
 * @param {{
 *   db?: FirebaseFirestore.Firestore,
 *   fetchBggImpl?: typeof fetchBgg,
 *   normalizeThingListXml?: typeof normalizeBggThingListXml,
 * }} [deps]
 */
async function resolveCatalogThumbs(bggIds, deps = {}) {
  const ids = [...new Set((bggIds || []).map((id) => String(id || '').trim()).filter((id) => /^\d+$/.test(id)))].slice(
    0,
    MAX_IDS,
  )
  if (ids.length === 0) {
    return { results: [], wroteIds: [] }
  }

  const db = deps.db || getFirestore()
  const fetchBggImpl = deps.fetchBggImpl || fetchBgg
  const normalizeThingListXml = deps.normalizeThingListXml || normalizeBggThingListXml

  const catalog = db.collection(BGG_CATALOG_GAMES_COLLECTION)
  const thingCache = db.collection(BGG_THING_CACHE_COLLECTION)
  const catalogRefs = ids.map((id) => catalog.doc(id))
  const thingRefs = ids.map((id) => thingCache.doc(id))
  const allRefs = [...catalogRefs, ...thingRefs]
  const snaps =
    typeof db.getAll === 'function'
      ? await db.getAll(...allRefs)
      : await Promise.all(allRefs.map((ref) => ref.get()))
  const catalogSnaps = snaps.slice(0, ids.length)
  const thingSnaps = snaps.slice(ids.length)

  /** @type {Map<string, { exists: boolean, thumbnailUrl: string | null }>} */
  const docState = new Map()
  /** @type {Map<string, { catalogEntryId: string, thumbnailUrl: string | null, source: string }>} */
  const byId = new Map()
  /** @type {string[]} */
  const misses = []
  /** @type {{ ref: FirebaseFirestore.DocumentReference, thumbnailUrl: string }[]} */
  const pendingWrites = []

  ids.forEach((id, index) => {
    const snap = catalogSnaps[index]
    const exists = Boolean(snap?.exists)
    const data = exists ? snap.data() : null
    const catalogThumb = cachedThumbnailUrl(data)
    const thingThumb = thingCacheThumbnailUrl(thingSnaps[index]?.exists ? thingSnaps[index].data() : null)
    docState.set(id, { exists, thumbnailUrl: catalogThumb })

    if (catalogThumb) {
      byId.set(id, { catalogEntryId: id, thumbnailUrl: catalogThumb, source: 'cache' })
      return
    }

    if (thingThumb) {
      byId.set(id, { catalogEntryId: id, thumbnailUrl: thingThumb, source: 'thing_cache' })
      if (exists) {
        pendingWrites.push({ ref: catalog.doc(id), thumbnailUrl: thingThumb })
      }
      return
    }

    misses.push(id)
  })

  /** @type {string[]} */
  const wroteIds = []

  if (misses.length > 0) {
    /** @type {Map<string, string>} */
    const fetched = new Map()

    for (const chunk of chunkIds(misses, BGG_THING_CHUNK)) {
      const upstream = await fetchBggImpl('/thing', { id: chunk.join(',') })
      const xml = await upstream.text()
      if (!upstream.ok) {
        const err = new Error('upstream_error')
        err.status = upstream.status >= 400 ? upstream.status : 502
        throw err
      }

      const entries = normalizeThingListXml(xml)
      for (const entry of entries) {
        const id = String(entry.catalogEntryId || '').trim()
        const thumbnailUrl = entry.thumbnailUrl || null
        if (id && thumbnailUrl) {
          fetched.set(id, thumbnailUrl)
        }
      }
    }

    for (const id of misses) {
      const thumbnailUrl = fetched.get(id) || null
      if (!thumbnailUrl) {
        byId.set(id, { catalogEntryId: id, thumbnailUrl: null, source: 'missing' })
        continue
      }

      byId.set(id, { catalogEntryId: id, thumbnailUrl, source: 'bgg' })
      if (docState.get(id)?.exists) {
        pendingWrites.push({ ref: catalog.doc(id), thumbnailUrl })
      }
    }
  }

  if (pendingWrites.length > 0) {
    const writer = typeof db.batch === 'function' ? db.batch() : null
    if (writer) {
      for (const row of pendingWrites) {
        writer.set(row.ref, { thumbnailUrl: row.thumbnailUrl }, { merge: true })
        wroteIds.push(row.ref.id)
      }
      await writer.commit()
    } else {
      await Promise.all(
        pendingWrites.map((row) => {
          wroteIds.push(row.ref.id)
          return row.ref.set({ thumbnailUrl: row.thumbnailUrl }, { merge: true })
        }),
      )
    }
  }

  return {
    results: ids.map(
      (id) => byId.get(id) || { catalogEntryId: id, thumbnailUrl: null, source: 'missing' },
    ),
    wroteIds,
  }
}

/**
 * @param {import('firebase-functions/v2/https').Request} req
 * @param {import('firebase-functions/v2/https').Response} res
 * @param {{ resolve?: typeof resolveCatalogThumbs }} [deps]
 */
async function bggThumbHandler(req, res, deps = {}) {
  if (req.method !== 'GET') {
    res.set('Allow', 'GET')
    res.status(405).json({ error: 'method_not_allowed', results: [] })
    return
  }

  const ids = parseThumbIds(req)
  if (ids.length === 0) {
    res.status(400).json({ error: 'missing_id', results: [] })
    return
  }

  const resolve = deps.resolve || resolveCatalogThumbs

  try {
    const { results } = await resolve(ids)
    res.status(200).json({ results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    if (message.includes('GAME_MANAGER_API_KEY')) {
      res.status(500).json({ error: message, results: [] })
      return
    }
    const status = typeof err?.status === 'number' ? err.status : 502
    res.status(status).json({ error: message, results: [] })
  }
}

module.exports = {
  MAX_IDS,
  BGG_THING_CHUNK,
  BGG_CATALOG_GAMES_COLLECTION,
  BGG_THING_CACHE_COLLECTION,
  bggThumbHandler,
  parseThumbIds,
  cachedThumbnailUrl,
  thingCacheThumbnailUrl,
  chunkIds,
  resolveCatalogThumbs,
}
