import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { regenerateFixtures, handlerBuildSheet, emulatorStore, EXPORTS_DIR } from './critcrafter-regenerate-fixtures.mjs'
import { validateSheet } from '../src/features/critcrafter/test/sheetSchema.js'

const require = createRequire(import.meta.url)
const { memoryStore } = require('../functions/critcrafter/test/memoryStore.js')
const { syntheticCorpus } = require('../functions/critcrafter/test/syntheticCorpus.js')

const exportFiles = fs.readdirSync(EXPORTS_DIR).filter((f) => f.endsWith('.json'))
const builds = exportFiles.map((f) => JSON.parse(fs.readFileSync(path.join(EXPORTS_DIR, f), 'utf8')).build)
const store = () => memoryStore(syntheticCorpus(builds))

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cc-regen-'))
}

test('writes one schema-valid sheet per committed export, built by the real handler', async () => {
  const outDir = tmp()
  const written = await regenerateFixtures({ outDir, buildSheet: handlerBuildSheet({ store: store() }) })
  const exportNames = exportFiles.map((f) => f.replace(/\.json$/, ''))
  assert.equal(exportNames.length, 8)
  assert.deepEqual(written.sort(), exportNames.map((n) => `${n}.sheet.json`).sort())
  for (const f of written) {
    const sheet = JSON.parse(fs.readFileSync(path.join(outDir, f), 'utf8'))
    assert.equal(validateSheet(sheet).valid, true, f)
    assert.ok(sheet.header.hp.value > 0, `${f} has real derived stats, not a stub`)
    assert.equal(sheet.generatedAt, '2026-01-01T00:00:00.000Z')
  }
})

test('output is deterministic (running twice gives identical bytes)', async () => {
  const a = tmp()
  const b = tmp()
  await regenerateFixtures({ outDir: a, buildSheet: handlerBuildSheet({ store: store() }) })
  await regenerateFixtures({ outDir: b, buildSheet: handlerBuildSheet({ store: store() }) })
  for (const f of fs.readdirSync(a)) {
    assert.equal(fs.readFileSync(path.join(a, f), 'utf8'), fs.readFileSync(path.join(b, f), 'utf8'))
  }
})

test('refuses to write a sheet that fails the schema', async () => {
  const outDir = tmp()
  await assert.rejects(regenerateFixtures({ outDir, buildSheet: async () => ({ nope: true }) }), /schema/i)
  assert.deepEqual(fs.readdirSync(outDir), [])
})

test('a handler error status fails the run instead of writing a sheet', async () => {
  const buildSheet = handlerBuildSheet({ store: store() })
  await assert.rejects(buildSheet({ success: true }), /422/)
})

test('without FIRESTORE_EMULATOR_HOST the default corpus refuses to run (never production)', () => {
  assert.throws(() => emulatorStore({}), /FIRESTORE_EMULATOR_HOST/)
})
