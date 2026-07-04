import {
  resolveColonizationSlice,
  serializeColonizationSessionForStorage,
} from '../../world-builder/core/colonization/createDefaultColonizationSlice.js'

const DB_NAME = 'portfolio-world-builder'
const DB_VERSION = 1
const STORE_NAME = 'terrainCache'
const RECORD_KEY = 'colonizationSession'

/**
 * @returns {Promise<IDBDatabase>}
 */
function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error ?? new Error('Failed to open colonization cache'))
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
function objectStore(db, mode) {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME)
}

/**
 * @param {string} fingerprint
 * @param {import('../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonizationSlice} session
 * @returns {Promise<void>}
 */
export async function saveColonizationSession(fingerprint, session) {
  const db = await openDb()
  try {
    const payload = serializeColonizationSessionForStorage(session)
    await new Promise((resolve, reject) => {
      const request = objectStore(db, 'readwrite').put(
        {
          fingerprint,
          session: payload,
          savedAt: Date.now(),
        },
        RECORD_KEY,
      )
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error ?? new Error('Failed to save colonization session'))
    })
  } finally {
    db.close()
  }
}

/**
 * @param {string} fingerprint
 * @returns {Promise<import('../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonizationSlice | null>}
 */
export async function loadColonizationSession(fingerprint) {
  const db = await openDb()
  try {
    /** @type {{ fingerprint: string, session: unknown, savedAt?: number } | undefined} */
    const record = await new Promise((resolve, reject) => {
      const request = objectStore(db, 'readonly').get(RECORD_KEY)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Failed to load colonization session'))
    })
    if (!record || record.fingerprint !== fingerprint) {
      return null
    }
    return resolveColonizationSlice(record.session)
  } finally {
    db.close()
  }
}

/**
 * @returns {Promise<void>}
 */
export async function clearColonizationSession() {
  const db = await openDb()
  try {
    await new Promise((resolve, reject) => {
      const request = objectStore(db, 'readwrite').delete(RECORD_KEY)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error ?? new Error('Failed to clear colonization session'))
    })
  } finally {
    db.close()
  }
}
