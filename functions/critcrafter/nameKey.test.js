'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { nameKey } = require('./nameKey')

test('nameKey matches the ingest script on awkward names', async () => {
  const ingest = await import('../../scripts/critcrafter-ingest-lib.mjs')
  for (const n of ['Explorer’s Clothing', "Smuggler's Sack (Type II)", '  Fléchette -- Dart  ', 'Scroll of 1st-rank Spell', '', null, 'Éclair d’Or']) {
    assert.equal(nameKey(n), ingest.nameKey(n), String(n))
  }
})
