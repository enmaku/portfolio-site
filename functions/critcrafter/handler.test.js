'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { fakeReq, fakeRes, fakeLog } = require('./test/http')
const { minimalSheet } = require('./test/schemaHelpers')
const { createHandler, MAX_REQUEST_BYTES, MAX_RESPONSE_BYTES } = require('./handler')

function setup(over = {}) {
  const log = fakeLog()
  const calls = []
  const handler = createHandler({
    buildSheet: async (build) => {
      calls.push(build)
      return { ...minimalSheet(), corpus: { sha: 'c'.repeat(40) }, warnings: [{ code: 'name_unmatched', path: 'a', detail: 'Secret Name' }, { code: 'name_unmatched', path: 'b', detail: 'Other Name' }] }
    },
    log,
    ...over,
  })
  return { handler, log, calls }
}

async function run(handler, reqOpts) {
  const res = fakeRes()
  await handler(fakeReq(reqOpts), res)
  return res
}

const errorOf = (res) => res.json.error

test('POST with a build returns 200 and the sheet as JSON', async () => {
  const { handler, calls } = setup()
  const res = await run(handler, { body: { success: true, build: { name: 'X' } } })
  assert.equal(res.statusCode, 200)
  assert.match(res.headers['content-type'], /application\/json/)
  assert.equal(res.json.schemaVersion, 1)
  assert.deepEqual(calls, [{ name: 'X' }])
})

for (const method of ['GET', 'PUT', 'DELETE', 'PATCH']) {
  test(`${method} is 405 method_not_allowed with an Allow header`, async () => {
    const { handler } = setup()
    const res = await run(handler, { method, body: { build: {} } })
    assert.equal(res.statusCode, 405)
    assert.equal(errorOf(res).code, 'method_not_allowed')
    assert.equal(res.headers.allow, 'POST')
  })
}

test('non-JSON body is 400 bad_json', async () => {
  const { handler } = setup()
  const res = await run(handler, { rawBody: Buffer.from('{not json'), body: undefined })
  assert.equal(res.statusCode, 400)
  assert.equal(errorOf(res).code, 'bad_json')
})

test('an empty body is 400 bad_json', async () => {
  const { handler } = setup()
  const res = await run(handler, { rawBody: Buffer.from('') })
  assert.equal(res.statusCode, 400)
  assert.equal(errorOf(res).code, 'bad_json')
})

test('a Content-Length over 1 MB is 413 too_large before the body is read', async () => {
  const { handler, calls } = setup()
  const res = await run(handler, { headers: { 'content-length': String(MAX_REQUEST_BYTES + 1) }, body: { build: {} } })
  assert.equal(res.statusCode, 413)
  assert.equal(errorOf(res).code, 'too_large')
  assert.equal(calls.length, 0)
})

test('a parsed body over 1 MB is 413 even when Content-Length lied', async () => {
  const { handler } = setup()
  const big = JSON.stringify({ build: { pad: 'x'.repeat(MAX_REQUEST_BYTES) } })
  const res = await run(handler, { headers: { 'content-length': '10' }, rawBody: Buffer.from(big) })
  assert.equal(res.statusCode, 413)
  assert.equal(errorOf(res).code, 'too_large')
})

for (const [label, body] of [
  ['missing build', { success: true }],
  ['null build', { build: null }],
  ['array build', { build: [] }],
  ['string build', { build: 'x' }],
  ['a top-level array', []],
  ['a top-level null', null],
]) {
  test(`${label} is 422 invalid_build`, async () => {
    const { handler } = setup()
    const res = await run(handler, { rawBody: Buffer.from(JSON.stringify(body)) })
    assert.equal(res.statusCode, 422)
    assert.equal(errorOf(res).code, 'invalid_build')
  })
}

test('an unexpected failure is 500 internal and hides the cause', async () => {
  const { handler, log } = setup({
    buildSheet: async () => {
      throw new Error('boom secret detail')
    },
  })
  const res = await run(handler, { body: { build: {} } })
  assert.equal(res.statusCode, 500)
  assert.equal(errorOf(res).code, 'internal')
  assert.doesNotMatch(res.body, /boom/)
  const entry = log.entries.find((e) => e.message === 'critcrafter.error')
  assert.equal(entry.severity, 'ERROR')
  assert.equal(entry.fields.errorCode, 'internal')
  assert.doesNotMatch(JSON.stringify(log.entries), /boom secret/)
})

test('a sheet over 2 MB fails loudly instead of being truncated', async () => {
  const { handler, log } = setup({
    buildSheet: async () => ({ ...minimalSheet(), pad: 'x'.repeat(MAX_RESPONSE_BYTES) }),
  })
  const res = await run(handler, { body: { build: {} } })
  assert.equal(res.statusCode, 500)
  assert.equal(errorOf(res).code, 'internal')
  assert.equal(log.entries.find((e) => e.message === 'critcrafter.error').severity, 'ERROR')
})

test('App Check: a request the verifier rejects is 401 app_check_failed', async () => {
  const { handler, calls } = setup({ verifyAppCheck: async () => false })
  const res = await run(handler, { body: { build: {} } })
  assert.equal(res.statusCode, 401)
  assert.equal(errorOf(res).code, 'app_check_failed')
  assert.equal(calls.length, 0)
})

test('App Check: the verifier sees the request and a pass lets it through', async () => {
  let seen
  const { handler } = setup({
    verifyAppCheck: async (req) => {
      seen = req.headers['x-firebase-appcheck']
      return true
    },
  })
  const res = await run(handler, { headers: { 'X-Firebase-AppCheck': 'tok' }, body: { build: {} } })
  assert.equal(res.statusCode, 200)
  assert.equal(seen, 'tok')
})

test('a 405 is answered before App Check is consulted', async () => {
  let asked = false
  const { handler } = setup({ verifyAppCheck: async () => { asked = true; return false } })
  const res = await run(handler, { method: 'GET' })
  assert.equal(res.statusCode, 405)
  assert.equal(asked, false)
})

test('the success log has only the agreed fields: no body, names or warning detail', async () => {
  const { handler, log } = setup()
  await run(handler, { body: { build: { name: 'Hero Name' } } })
  const entry = log.entries.find((e) => e.message === 'critcrafter.sheet')
  assert.equal(entry.severity, 'INFO')
  assert.deepEqual(Object.keys(entry.fields).sort(), ['corpusSha', 'durationMs', 'errorCode', 'requestBytes', 'requestId', 'responseBytes', 'warningCounts'])
  assert.deepEqual(entry.fields.warningCounts, { name_unmatched: 2 })
  assert.equal(entry.fields.corpusSha, 'c'.repeat(40))
  assert.equal(entry.fields.errorCode, null)
  assert.ok(entry.fields.responseBytes > 0 && entry.fields.requestBytes > 0)
  const text = JSON.stringify(log.entries)
  assert.doesNotMatch(text, /Hero Name|Secret Name|Other Name/)
})

test('caller errors log critcrafter.error with the code at WARNING', async () => {
  const { handler, log } = setup()
  await run(handler, { rawBody: Buffer.from('nope') })
  const entry = log.entries.find((e) => e.message === 'critcrafter.error')
  assert.equal(entry.severity, 'WARNING')
  assert.equal(entry.fields.errorCode, 'bad_json')
})
