#!/usr/bin/env node
/**
 * Upload Model A catalog search docs to Firestore (full replace).
 *
 * Collection: bggCatalogGames/{bggId}
 * Reads: data/bgg/catalog-search-docs.jsonl
 *
 * Uses firebase-admin (Application Default Credentials). Bypasses security rules.
 *
 * Usage (does not run unless you invoke it):
 *   npm run bgg:ranks:upload-index -- --confirm
 *
 * Auth (pick one):
 *   export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
 *   # Firebase Console → Project settings → Service accounts → Generate new private key
 *   # Keep the JSON outside git (never commit it).
 *
 *   # or, if you install the Google Cloud SDK:
 *   gcloud auth application-default login
 */
import { createRequire } from 'node:module'
import { copyFileSync, createReadStream, existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

export const BGG_CATALOG_GAMES_COLLECTION = 'bggCatalogGames'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const JSONL_PATH = path.join(ROOT, 'data', 'bgg', 'catalog-search-docs.jsonl')
const BATCH_LOG_EVERY = 5_000

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

function loadAdmin() {
  const require = createRequire(path.join(ROOT, 'functions', 'package.json'))
  try {
    return {
      adminApp: require('firebase-admin/app'),
      adminFirestore: require('firebase-admin/firestore'),
    }
  } catch {
    console.error('Missing firebase-admin. From repo root:')
    console.error('  npm install --prefix functions')
    process.exit(1)
  }
}

/**
 * @param {object} doc
 * @returns {object}
 */
export function firestorePayloadFromCatalogDoc(doc) {
  return {
    bggId: doc.bggId,
    name: doc.name,
    yearPublished: doc.yearPublished ?? null,
    rank: doc.rank ?? null,
    bayesAverage: doc.bayesAverage ?? null,
    average: doc.average ?? null,
    usersRated: doc.usersRated ?? null,
    searchPrefixes: Array.isArray(doc.searchPrefixes) ? doc.searchPrefixes : [],
    updatedAt: new Date().toISOString(),
  }
}

async function readCatalogDocs(jsonlPath) {
  const docs = []
  const rl = readline.createInterface({
    input: createReadStream(jsonlPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })
  let lineNo = 0
  for await (const line of rl) {
    lineNo += 1
    if (!line.trim()) continue
    let parsed
    try {
      parsed = JSON.parse(line)
    } catch {
      throw new Error(`Invalid JSON on line ${lineNo} of ${jsonlPath}`)
    }
    if (!parsed?.bggId) {
      throw new Error(`Missing bggId on line ${lineNo}`)
    }
    docs.push(parsed)
  }
  return docs
}

function printAuthHelp(projectId) {
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

async function main() {
  loadDotEnv(path.join(ROOT, '.env'))

  const confirm = process.argv.includes('--confirm')
  if (!confirm) {
    console.error('Refusing to upload without --confirm (full collection replace).')
    console.error('')
    console.error('Usage:')
    console.error('  npm run bgg:ranks:upload-index -- --confirm')
    process.exit(1)
  }

  if (!existsSync(JSONL_PATH)) {
    console.error(`Missing ${path.relative(ROOT, JSONL_PATH)}`)
    console.error('Run: npm run bgg:ranks:build-index')
    process.exit(1)
  }

  const projectId = envValue('VITE_FIREBASE_PROJECT_ID')
  if (!projectId) {
    console.error('Missing VITE_FIREBASE_PROJECT_ID (check .env)')
    process.exit(1)
  }

  const { adminApp, adminFirestore } = loadAdmin()
  const { applicationDefault, getApps, initializeApp } = adminApp
  const { getFirestore } = adminFirestore

  if (getApps().length === 0) {
    try {
      initializeApp({
        credential: applicationDefault(),
        projectId,
      })
    } catch (err) {
      console.error(err instanceof Error ? err.message : err)
      printAuthHelp(projectId)
      process.exit(1)
    }
  }

  const db = getFirestore()
  const col = db.collection(BGG_CATALOG_GAMES_COLLECTION)

  console.error(`Reading ${path.relative(ROOT, JSONL_PATH)}…`)
  const docs = await readCatalogDocs(JSONL_PATH)
  console.error(`Loaded ${docs.length} docs`)
  console.error(`Deleting existing ${BGG_CATALOG_GAMES_COLLECTION}/… (if any)`)
  await db.recursiveDelete(col)

  console.error(`Writing ${docs.length} docs to ${BGG_CATALOG_GAMES_COLLECTION}/{bggId}…`)
  const writer = db.bulkWriter()
  let written = 0
  writer.onWriteError((err) => {
    if (err.failedAttempts < 5) return true
    console.error(`Write failed for ${err.documentRef.path}: ${err.message}`)
    return false
  })

  for (const doc of docs) {
    const ref = col.doc(String(doc.bggId))
    writer.set(ref, firestorePayloadFromCatalogDoc(doc))
    written += 1
    if (written % BATCH_LOG_EVERY === 0) {
      console.error(`  queued ${written}/${docs.length}`)
    }
  }

  await writer.close()
  console.error(`Done. Wrote ${written} docs to ${projectId} / ${BGG_CATALOG_GAMES_COLLECTION}`)

  const csvPath = path.join(ROOT, 'data', 'bgg', 'boardgames_ranks.csv')
  const syncedPath = path.join(ROOT, 'data', 'bgg', 'boardgames_ranks.synced.csv')
  if (existsSync(csvPath)) {
    copyFileSync(csvPath, syncedPath)
    console.error(`Marked sync baseline → ${path.relative(ROOT, syncedPath)}`)
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  main().catch((err) => {
    console.error(err)
    if (/Could not load the default credentials|Unable to detect a Project Id/i.test(String(err))) {
      loadDotEnv(path.join(ROOT, '.env'))
      printAuthHelp(envValue('VITE_FIREBASE_PROJECT_ID'))
    }
    process.exit(1)
  })
}
