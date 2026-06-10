#!/usr/bin/env node
/**
 * Probe live Firebase RTDB with the same VITE_FIREBASE_* vars the Quasar app uses.
 * Writes then deletes gameTimerRooms/_connectivity_probe_* to mirror Game Timer hosting.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { deleteApp, initializeApp } from 'firebase/app'
import { get, getDatabase, ref, remove, set } from 'firebase/database'

const REQUIRED_ENV = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_DATABASE_URL',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
]

function loadDotEnv(envPath) {
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    if (!key || process.env[key] !== undefined) continue
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

function envValue(key) {
  return String(process.env[key] ?? '').trim()
}

function maskDatabaseUrl(url) {
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`
  } catch {
    return '(invalid URL)'
  }
}

function printMissingEnv(missing) {
  console.error(`Missing required env vars: ${missing.join(', ')}`)
  console.error('')
  console.error('Local dev: copy .env.example → .env, fill VITE_FIREBASE_*, restart `quasar dev`.')
  console.error('Secret names must include the VITE_ prefix (not FIREBASE_API_KEY alone).')
}

function printPermissionHelp(projectId) {
  console.error('')
  console.error('Permission denied usually means database.rules.json is not deployed.')
  console.error('Deploy RTDB rules from this repo:')
  console.error('  npx firebase-tools login')
  console.error(`  npx firebase-tools deploy --only database --project ${projectId}`)
}

function printDatabaseUrlHelp() {
  console.error('')
  console.error('Use the Realtime Database URL from Firebase Console → Build → Realtime Database.')
  console.error('It is not the Firestore URL. Common shapes:')
  console.error('  https://<project-id>-default-rtdb.firebaseio.com')
  console.error('  https://<project-id>-default-rtdb.<region>.firebasedatabase.app')
}

async function main() {
  loadDotEnv(path.join(process.cwd(), '.env'))

  const missing = REQUIRED_ENV.filter((key) => !envValue(key))
  if (missing.length > 0) {
    printMissingEnv(missing)
    process.exit(1)
  }

  const databaseURL = envValue('VITE_FIREBASE_DATABASE_URL')
  const projectId = envValue('VITE_FIREBASE_PROJECT_ID')

  if (/firestore\.googleapis\.com/i.test(databaseURL)) {
    console.error('VITE_FIREBASE_DATABASE_URL looks like a Firestore endpoint, not RTDB.')
    printDatabaseUrlHelp()
    process.exit(1)
  }

  const config = {
    apiKey: envValue('VITE_FIREBASE_API_KEY'),
    authDomain: envValue('VITE_FIREBASE_AUTH_DOMAIN'),
    databaseURL,
    projectId,
    appId: envValue('VITE_FIREBASE_APP_ID'),
  }

  const storageBucket = envValue('VITE_FIREBASE_STORAGE_BUCKET')
  if (storageBucket) config.storageBucket = storageBucket

  const messagingSenderId = envValue('VITE_FIREBASE_MESSAGING_SENDER_ID')
  if (messagingSenderId) config.messagingSenderId = messagingSenderId

  const app = initializeApp(config, `rtdb-probe-${Date.now()}`)
  const db = getDatabase(app)
  const probeRef = ref(db, `gameTimerRooms/_connectivity_probe_${Date.now()}`)

  try {
    await set(probeRef, { ok: true, at: Date.now() })
    const snap = await get(probeRef)
    if (!snap.exists()) {
      throw new Error('Write succeeded but read returned empty')
    }
    await remove(probeRef)
    console.log('OK: RTDB read/write on gameTimerRooms/{suffix} works.')
    console.log(`  database: ${maskDatabaseUrl(databaseURL)}`)
    console.log(`  project:  ${projectId}`)
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : ''
    const message = err instanceof Error ? err.message : String(err)
    console.error(`RTDB probe failed: ${code || message}`)

    if (code === 'PERMISSION_DENIED' || /permission/i.test(message)) {
      printPermissionHelp(projectId)
    } else if (/invalid.*url|404|not found|Failed to get/i.test(message)) {
      printDatabaseUrlHelp()
    }

    process.exit(1)
  } finally {
    await deleteApp(app).catch(() => {})
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
