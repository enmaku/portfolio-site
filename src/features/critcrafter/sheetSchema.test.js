import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateSheet,
  assertValidSheet,
  findSumInvariantViolations,
  assertSumInvariant,
} from './test/sheetSchema.js'
import { minimalSheet } from './test/minimalSheet.js'

test('a minimal sheet validates against the schema', () => {
  const r = validateSheet(minimalSheet())
  assert.equal(r.valid, true, JSON.stringify(r.errors))
})

test('a sheet missing a required key is rejected with errors', () => {
  const sheet = minimalSheet()
  delete sheet.header
  const r = validateSheet(sheet)
  assert.equal(r.valid, false)
  assert.ok(r.errors.length > 0)
  assert.throws(() => assertValidSheet(sheet), /header/)
})

test('a sheet with a wrongly typed Stat value is rejected', () => {
  const sheet = minimalSheet()
  sheet.header.hp.value = 'eighty'
  assert.equal(validateSheet(sheet).valid, false)
})

test('unknown extra fields are tolerated (additive evolution)', () => {
  const sheet = minimalSheet()
  sheet.somethingNew = { a: 1 }
  assert.equal(validateSheet(sheet).valid, true)
})

test('sum invariant holds for a consistent sheet', () => {
  assert.deepEqual(findSumInvariantViolations(minimalSheet()), [])
  assert.doesNotThrow(() => assertSumInvariant(minimalSheet()))
})

test('sum invariant reports the path of a nested Stat that does not add up', () => {
  const sheet = minimalSheet()
  sheet.stats.saves[0].bonus.value = 99
  const v = findSumInvariantViolations(sheet)
  assert.equal(v.length, 1)
  assert.equal(v[0].path, 'stats.saves[0].bonus')
  assert.equal(v[0].value, 99)
  assert.equal(v[0].sum, 5)
  assert.throws(() => assertSumInvariant(sheet), /stats\.saves\[0\]\.bonus/)
})

test('sum invariant also covers Stats nested inside gear and spells', () => {
  const sheet = minimalSheet()
  sheet.gear.bulk.value = 3
  sheet.spells.focus = {
    pool: 1,
    attack: { value: 7, breakdown: [{ label: 'x', amount: 6, type: 'untyped' }] },
    dc: null,
    cantrips: [],
    spells: [],
  }
  const paths = findSumInvariantViolations(sheet).map((x) => x.path)
  assert.deepEqual(paths.sort(), ['gear.bulk', 'spells.focus.attack'])
})
