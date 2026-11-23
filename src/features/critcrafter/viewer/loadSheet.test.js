import test from 'node:test'
import assert from 'node:assert/strict'
import { loadSheet, FAILURE_MESSAGES } from './loadSheet.js'
import { minimalSheet } from '../test/minimalSheet.js'

const BASE = 'https://fn.example/critcrafterSheet'
const pbBody = JSON.stringify({ success: true, build: { name: 'x' } })

function res(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
  }
}

/** Routes by URL: pathbuilder vs function. */
function router({ pb, fn }) {
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init })
    const handler = String(url).startsWith('https://pathbuilder2e.com') ? pb : fn
    const r = await handler(url, init)
    return r
  }
  return { fetchImpl, calls }
}

const opts = (fetchImpl, extra = {}) => ({
  id: '42',
  fetchImpl,
  functionUrl: BASE,
  getAppCheckToken: async () => 'tok',
  ...extra,
})

test('happy path: plain GET to Pathbuilder, verbatim POST to the function with App Check, sheet returned', async () => {
  const sheet = minimalSheet()
  const steps = []
  const { fetchImpl, calls } = router({
    pb: async () => res(200, pbBody),
    fn: async () => res(200, sheet),
  })
  const r = await loadSheet(opts(fetchImpl, { onStep: (s) => steps.push(s) }))
  assert.deepEqual(r, { ok: true, sheet })
  assert.deepEqual(steps, ['fetching', 'building'])
  assert.equal(calls[0].url, 'https://pathbuilder2e.com/json.php?id=42')
  assert.equal(calls[0].init, undefined, 'no custom headers or options on the Pathbuilder GET')
  assert.equal(calls[1].url, BASE)
  assert.equal(calls[1].init.method, 'POST')
  assert.equal(calls[1].init.body, pbBody)
  assert.equal(calls[1].init.headers['X-Firebase-AppCheck'], 'tok')
})

test('no App Check token configured: the header is simply omitted', async () => {
  const { fetchImpl, calls } = router({
    pb: async () => res(200, pbBody),
    fn: async () => res(200, minimalSheet()),
  })
  await loadSheet(opts(fetchImpl, { getAppCheckToken: async () => null }))
  assert.equal('X-Firebase-AppCheck' in calls[1].init.headers, false)
})

async function failure(routes, extra) {
  const { fetchImpl } = router(routes)
  const r = await loadSheet(opts(fetchImpl, extra))
  assert.equal(r.ok, false)
  return r
}

test('failure 1: network or CORS failure reaching Pathbuilder, retryable', async () => {
  const r = await failure({
    pb: async () => {
      throw new TypeError('Failed to fetch')
    },
  })
  assert.equal(r.state, 'network')
  assert.equal(r.retry, true)
  assert.equal(r.message, FAILURE_MESSAGES.network)
  assert.match(r.message, /couldn.t reach Pathbuilder/i)
})

test('failure 2: HTTP error other than 404 is "unavailable", retryable', async () => {
  for (const status of [500, 503, 403]) {
    const r = await failure({ pb: async () => res(status, 'x') })
    assert.equal(r.state, 'unavailable')
    assert.equal(r.retry, true)
    assert.match(r.message, /Pathbuilder is unavailable/i)
  }
})

test('failure 3: 404 or 200 without a build is "not found", no Retry, offers another id', async () => {
  const a = await failure({ pb: async () => res(404, { success: false, error: 'Build not found.' }) })
  const b = await failure({ pb: async () => res(200, { success: false }) })
  for (const r of [a, b]) {
    assert.equal(r.state, 'not-found')
    assert.equal(r.retry, false)
    assert.equal(r.tryAnother, true)
    assert.match(r.message, /build not found or no longer shared/i)
  }
})

test('failure 4: every sheet-function failure collapses to one state; Retry hidden only for invalid_build', async () => {
  const pb = async () => res(200, pbBody)
  const cases = [
    [async () => res(500, { error: { code: 'internal', message: 'x' } }), true],
    [async () => res(413, { error: { code: 'too_large', message: 'x' } }), true],
    [async () => res(429, 'nope'), true],
    [async () => res(200, 'not json'), true],
    [
      async () => {
        throw new TypeError('Failed to fetch')
      },
      true,
    ],
    [async () => res(422, { error: { code: 'invalid_build', message: 'x' } }), false],
  ]
  for (const [fn, retry] of cases) {
    const r = await failure({ pb, fn })
    assert.equal(r.state, 'sheet-failed')
    assert.equal(r.retry, retry)
    assert.match(r.message, /CritCrafter couldn.t build this sheet/i)
  }
})

test('unknown schemaVersion is a hard reload-to-update state', async () => {
  const sheet = { ...minimalSheet(), schemaVersion: 2 }
  const r = await failure({ pb: async () => res(200, pbBody), fn: async () => res(200, sheet) })
  assert.equal(r.state, 'schema-unsupported')
  assert.equal(r.retry, false)
  assert.match(r.message, /reload/i)
})
