#!/usr/bin/env node
/**
 * CritCrafter rules corpus ingest (docs/critcrafter/SPEC.md "Corpus", runbook.md).
 *
 * Reads a local foundryvtt/pf2e clone (packs/pf2e/) at a pinned SHA and mirrors it into
 * Firestore: rulesEntries/{type:slug}, then rulesMeta/current last. Dry run by default.
 *
 * Usage:
 *   npm run critcrafter:ingest -- --packs ~/code/foundry-pf2e --sha <40-char sha>            # dry run
 *   npm run critcrafter:ingest -- --packs ~/code/foundry-pf2e --sha <sha> --apply [--force]  # write
 *
 * Emulator rehearsal: prefix with FIRESTORE_EMULATOR_HOST=127.0.0.1:8080.
 * Production: root .env supplies VITE_FIREBASE_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS
 * (service account key; never print or commit it), same as the bgg:* scripts.
 */
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AON_CATEGORIES,
  PACK_TYPES,
  RULES_ENTRIES_COLLECTION,
  RULES_META_COLLECTION,
  RULES_META_DOC,
  aliasReportLines,
  applyAliases,
  buildAliasPairs,
  buildEntries,
  checkGuard,
  countByType,
  diffCorpus,
  parseArgs,
} from './critcrafter-ingest-lib.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const LABELS_PATH = path.join(__dirname, 'critcrafter-pathbuilder-aliases.json')
const AON_URL = 'https://elasticsearch.aonprd.com/aon/_search'
const AON_PAGE = 1000
const AON_DELAY_MS = 400
const DEFAULT_EMULATOR_PROJECT = 'enmaku-portfolio-site'

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

/**
 * Repo-root .env, or, in a git worktree (where the gitignored .env is not checked out),
 * the .env of the main checkout that owns the worktree.
 */
