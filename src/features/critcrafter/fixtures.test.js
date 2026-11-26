import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateSheet, assertSumInvariant } from './test/sheetSchema.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(here, 'fixtures')
const exportsDir = path.join(here, '../../../docs/critcrafter/fixtures/pathbuilder-exports')

const sheetFiles = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.sheet.json'))
const load = (f) => JSON.parse(fs.readFileSync(path.join(fixturesDir, f), 'utf8'))

test('there is one sheet fixture per committed Pathbuilder export', () => {
  const exports = fs
    .readdirSync(exportsDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, '.sheet.json'))
  assert.equal(exports.length, 8)
  assert.deepEqual([...sheetFiles].sort(), exports.sort())
})

for (const f of sheetFiles) {
  test(`${f} validates against the schema and keeps the sum invariant`, () => {
    const sheet = load(f)
    const r = validateSheet(sheet)
    assert.equal(r.valid, true, JSON.stringify(r.errors))
    assertSumInvariant(sheet)
  })
}

test('a deliberately broken fixture fails validation', () => {
  const sheet = load(sheetFiles[0])
  delete sheet.header.hp
  assert.equal(validateSheet(sheet).valid, false)
})
