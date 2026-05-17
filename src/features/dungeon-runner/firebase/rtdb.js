import { getApps, initializeApp } from 'firebase/app'
import { getDatabase, ref, set } from 'firebase/database'

const COMPLETED_MATCHES_ROOT = 'dungeonRunnerCompletedMatches'

/** @param {Record<string, unknown>} env */
function envString(env, key) {
  const fromMeta = String(env[key] ?? '').trim()
  if (fromMeta) return fromMeta
  const fromProcess =
    typeof process !== 'undefined' && process.env ? process.env[key] : undefined
  return String(fromProcess ?? '').trim()
}

/** @returns {import('firebase/app').FirebaseOptions | null} */
function readFirebaseConfig() {
  const env = typeof import.meta.env !== 'undefined' ? import.meta.env : {}
  const apiKey = envString(env, 'VITE_FIREBASE_API_KEY')
  const authDomain = envString(env, 'VITE_FIREBASE_AUTH_DOMAIN')
  const databaseURL = envString(env, 'VITE_FIREBASE_DATABASE_URL')
  const projectId = envString(env, 'VITE_FIREBASE_PROJECT_ID')
  const appId = envString(env, 'VITE_FIREBASE_APP_ID')

  if (!apiKey || !authDomain || !databaseURL || !projectId || !appId) {
    return null
  }

  /** @type {import('firebase/app').FirebaseOptions} */
  const config = {
    apiKey,
    authDomain,
    databaseURL,
    projectId,
    appId,
  }

  const storageBucket = envString(env, 'VITE_FIREBASE_STORAGE_BUCKET')
  if (storageBucket) config.storageBucket = storageBucket

  const messagingSenderId = envString(env, 'VITE_FIREBASE_MESSAGING_SENDER_ID')
  if (messagingSenderId) config.messagingSenderId = messagingSenderId

  return config
}

/** @type {import('firebase/database').Database | null} */
let databaseInstance = null

/**
 * @returns {boolean}
 */
export function isDungeonRunnerFirebaseConfigured() {
  return readFirebaseConfig() !== null
}

/**
 * @returns {import('firebase/database').Database | null}
 */
export function getDungeonRunnerDatabase() {
  if (databaseInstance) return databaseInstance

  const config = readFirebaseConfig()
  if (!config) return null

  const app = getApps().length > 0 ? getApps()[0] : initializeApp(config)
  databaseInstance = getDatabase(app)
  return databaseInstance
}

/**
 * RTDB path for a completed match (no leading slash).
 * @param {string} matchId
 * @returns {string}
 */
export function dungeonRunnerCompletedMatchPath(matchId) {
  return `${COMPLETED_MATCHES_ROOT}/${matchId}`
}

/**
 * @param {string} matchId
 * @returns {import('firebase/database').DatabaseReference | null}
 */
export function dungeonRunnerCompletedMatchRef(matchId) {
  const db = getDungeonRunnerDatabase()
  if (!db) return null
  return ref(db, dungeonRunnerCompletedMatchPath(matchId))
}

/**
 * RTDB rejects `undefined` anywhere in the tree; replay envelopes may omit
 * optional fields as undefined.
 * @param {unknown} value
 * @returns {unknown}
 */
export function sanitizeForRtdb(value) {
  if (value === undefined) return null
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((item) => sanitizeForRtdb(item))
  /** @type {Record<string, unknown>} */
  const out = {}
  for (const [key, child] of Object.entries(value)) {
    if (child === undefined) continue
    out[key] = sanitizeForRtdb(child)
  }
  return out
}

/**
 * @param {import('firebase/database').DatabaseReference} dbRef
 * @param {unknown} value
 * @returns {Promise<void>}
 */
export function setRtdb(dbRef, value) {
  return set(dbRef, sanitizeForRtdb(value))
}