function resolveEnvPath() {
  const local = path.join(ROOT, '.env')
  if (existsSync(local)) return local
  try {
    const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim()
    const main = path.join(path.dirname(common), '.env')
    if (existsSync(main)) return main
  } catch {
    // not a git checkout
  }
  return local
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

function isAuthError(err) {
  const msg = err instanceof Error ? err.message : String(err)
  return /Could not load the default credentials|Unable to detect a Project Id/i.test(msg)
}

// ---- Local clone --------------------------------------------------------------

function assertPinnedSha(clone, sha) {
  if (!/^[0-9a-f]{40}$/i.test(sha)) throw new Error('--sha must be a full 40-character commit SHA')
  let head
  try {
    head = execFileSync('git', ['-C', clone, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    throw new Error(`${clone} is not a git clone`)
  }
  if (head.toLowerCase() !== sha.toLowerCase()) {
    throw new Error(`Clone HEAD is ${head}, not the pinned ${sha}. Run: git -C ${clone} checkout ${sha}`)
  }
}

function walkJson(dir, out = []) {
  for (const dirent of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, dirent.name)
    if (dirent.isDirectory()) walkJson(full, out)
    else if (dirent.name.endsWith('.json') && dirent.name !== '_folders.json') out.push(full)
  }
  return out
}

function readPackDocs(clone) {
  const root = path.join(clone, 'packs', 'pf2e')
  const docs = []
  for (const pack of Object.keys(PACK_TYPES)) {
    const dir = path.join(root, pack)
    if (!existsSync(dir)) throw new Error(`Missing pack directory ${dir}`)
    for (const file of walkJson(dir)) {
      docs.push({
        pack,
        slug: path.basename(file, '.json'),
        relPath: path.relative(root, file),
        json: JSON.parse(readFileSync(file, 'utf8')),
      })
    }
  }
  return docs
}

// ---- AoN (server-side only, polite) --------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function aonSearch(body) {
  const res = await fetch(AON_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'portfolio-site-critcrafter-ingest (manual, once per run)',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`AoN search failed: HTTP ${res.status}`)
  const json = await res.json()
  await sleep(AON_DELAY_MS)
  return json.hits?.hits ?? []
}

async function fetchAonAliasPairs() {
  const fields = ['id', 'name', 'category', 'remaster_id']
  const legacy = []
  for (const category of AON_CATEGORIES) {
    for (let from = 0; ; from += AON_PAGE) {
      const hits = await aonSearch({
        from,
        size: AON_PAGE,
        _source: fields,
        sort: ['_doc'],
        query: {
          bool: { filter: [{ term: { category } }, { exists: { field: 'remaster_id' } }] },
        },
      })
      legacy.push(...hits.map((h) => h._source))
      if (hits.length < AON_PAGE) break
    }
  }
  const targetIds = [...new Set(legacy.flatMap((r) => r.remaster_id ?? []))]
  const remaster = []
  for (let i = 0; i < targetIds.length; i += 500) {
    const hits = await aonSearch({
      size: 500,
      _source: fields,
      query: { ids: { values: targetIds.slice(i, i + 500) } },
    })
    remaster.push(...hits.map((h) => h._source))
  }
  return buildAliasPairs(legacy, remaster)
}

// ---- Firestore ----------------------------------------------------------------

async function main() {
  loadDotEnv(resolveEnvPath())
  const args = parseArgs(process.argv.slice(2))
  if (!args.packs || !args.sha) {
    console.error('Usage: npm run critcrafter:ingest -- --packs <foundry clone> --sha <40-char sha> [--apply] [--force]')
    process.exit(1)
  }
  if (args.force && !args.apply) console.error('Note: --force only matters with --apply.')

  const emulatorHost = envValue('FIRESTORE_EMULATOR_HOST')
  const projectId = envValue('VITE_FIREBASE_PROJECT_ID') || (emulatorHost ? DEFAULT_EMULATOR_PROJECT : '')
  if (!projectId) {
    console.error('Missing VITE_FIREBASE_PROJECT_ID (check .env)')
    process.exit(1)
  }

  console.log('='.repeat(60))
  console.log(
    emulatorHost
      ? `TARGET: EMULATOR (${emulatorHost}), project ${projectId}`
      : `TARGET: PRODUCTION project ${projectId}`,
  )
  console.log(`MODE:   ${args.apply ? 'APPLY (writes)' : 'dry run (no writes)'}`)
  console.log('='.repeat(60))

  const clone = path.resolve(args.packs)
  assertPinnedSha(clone, args.sha)

  console.log('Reading pack files…')
  const docs = readPackDocs(clone)
  const { entries, skipped } = buildEntries(docs)
  console.log(`  ${docs.length} files, ${entries.length} entries, ${skipped} skipped (no publication data)`)

  console.log('Fetching AoN legacy/remaster pairs…')
  const pairs = await fetchAonAliasPairs()
  const labels = JSON.parse(readFileSync(LABELS_PATH, 'utf8'))
  const aliasRes = applyAliases(entries, pairs, labels)
  for (const line of aliasReportLines(aliasRes, pairs.length)) console.log(line)

  const { adminApp, adminFirestore } = loadAdmin()
  const { applicationDefault, getApps, initializeApp } = adminApp
  const { getFirestore } = adminFirestore
  if (getApps().length === 0) {
    try {
      initializeApp(emulatorHost ? { projectId } : { credential: applicationDefault(), projectId })
    } catch (err) {
      console.error(err instanceof Error ? err.message : err)
      printAuthHelp(projectId)
      process.exit(1)
    }
  }
  const db = getFirestore()
  const col = db.collection(RULES_ENTRIES_COLLECTION)
  const metaRef = db.collection(RULES_META_COLLECTION).doc(RULES_META_DOC)

  const metaSnap = await metaRef.get()
  const prevMeta = metaSnap.exists ? metaSnap.data() : null
  const existing = new Map()
  for (const snap of (await col.get()).docs) existing.set(snap.id, snap.data())

  const counts = countByType(entries)
  const diff = diffCorpus(existing, entries)
  const guard = checkGuard({
    existingCount: existing.size,
    deleted: diff.deleted.length,
    nextCount: entries.length,
  })

  console.log('')
  console.log(`Pinned SHA:        ${args.sha}`)
  console.log(`Existing corpus:   ${prevMeta ? prevMeta.sha : '(no rulesMeta/current)'}, ${existing.size} docs`)
  console.log('Counts per type:')
  for (const [type, n] of Object.entries(counts)) console.log(`  ${type.padEnd(13)} ${n}`)
  console.log(`  ${'total'.padEnd(13)} ${entries.length}`)
  console.log(
    `Diff: ${diff.added.length} added, ${diff.changed.length} changed, ${diff.deleted.length} deleted, ${diff.unchanged} unchanged`,
  )
  for (const [label, ids] of [['added', diff.added], ['changed', diff.changed], ['deleted', diff.deleted]]) {
    if (ids.length) console.log(`  ${label} (first 5): ${ids.slice(0, 5).join(', ')}`)
  }
  console.log(guard.ok ? 'Guard: ok' : `Guard: TRIPPED - ${guard.reasons.join('; ')}`)

  if (!args.apply) {
    console.log('\nDry run only. Re-run with --apply to write.')
    return
  }
  if (!guard.ok && !args.force) {
    console.error('\nRefusing to apply. Read the diff above; if it is right, repeat with --force.')
    process.exit(1)
  }

  const writer = db.bulkWriter()
  let failed = 0
  writer.onWriteError((err) => {
    if (err.failedAttempts < 5) return true
    failed += 1
    console.error(`Write failed for ${err.documentRef.path}: ${err.message}`)
    return false
  })
  const byId = new Map(entries.map((e) => [e.id, e.data]))
  for (const id of [...diff.added, ...diff.changed]) writer.set(col.doc(id), byId.get(id))
  for (const id of diff.deleted) writer.delete(col.doc(id))
  await writer.close()
  if (failed) {
    console.error(`\n${failed} writes failed; rulesMeta/current NOT updated (corpus is visibly stale).`)
    process.exit(1)
  }
  await metaRef.set({ sha: args.sha, ingestedAt: new Date().toISOString(), counts })
  console.log(
    `\nApplied to ${emulatorHost ? 'EMULATOR' : projectId}: wrote ${diff.added.length + diff.changed.length}, deleted ${diff.deleted.length}; rulesMeta/current -> ${args.sha}`,
  )
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  if (isAuthError(err)) printAuthHelp(envValue('VITE_FIREBASE_PROJECT_ID'))
  process.exit(1)
})
