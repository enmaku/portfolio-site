'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { fakeReq, fakeRes, fakeLog } = require('./test/http')
const { memoryStore } = require('./test/memoryStore')
const { syntheticCorpus } = require('./test/syntheticCorpus')
const { assertValidSheet, assertSumInvariant } = require('./test/schemaHelpers')
const { EXPORT_NAMES } = require('./test/builds')
const { createSheetHandler } = require('./index')

const exportsDir = path.join(__dirname, '../../docs/critcrafter/fixtures/pathbuilder-exports')
const loadExport = (n) => JSON.parse(fs.readFileSync(path.join(exportsDir, `${n}.json`), 'utf8'))

test('every committed export, posted verbatim, comes back as a valid sheet; two runs are byte-identical', async () => {
  const exports = EXPORT_NAMES.map(loadExport)
  const docs = syntheticCorpus(exports.map((e) => e.build))
  const log = fakeLog()
  const handler = createSheetHandler({ store: memoryStore(docs), log, now: () => new Date('2026-01-01T00:00:00.000Z') })
  for (const [i, name] of EXPORT_NAMES.entries()) {
    const run = async () => {
      const res = fakeRes()
      await handler(fakeReq({ body: exports[i] }), res)
      return res
    }
    const a = await run()
    const b = await run()
    assert.equal(a.statusCode, 200, name)
    assert.equal(a.body, b.body, `${name} is deterministic`)
    assertValidSheet(a.json)
    assertSumInvariant(a.json)
  }
  assert.ok(log.entries.every((e) => e.message === 'critcrafter.sheet'))
})

test('a build that is not a Pathbuilder export still returns a sheet (everything degrades through warnings)', async () => {
  const handler = createSheetHandler({ store: memoryStore([]), log: fakeLog() })
  const res = fakeRes()
  await handler(fakeReq({ body: { build: { name: 'Bare' } } }), res)
  assert.equal(res.statusCode, 200)
  assertValidSheet(res.json)
})
