import assert from 'node:assert/strict'
import test from 'node:test'
import {
  fetchBggCatalogEntries,
  fetchBggCatalogEntry,
  fetchBggCatalogThumb,
  fetchBggCatalogThumbs,
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
        entries: [
          {
            catalogEntryId: '295947',
            title: 'Cascadia',
            minPlayers: 1,
            maxPlayers: 4,
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const result = await fetchBggCatalogEntry('295947', { fetchImpl, functionsBase: EMULATOR_BASE })
  assert.equal(result.ok, true)
  assert.equal(result.entry?.title, 'Cascadia')
})

test('fetchBggCatalogEntries batches ids into one bggThing request', async () => {
  /** @type {typeof fetch} */
  const fetchImpl = async (url) => {
    const parsed = new URL(String(url))
    assert.equal(parsed.pathname, '/demo/us-central1/bggThing')
    assert.equal(parsed.searchParams.get('id'), '13,295947')
    assert.equal(parsed.searchParams.get('stats'), '1')
    return new Response(
      JSON.stringify({
        entries: [
          { catalogEntryId: '13', title: 'Catan', thumbnailUrl: 'https://example.com/a.jpg' },
          { catalogEntryId: '295947', title: 'Cascadia', thumbnailUrl: 'https://example.com/b.jpg' },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const result = await fetchBggCatalogEntries(['13', '295947'], {
    fetchImpl,
    functionsBase: EMULATOR_BASE,
  })
  assert.equal(result.ok, true)
  assert.equal(result.entries.length, 2)
  assert.equal(result.entries[0].thumbnailUrl, 'https://example.com/a.jpg')
})

test('fetchBggCatalogThumbs batches ids into one bggThumb request', async () => {
  /** @type {typeof fetch} */
  const fetchImpl = async (url) => {
    const parsed = new URL(String(url))
    assert.equal(parsed.pathname, '/demo/us-central1/bggThumb')
    assert.equal(parsed.searchParams.get('id'), '266192,13')
    return new Response(
      JSON.stringify({
        results: [
          { catalogEntryId: '266192', thumbnailUrl: 'https://cdn/t.jpg', source: 'cache' },
          { catalogEntryId: '13', thumbnailUrl: 'https://cdn/c.jpg', source: 'bgg' },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const result = await fetchBggCatalogThumbs(['266192', '13'], {
    fetchImpl,
    functionsBase: EMULATOR_BASE,
  })
  assert.equal(result.ok, true)
  assert.equal(result.results.length, 2)
  assert.equal(result.results[0].thumbnailUrl, 'https://cdn/t.jpg')
})

test('fetchBggCatalogThumb calls bggThumb and returns thumbnailUrl', async () => {
  /** @type {typeof fetch} */
  const fetchImpl = async (url) => {
    assert.equal(url, 'http://127.0.0.1:5001/demo/us-central1/bggThumb?id=266192')
    return new Response(
      JSON.stringify({
        results: [
          {
            catalogEntryId: '266192',
            thumbnailUrl: 'https://cdn/t.jpg',
            source: 'cache',
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const result = await fetchBggCatalogThumb('266192', { fetchImpl, functionsBase: EMULATOR_BASE })
  assert.equal(result.ok, true)
  assert.equal(result.thumbnailUrl, 'https://cdn/t.jpg')
  assert.equal(result.source, 'cache')
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
