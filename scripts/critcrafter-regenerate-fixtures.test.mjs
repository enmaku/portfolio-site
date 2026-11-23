import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { regenerateFixtures, stubBuildSheet, EXPORTS_DIR } from './critcrafter-regenerate-fixtures.mjs'
import { validateSheet } from '../src/features/critcrafter/test/sheetSchema.js'

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cc-regen-'))
}

test('writes one schema-valid sheet per committed export', () => {
  const outDir = tmp()
  const written = regenerateFixtures({ outDir })
  const exportNames = fs
    .readdirSync(EXPORTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
  assert.equal(exportNames.length, 8)
  assert.deepEqual(written.sort(), exportNames.map((n) => `${n}.sheet.json`).sort())
  for (const f of written) {
    const sheet = JSON.parse(fs.readFileSync(path.join(outDir, f), 'utf8'))
    assert.equal(validateSheet(sheet).valid, true, f)
  }
})

test('output is deterministic (running twice gives identical bytes)', () => {
  const a = tmp()
  const b = tmp()
  regenerateFixtures({ outDir: a })
  regenerateFixtures({ outDir: b })
  for (const f of fs.readdirSync(a)) {
    assert.equal(fs.readFileSync(path.join(a, f), 'utf8'), fs.readFileSync(path.join(b, f), 'utf8'))
  }
})

test('refuses to write a sheet that fails the schema', () => {
  const outDir = tmp()
  assert.throws(
    () => regenerateFixtures({ outDir, buildSheet: () => ({ nope: true }) }),
    /schema/i,
  )
  assert.deepEqual(fs.readdirSync(outDir), [])
})

test('the stub reads identity from the export build', () => {
  const sheet = stubBuildSheet({
    success: true,
    build: { name: 'X', level: 5, ancestry: 'Dwarf', class: 'Fighter', dualClass: null },
  })
  assert.equal(sheet.header.level, 5)
  assert.equal(sheet.header.ancestry, 'Dwarf')
  assert.equal(sheet.header.classLine, 'Fighter')
})
