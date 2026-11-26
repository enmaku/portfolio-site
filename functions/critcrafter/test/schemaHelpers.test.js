'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const {
  validateSheet,
  assertValidSheet,
  findSumInvariantViolations,
  assertSumInvariant,
  minimalSheet,
} = require('./schemaHelpers')

test('a minimal sheet validates against the schema', () => {
  const r = validateSheet(minimalSheet())
  assert.equal(r.valid, true, JSON.stringify(r.errors))
})

test('a sheet missing a required key is rejected', () => {
  const sheet = minimalSheet()
  delete sheet.stats
  assert.equal(validateSheet(sheet).valid, false)
  assert.throws(() => assertValidSheet(sheet), /stats/)
})

test('a sheet with a wrongly typed Stat value is rejected', () => {
  const sheet = minimalSheet()
  sheet.header.hp.value = 'eighty'
  assert.equal(validateSheet(sheet).valid, false)
})

test('sum invariant passes on a consistent sheet and names the offending path otherwise', () => {
  assert.deepEqual(findSumInvariantViolations(minimalSheet()), [])
  const sheet = minimalSheet()
  sheet.header.speed.value = 30
  const v = findSumInvariantViolations(sheet)
  assert.equal(v.length, 1)
  assert.equal(v[0].path, 'header.speed')
  assert.throws(() => assertSumInvariant(sheet), /header\.speed/)
})
