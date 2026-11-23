#!/usr/bin/env node
// Regenerates the viewer's sheet fixtures by posting each committed Pathbuilder export through the real
// critcrafterSheet handler (functions/critcrafter), against the rules corpus in the Firestore EMULATOR.
// Fixtures are generated, never hand-edited: re-run this after a schema, function or corpus change.
//
//   firebase emulators:start --only firestore            # in one terminal
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run critcrafter:ingest -- --packs <clone> --sha <sha> --apply
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run critcrafter:regen-fixtures
//
// It refuses to run without FIRESTORE_EMULATOR_HOST so it can never read production. The clock is fixed,
// so output is deterministic for a given corpus.
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateSheet } from '../src/features/critcrafter/test/sheetSchema.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const EXPORTS_DIR = path.join(root, 'docs/critcrafter/fixtures/pathbuilder-exports')
export const FIXTURES_DIR = path.join(root, 'src/features/critcrafter/fixtures')
export const FIXTURE_CLOCK = () => new Date('2026-01-01T00:00:00.000Z')

const require = createRequire(import.meta.url)
const DEFAULT_EMULATOR_PROJECT = 'enmaku-portfolio-site'

/**
 * A `buildSheet(pbExport)` that runs the real handler (the function's HTTP boundary and sheet assembly)
 * against the given corpus store. The export is posted verbatim, exactly as the viewer relays it.
 */
export function handlerBuildSheet({ store, now = FIXTURE_CLOCK }) {
  const { createSheetHandler } = require('../functions/critcrafter/index.js')
  const handler = createSheetHandler({ store, now })
  return async function buildSheet(pbExport) {
    const body = Buffer.from(JSON.stringify(pbExport))
    const req = { method: 'POST', headers: { 'content-length': String(body.length) }, rawBody: body, header: () => undefined }
    const res = {
      statusCode: 200,
      body: '',
      status(c) {
        res.statusCode = c
        return res
      },
      set() {
        return res
      },
      send(b) {
        res.body = b
        return res
      },
    }
    await handler(req, res)
    if (res.statusCode !== 200) throw new Error(`handler answered ${res.statusCode}: ${res.body}`)
    return JSON.parse(res.body)
  }
}

/** The Firestore-emulator corpus store; refuses to run against anything else. */
export function emulatorStore(env = process.env) {
  const host = String(env.FIRESTORE_EMULATOR_HOST ?? '').trim()
  if (!host) {
    throw new Error(
      'FIRESTORE_EMULATOR_HOST is not set. Fixtures are generated against the emulator corpus only ' +
        '(see docs/critcrafter/runbook.md); this script never reads production.',
    )
  }
  const functionsRequire = createRequire(path.join(root, 'functions', 'package.json'))
  const admin = functionsRequire('firebase-admin')
  const { firestoreStore } = require('../functions/critcrafter/store.js')
  const projectId = String(env.VITE_FIREBASE_PROJECT_ID ?? '').trim() || DEFAULT_EMULATOR_PROJECT
  if (!admin.apps.length) admin.initializeApp({ projectId })
  return firestoreStore(admin.firestore())
}

/** Returns the file names written. Nothing is written if any sheet fails the schema. */
export async function regenerateFixtures({
  exportsDir = EXPORTS_DIR,
  outDir = FIXTURES_DIR,
  buildSheet = handlerBuildSheet({ store: emulatorStore() }),
} = {}) {
  const names = fs
    .readdirSync(exportsDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
  const sheets = []
  for (const f of names) {
    const sheet = await buildSheet(JSON.parse(fs.readFileSync(path.join(exportsDir, f), 'utf8')))
    const { valid, errors } = validateSheet(sheet)
    if (!valid) {
      throw new Error(`${f}: generated sheet fails schema: ${JSON.stringify(errors.slice(0, 3))}`)
    }
    sheets.push([f.replace(/\.json$/, '.sheet.json'), sheet])
  }
  fs.mkdirSync(outDir, { recursive: true })
  for (const [file, sheet] of sheets) {
    fs.writeFileSync(path.join(outDir, file), `${JSON.stringify(sheet, null, 2)}\n`)
  }
  return sheets.map(([file]) => file)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  regenerateFixtures()
    .then((written) => {
      console.log(`Wrote ${written.length} sheet fixtures to ${path.relative(root, FIXTURES_DIR)}`)
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err)
      process.exit(1)
    })
}
