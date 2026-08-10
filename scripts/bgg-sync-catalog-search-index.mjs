#!/usr/bin/env node
/**
 * Incremental BGG catalog sync → Firestore bggCatalogGames.
 *
 * 1. Download latest ranks CSV (Playwright session; interactive login if needed)
 * 2. Diff against last successfully synced CSV (boardgames_ranks.synced.csv)
 * 3. Apply add/change/delete to Firestore (unless --dry-run)
 * 4. On success, promote CSV to current + synced baselines
 *
 * Usage:
 *   npm run bgg:ranks:sync
 *   npm run bgg:ranks:sync -- --dry-run
 *
 * Firestore auth: GOOGLE_APPLICATION_CREDENTIALS (service account JSON)
 */
import { copyFileSync, existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BGG_CATALOG_GAMES_COLLECTION,
  firestorePayloadFromCatalogDoc,
} from './bgg-upload-catalog-search-index.mjs'
import { diffCatalogDocMaps, loadCatalogDocMapFromRanksCsv } from './lib/bggCatalogSearchDiff.mjs'
import { BGG_DATA_DIR, downloadBggRanksCsvWithReauth } from './lib/bggRanksDump.mjs'
import {
  envValue,
  initLocalFirestore,
  loadDotEnv,
  printFirestoreAuthHelp,
  REPO_ROOT,
} from './lib/firebaseAdminLocal.mjs'

const CSV_PATH = path.join(BGG_DATA_DIR, 'boardgames_ranks.csv')
const SYNCED_CSV_PATH = path.join(BGG_DATA_DIR, 'boardgames_ranks.synced.csv')
const INCOMING_CSV_PATH = path.join(BGG_DATA_DIR, 'boardgames_ranks.incoming.csv')
const DIFF_PATH = path.join(BGG_DATA_DIR, 'catalog-search-diff.json')
const LOG_EVERY = 2_000

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {{ added: object[], changed: object[], deleted: string[] }} diff
 */
async function applyCatalogDiff(db, diff) {
  const col = db.collection(BGG_CATALOG_GAMES_COLLECTION)
  const writer = db.bulkWriter()
  writer.onWriteError((err) => {
    if (err.failedAttempts < 5) return true
    console.error(`Write failed for ${err.documentRef.path}: ${err.message}`)
    return false
  })

  let upserts = 0
  for (const doc of [...diff.added, ...diff.changed]) {
    writer.set(col.doc(String(doc.bggId)), firestorePayloadFromCatalogDoc(doc))
    upserts += 1
    if (upserts % LOG_EVERY === 0) {
      console.error(`  queued upserts ${upserts}/${diff.added.length + diff.changed.length}`)
    }
  }

  let deletes = 0
  for (const id of diff.deleted) {
    writer.delete(col.doc(String(id)))
    deletes += 1
    if (deletes % LOG_EVERY === 0) {
      console.error(`  queued deletes ${deletes}/${diff.deleted.length}`)
    }
  }

  await writer.close()
  return { upserts, deletes }
}

function writeDiffArtifact(diff) {
  const artifact = {
    builtAt: new Date().toISOString(),
    summary: diff.summary,
    added: diff.added,
    changed: diff.changed,
    deleted: diff.deleted,
  }
  writeFileSync(DIFF_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
  return artifact
}

async function main() {
  loadDotEnv(path.join(REPO_ROOT, '.env'))
  const dryRun = process.argv.includes('--dry-run')

  if (!existsSync(SYNCED_CSV_PATH) && existsSync(CSV_PATH)) {
    console.error(
      'No synced baseline; copying existing boardgames_ranks.csv → boardgames_ranks.synced.csv',
    )
    console.error('(Assumes Firestore matches that CSV, e.g. after upload-index.)')
    copyFileSync(CSV_PATH, SYNCED_CSV_PATH)
  }

  console.error('Downloading latest BGG ranks CSV…')
  await downloadBggRanksCsvWithReauth({ destCsvPath: INCOMING_CSV_PATH })

  if (!existsSync(SYNCED_CSV_PATH)) {
    console.error('No boardgames_ranks.synced.csv baseline yet.')
    console.error('Seeding synced + current from this download (no Firestore writes).')
    console.error('Next sync will compute a real diff against this baseline.')
    copyFileSync(INCOMING_CSV_PATH, CSV_PATH)
    copyFileSync(INCOMING_CSV_PATH, SYNCED_CSV_PATH)
    writeDiffArtifact({
      added: [],
      changed: [],
      deleted: [],
      summary: {
        previousCount: 0,
        nextCount: 0,
        added: 0,
        changed: 0,
        deleted: 0,
        seededBaseline: true,
      },
    })
    console.error(`Wrote empty diff → ${path.relative(REPO_ROOT, DIFF_PATH)}`)
    console.error(`Seeded → ${path.relative(REPO_ROOT, SYNCED_CSV_PATH)}`)
    return
  }

  console.error('Building catalog maps + diff…')
  const previousById = await loadCatalogDocMapFromRanksCsv(SYNCED_CSV_PATH)
  const nextById = await loadCatalogDocMapFromRanksCsv(INCOMING_CSV_PATH)
  const diff = diffCatalogDocMaps(previousById, nextById)
  writeDiffArtifact(diff)
  console.error(JSON.stringify(diff.summary, null, 2))
  console.error(`Diff artifact → ${path.relative(REPO_ROOT, DIFF_PATH)}`)

  if (dryRun) {
    console.error('Dry run: skipping Firestore apply and baseline promotion.')
    return
  }

  if (diff.summary.added + diff.summary.changed + diff.summary.deleted === 0) {
    console.error('No catalog changes; promoting CSV baselines only.')
    copyFileSync(INCOMING_CSV_PATH, CSV_PATH)
    copyFileSync(INCOMING_CSV_PATH, SYNCED_CSV_PATH)
    return
  }

  const { db, projectId } = initLocalFirestore()
  console.error(`Applying diff to ${projectId} / ${BGG_CATALOG_GAMES_COLLECTION}…`)
  const result = await applyCatalogDiff(db, diff)
  console.error(`Applied upserts=${result.upserts} deletes=${result.deletes}`)

  copyFileSync(INCOMING_CSV_PATH, CSV_PATH)
  copyFileSync(INCOMING_CSV_PATH, SYNCED_CSV_PATH)
  console.error(`Updated baselines → ${path.relative(REPO_ROOT, CSV_PATH)} + synced`)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  main().catch((err) => {
    console.error(err)
    if (/Could not load the default credentials|Unable to detect a Project Id/i.test(String(err))) {
      printFirestoreAuthHelp(envValue('VITE_FIREBASE_PROJECT_ID'))
    }
    process.exit(1)
  })
}
