import { getApps, initializeApp } from 'firebase/app'
import { getDatabase as firebaseGetDatabase, set } from 'firebase/database'

const REQUIRED_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_DATABASE_URL',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
]

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
 * RTDB rejects `undefined` anywhere in the tree; Pinia/JS objects often omit
 * optional fields as undefined (e.g. snapshot `totalGameStartedAt`, `players[].bankedMsByRound`).
 * @param {unknown} value
 * @returns {unknown}
 */
function sanitizeForRtdb(value) {
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
 * @param {{ configuredBehavior: 'throw' | 'null', label?: string }} options
 * @returns {{
 *   getDatabase: () => import('firebase/database').Database | null,
 *   isConfigured: () => boolean,
 *   sanitizeForRtdb: (value: unknown) => unknown,
 *   setRtdb: (dbRef: import('firebase/database').DatabaseReference, value: unknown) => Promise<void>,
 * }}
 */
export function createRtdbCore({ configuredBehavior, label }) {
  function isConfigured() {
    return readFirebaseConfig() !== null
  }

  function getDatabase() {
    if (databaseInstance) return databaseInstance

    const config = readFirebaseConfig()
    if (!config) {
      if (configuredBehavior === 'null') return null

      const env = typeof import.meta.env !== 'undefined' ? import.meta.env : {}
      const missing = REQUIRED_ENV_KEYS.filter((key) => !envString(env, key))
      const missingHint =
        missing.length > 0 ? ` Missing: ${missing.join(', ')}.` : ''
      const labelPrefix = label ? `${label} is not configured. ` : ''
      throw new Error(
        `${labelPrefix}Set VITE_FIREBASE_* in .env (see .env.example).${missingHint}`,
      )
    }

    const app = getApps().length > 0 ? getApps()[0] : initializeApp(config)
    databaseInstance = firebaseGetDatabase(app)
    return databaseInstance
  }

  function setRtdb(dbRef, value) {
    return set(dbRef, sanitizeForRtdb(value))
  }

  return {
    getDatabase,
    isConfigured,
    sanitizeForRtdb,
    setRtdb,
  }
}
