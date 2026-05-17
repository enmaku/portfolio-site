import { getApps, initializeApp } from 'firebase/app'
import { getDatabase, ref, set } from 'firebase/database'

const ROOMS_ROOT = 'movieVoteRooms'

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

// getMovieVoteDatabase() throws when required VITE_FIREBASE_* vars are unset.
/**
 * @returns {import('firebase/database').Database}
 */
export function getMovieVoteDatabase() {
  if (databaseInstance) return databaseInstance

  const config = readFirebaseConfig()
  if (!config) {
    const env = typeof import.meta.env !== 'undefined' ? import.meta.env : {}
    const required = [
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN',
      'VITE_FIREBASE_DATABASE_URL',
      'VITE_FIREBASE_PROJECT_ID',
      'VITE_FIREBASE_APP_ID',
    ]
    const missing = required.filter((key) => !envString(env, key))
    const missingHint =
      missing.length > 0 ? ` Missing: ${missing.join(', ')}.` : ''
    throw new Error(
      `Movie Vote Firebase RTDB is not configured. Set VITE_FIREBASE_* in .env (see .env.example).${missingHint}`,
    )
  }

  const app = getApps().length > 0 ? getApps()[0] : initializeApp(config)
  databaseInstance = getDatabase(app)
  return databaseInstance
}

/**
 * RTDB path for a room suffix (no leading slash).
 * @param {string} suffix
 * @returns {string}
 */
export function movieVoteRoomPath(suffix) {
  return `${ROOMS_ROOT}/${suffix}`
}

/**
 * @param {string} suffix
 * @returns {import('firebase/database').DatabaseReference}
 */
export function movieVoteRoomRef(suffix) {
  return ref(getMovieVoteDatabase(), movieVoteRoomPath(suffix))
}

/**
 * RTDB rejects `undefined` anywhere in the tree; Pinia/JS objects often omit
 * optional fields as undefined (e.g. ballotMovies[].customKey for TMDB picks).
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
