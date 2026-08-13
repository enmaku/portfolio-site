/**
 * Shared firebase-admin helpers for local scripts.
 */
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = path.resolve(__dirname, '../..')

export function loadDotEnv(envPath) {
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

export function envValue(key) {
  return String(process.env[key] ?? '').trim()
}

export function printFirestoreAuthHelp(projectId) {
  console.error('')
  console.error('Firestore admin auth failed. Easiest without gcloud:')
  console.error('  1. Firebase Console → Project settings → Service accounts')
  console.error('  2. Generate new private key (JSON)')
  console.error('  3. Store it outside the repo, then:')
  console.error('       export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/key.json')
  console.error(`  Project should be: ${projectId || '(set VITE_FIREBASE_PROJECT_ID)'}`)
  console.error('')
  console.error('Or install Google Cloud SDK and run:')
  console.error('  brew install --cask google-cloud-sdk')
  console.error('  gcloud auth application-default login')
}

function loadAdminModules() {
  const require = createRequire(path.join(REPO_ROOT, 'functions', 'package.json'))
  try {
    return {
      adminApp: require('firebase-admin/app'),
      adminFirestore: require('firebase-admin/firestore'),
    }
  } catch {
    throw new Error('Missing firebase-admin. From repo root: npm install --prefix functions')
  }
}

/**
 * @returns {{ db: import('firebase-admin/firestore').Firestore, projectId: string }}
 */
export function initLocalFirestore() {
  loadDotEnv(path.join(REPO_ROOT, '.env'))
  const projectId = envValue('VITE_FIREBASE_PROJECT_ID')
  if (!projectId) {
    throw new Error('Missing VITE_FIREBASE_PROJECT_ID (check .env)')
  }
  const { adminApp, adminFirestore } = loadAdminModules()
  const { applicationDefault, getApps, initializeApp } = adminApp
  const { getFirestore } = adminFirestore
  if (getApps().length === 0) {
    try {
      initializeApp({
        credential: applicationDefault(),
        projectId,
      })
    } catch (err) {
      printFirestoreAuthHelp(projectId)
      throw err
    }
  }
  return { db: getFirestore(), projectId }
}
