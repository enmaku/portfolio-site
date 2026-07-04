import { cloneWorldDocument } from '../../world-builder/core/cloneWorldDocument.js'
import { stripColonizationFromWorldDocument } from '../../world-builder/core/terrainCacheFingerprint.js'

const DB_NAME = 'portfolio-world-builder'
const DB_VERSION = 1
const STORE_NAME = 'terrainCache'
const RECORD_KEY = 'lockedTerrain'

/**
 * @typedef {Object} LockedTerrainCachePayload
 * @property {string} fingerprint
 * @property {import('../../world-builder/core/types.js').WorldDocument} worldDocument
 */

/**
 * @typedef {Object} LockedTerrainCacheRecord
 * @property {import('../../world-builder/core/types.js').WorldDocument} worldDocument
 */

/**
 * @returns {Promise<IDBDatabase>}
 */
function openTerrainCacheDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error ?? new Error('Failed to open terrain cache'))
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

/**
 * @param {IDBDatabase} db
 * @param {'readonly' | 'readwrite'} mode
 * @returns {IDBObjectStore}
 */
function store(db, mode) {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME)
}

/**
 * @param {LockedTerrainCachePayload} payload
 * @returns {Promise<void>}
 */
export async function saveLockedTerrain(payload) {
  const db = await openTerrainCacheDb()
  try {
    const record = {
      fingerprint: payload.fingerprint,
      worldDocument: stripColonizationFromWorldDocument(cloneWorldDocument(payload.worldDocument)),
      savedAt: Date.now(),
    }
    await new Promise((resolve, reject) => {
      const request = store(db, 'readwrite').put(record, RECORD_KEY)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error ?? new Error('Failed to save terrain cache'))
    })
  } finally {
    db.close()
  }
}

/**
 * @param {string} fingerprint
 * @returns {Promise<LockedTerrainCacheRecord | null>}
 */
export async function loadLockedTerrain(fingerprint) {
  const db = await openTerrainCacheDb()
  try {
    /** @type {{ fingerprint: string, worldDocument: import('../../world-builder/core/types.js').WorldDocument, savedAt?: number } | undefined} */
    const record = await new Promise((resolve, reject) => {
      const request = store(db, 'readonly').get(RECORD_KEY)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Failed to load terrain cache'))
    })
    if (!record || record.fingerprint !== fingerprint || !record.worldDocument) {
      return null
    }
    return {
      worldDocument: cloneWorldDocument(stripColonizationFromWorldDocument(record.worldDocument)),
    }
  } finally {
    db.close()
  }
}

/**
 * @returns {Promise<void>}
 */
export async function clearLockedTerrain() {
  const db = await openTerrainCacheDb()
  try {
    await new Promise((resolve, reject) => {
      const request = store(db, 'readwrite').delete(RECORD_KEY)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error ?? new Error('Failed to clear terrain cache'))
    })
  } finally {
    db.close()
  }
}
