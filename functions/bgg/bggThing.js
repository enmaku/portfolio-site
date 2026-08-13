const { fetchBgg } = require('./fetchBgg')
const { normalizeBggThingListXml } = require('./normalize')

const MAX_BATCH = 20
const THING_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const BGG_THING_CACHE_COLLECTION = 'bggThingCache'

/**
 * @returns {FirebaseFirestore.Firestore}
 */
function getFirestore() {
  const admin = require('firebase-admin')
  if (!admin.apps.length) {
    admin.initializeApp()
  }
  return admin.firestore()
}

/**
 * @param {string} raw
 * @returns {string[]}
 */
function parseThingIds(raw) {
  return String(raw || '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => /^\d+$/.test(part))
    .slice(0, MAX_BATCH)
}

/**
 * @param {FirebaseFirestore.DocumentData | undefined | null} data
 * @param {number} [nowMs]
 * @returns {object | null}
 */
function freshCachedEntry(data, nowMs = Date.now()) {
  if (!data || typeof data !== 'object') return null
  const entry = data.entry
  if (!entry || typeof entry !== 'object') return null
  const cachedAtMs = typeof data.cachedAtMs === 'number' ? data.cachedAtMs : NaN
  if (!Number.isFinite(cachedAtMs)) return null
  if (nowMs - cachedAtMs >= THING_CACHE_TTL_MS) return null
  return entry
}

/**
 * Cache-first BGG /thing resolver. Fresh Firestore hits skip fetchBgg (and its rate limiter).
 * Upstream refreshes always request stats=1 so one cached doc serves both stats modes for 24h.
 *
 * @param {string[]} bggIds
 * @param {{
 *   db?: FirebaseFirestore.Firestore,
 *   fetchBggImpl?: typeof fetchBgg,
 *   normalizeThingListXml?: typeof normalizeBggThingListXml,
 *   nowMs?: number,
 * }} [deps]
 */
async function resolveBggThings(bggIds, deps = {}) {
  const ids = [...new Set((bggIds || []).map((id) => String(id || '').trim()).filter((id) => /^\d+$/.test(id)))].slice(
    0,
    MAX_BATCH,
  )
  if (ids.length === 0) {
    return { entries: [], wroteIds: [] }
  }

  const db = deps.db || getFirestore()
  const fetchBggImpl = deps.fetchBggImpl || fetchBgg
  const normalizeThingListXml = deps.normalizeThingListXml || normalizeBggThingListXml
  const nowMs = typeof deps.nowMs === 'number' ? deps.nowMs : Date.now()

  const collection = db.collection(BGG_THING_CACHE_COLLECTION)
  const refs = ids.map((id) => collection.doc(id))
  const snaps = typeof db.getAll === 'function' ? await db.getAll(...refs) : await Promise.all(refs.map((ref) => ref.get()))

  /** @type {Map<string, object>} */
  const byId = new Map()
  /** @type {string[]} */
  const misses = []

  ids.forEach((id, index) => {
    const snap = snaps[index]
    const data = snap?.exists ? snap.data() : null
    const entry = freshCachedEntry(data, nowMs)
    if (entry) {
      byId.set(id, entry)
    } else {
      misses.push(id)
    }
  })

  /** @type {string[]} */
  const wroteIds = []

  if (misses.length > 0) {
    const upstream = await fetchBggImpl('/thing', { id: misses.join(','), stats: '1' })
    const xml = await upstream.text()
    if (!upstream.ok) {
      const err = new Error('upstream_error')
      err.status = upstream.status >= 400 ? upstream.status : 502
      throw err
    }

    const fetched = normalizeThingListXml(xml)
    /** @type {Map<string, object>} */
    const fetchedById = new Map()
    for (const entry of fetched) {
      const id = String(entry.catalogEntryId || '').trim()
      if (id) fetchedById.set(id, entry)
    }

    const writer = typeof db.batch === 'function' ? db.batch() : null
    /** @type {{ ref: FirebaseFirestore.DocumentReference, entry: object }[]} */
    const pendingWrites = []

    for (const id of misses) {
      const entry = fetchedById.get(id)
      if (!entry) continue
      byId.set(id, entry)
      pendingWrites.push({ ref: collection.doc(id), entry })
      wroteIds.push(id)
    }

    if (pendingWrites.length > 0) {
      const payloadBase = { cachedAtMs: nowMs }
      if (writer) {
        for (const row of pendingWrites) {
          writer.set(row.ref, { ...payloadBase, entry: row.entry }, { merge: true })
        }
        await writer.commit()
      } else {
        await Promise.all(
          pendingWrites.map((row) => row.ref.set({ ...payloadBase, entry: row.entry }, { merge: true })),
        )
      }
    }
  }

  return {
    entries: ids.map((id) => byId.get(id)).filter(Boolean),
    wroteIds,
  }
}

/**
 * @param {import('firebase-functions/v2/https').Request} req
 * @param {import('firebase-functions/v2/https').Response} res
 * @param {{ resolve?: typeof resolveBggThings }} [deps]
 */
async function bggThingHandler(req, res, deps = {}) {
  if (req.method !== 'GET') {
    res.set('Allow', 'GET')
    res.status(405).json({ error: 'method_not_allowed', entry: null, entries: [] })
    return
  }

  const ids = parseThingIds(req.query.id)
  if (ids.length === 0) {
    res.status(400).json({ error: 'missing_id', entry: null, entries: [] })
    return
  }

  const resolve = deps.resolve || resolveBggThings

  try {
    const { entries } = await resolve(ids)
    if (entries.length === 0) {
      res.status(404).json({ error: 'not_found', entry: null, entries: [] })
      return
    }

    // Single-id clients keep reading `entry`; batch clients use `entries`.
    res.status(200).json({
      entry: entries[0],
      entries,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    if (message.includes('GAME_MANAGER_API_KEY')) {
      res.status(500).json({ error: message, entry: null, entries: [] })
      return
    }
    const status = typeof err?.status === 'number' ? err.status : 502
    res.status(status).json({ error: message, entry: null, entries: [] })
  }
}

module.exports = {
  MAX_BATCH,
  THING_CACHE_TTL_MS,
  BGG_THING_CACHE_COLLECTION,
  bggThingHandler,
  parseThingIds,
  freshCachedEntry,
  resolveBggThings,
}
