import assert from 'node:assert/strict'
import test from 'node:test'
import {
  fetchBggCatalogEntry,
  isBggCatalogConfigured,
  resolveBggFunctionsBase,
  searchBggCatalog,
} from './bggCatalogClient.js'

const EMULATOR_BASE = 'http://127.0.0.1:5001/demo/us-central1'

test('isBggCatalogConfigured is false without base URL env', () => {
  assert.equal(isBggCatalogConfigured(), false)
})

test('resolveBggFunctionsBase accepts explicit override', () => {
  assert.equal(resolveBggFunctionsBase({ functionsBase: EMULATOR_BASE }), EMULATOR_BASE)
  assert.equal(isBggCatalogConfigured(), false)
})

test('searchBggCatalog returns not_configured when base URL missing', async () => {
  const result = await searchBggCatalog('cascadia')
  assert.equal(result.ok, false)
  assert.equal(result.error, 'not_configured')
  assert.deepEqual(result.results, [])
})

test('searchBggCatalog calls bggSearch and returns parsed results', async () => {
  /** @type {typeof fetch} */
  const fetchImpl = async (url) => {
    assert.equal(
      url,
      'http://127.0.0.1:5001/demo/us-central1/bggSearch?query=cascadia&type=boardgame',
    )
    return new Response(
      JSON.stringify({
        results: [{ catalogEntryId: '295947', title: 'Cascadia', yearPublished: 2021, type: 'boardgame' }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const result = await searchBggCatalog('cascadia', { fetchImpl, functionsBase: EMULATOR_BASE })
  assert.equal(result.ok, true)
  assert.equal(result.results.length, 1)
  assert.equal(result.results[0].catalogEntryId, '295947')
})

test('fetchBggCatalogEntry calls bggThing with stats by default', async () => {
  /** @type {typeof fetch} */
  const fetchImpl = async (url) => {
    assert.equal(url, 'http://127.0.0.1:5001/demo/us-central1/bggThing?id=295947&stats=1')
    return new Response(
      JSON.stringify({
        entry: {
          catalogEntryId: '295947',
          title: 'Cascadia',
          minPlayers: 1,
          maxPlayers: 4,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const result = await fetchBggCatalogEntry('295947', { fetchImpl, functionsBase: EMULATOR_BASE })
  assert.equal(result.ok, true)
  assert.equal(result.entry?.title, 'Cascadia')
})

test('searchBggCatalog returns empty results for blank query without fetch', async () => {
  let called = false
  const fetchImpl = async () => {
    called = true
    return new Response('{}', { status: 200 })
  }
  const result = await searchBggCatalog('   ', { fetchImpl, functionsBase: EMULATOR_BASE })
  assert.equal(result.ok, true)
  assert.deepEqual(result.results, [])
  assert.equal(called, false)
})
