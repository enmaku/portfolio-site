const assert = require('node:assert/strict')
const { describe, it } = require('node:test')
const {
  parseThumbIds,
  cachedThumbnailUrl,
  chunkIds,
  resolveCatalogThumbs,
  bggThumbHandler,
  BGG_THING_CHUNK,
} = require('./bggThumb')

describe('parseThumbIds', () => {
  it('reads comma-separated query ids', () => {
    assert.deepEqual(parseThumbIds({ query: { id: '266192,13' }, path: '/', url: '/' }), [
      '266192',
      '13',
    ])
  })

  it('dedupes and caps numeric ids', () => {
    assert.deepEqual(parseThumbIds({ query: { id: '13,13,abc,14' }, path: '/', url: '/' }), ['13', '14'])
  })

  it('reads trailing path segment', () => {
    assert.deepEqual(parseThumbIds({ query: {}, path: '/bggThumb/13', url: '/bggThumb/13' }), ['13'])
  })
})

describe('cachedThumbnailUrl', () => {
  it('returns thumbnailUrl when present', () => {
    assert.equal(cachedThumbnailUrl(null), null)
    assert.equal(cachedThumbnailUrl({ thumbnailUrl: 'https://a' }), 'https://a')
  })
})

describe('chunkIds', () => {
  it('chunks by size', () => {
    assert.deepEqual(chunkIds(['1', '2', '3'], 2), [['1', '2'], ['3']])
    assert.equal(BGG_THING_CHUNK, 20)
  })
})

/**
 * @param {{
 *   catalogDocs?: Record<string, object | null>,
 *   thingDocs?: Record<string, object | null>,
 * }} opts
 */
function mockDb({ catalogDocs = {}, thingDocs = {} }) {
  const calls = { getAll: 0, batchSets: [], commits: 0, singleSets: [] }

  function makeRef(collectionName, id) {
    const docs = collectionName === 'bggThingCache' ? thingDocs : catalogDocs
    return {
      id,
      collectionName,
      async get() {
        const data = docs[id]
        return {
          exists: data != null,
          data: () => data,
        }
      },
      async set(payload, opts) {
        calls.singleSets.push({ id, collectionName, payload, opts })
      },
    }
  }

  return {
    calls,
    db: {
      collection(name) {
        assert.ok(name === 'bggCatalogGames' || name === 'bggThingCache')
        return {
          doc(id) {
            return makeRef(name, id)
          },
        }
      },
      async getAll(...refs) {
        calls.getAll += 1
        return Promise.all(refs.map((ref) => ref.get()))
      },
      batch() {
        const ops = []
        return {
          set(ref, payload, opts) {
            ops.push({ id: ref.id, collectionName: ref.collectionName, payload, opts })
          },
          async commit() {
            calls.commits += 1
            calls.batchSets.push(...ops)
          },
        }
      },
    },
  }
}

describe('resolveCatalogThumbs', () => {
  it('returns cache hits without calling BGG', async () => {
    const { db, calls } = mockDb({
      catalogDocs: {
        '1': { thumbnailUrl: 'https://cdn/1.jpg' },
        '2': { thumbnailUrl: 'https://cdn/2.jpg' },
      },
    })
    let fetched = false
    const { results, wroteIds } = await resolveCatalogThumbs(['1', '2'], {
      db,
      fetchBggImpl: async () => {
        fetched = true
        throw new Error('should not fetch')
      },
    })
    assert.equal(fetched, false)
    assert.equal(calls.getAll, 1)
    assert.equal(calls.commits, 0)
    assert.deepEqual(wroteIds, [])
    assert.deepEqual(results, [
      { catalogEntryId: '1', thumbnailUrl: 'https://cdn/1.jpg', source: 'cache' },
      { catalogEntryId: '2', thumbnailUrl: 'https://cdn/2.jpg', source: 'cache' },
    ])
  })

  it('uses thing cache before BGG and write-backs to catalog', async () => {
    const { db, calls } = mockDb({
      catalogDocs: {
        '1': { name: 'One' },
      },
      thingDocs: {
        '1': { entry: { catalogEntryId: '1', thumbnailUrl: 'https://cdn/thing.jpg' } },
      },
    })
    let fetched = false
    const { results, wroteIds } = await resolveCatalogThumbs(['1'], {
      db,
      fetchBggImpl: async () => {
        fetched = true
        throw new Error('should not fetch')
      },
    })
    assert.equal(fetched, false)
    assert.equal(calls.commits, 1)
    assert.deepEqual(wroteIds, ['1'])
    assert.deepEqual(results, [
      { catalogEntryId: '1', thumbnailUrl: 'https://cdn/thing.jpg', source: 'thing_cache' },
    ])
  })

  it('batches BGG for misses and write-backs only existing docs', async () => {
    const { db, calls } = mockDb({
      catalogDocs: {
        '1': { name: 'One' },
        '2': null,
        '3': { thumbnailUrl: 'https://cdn/3.jpg' },
      },
    })

    let fetchArgs = null
    const xml = `<?xml version="1.0"?>
      <items>
        <item type="boardgame" id="1">
          <thumbnail>https://cdn/1.jpg</thumbnail>
          <name type="primary" value="One"/>
        </item>
        <item type="boardgame" id="2">
          <thumbnail>https://cdn/2.jpg</thumbnail>
          <name type="primary" value="Two"/>
        </item>
      </items>`

    const { results, wroteIds } = await resolveCatalogThumbs(['3', '1', '2'], {
      db,
      fetchBggImpl: async (path, params) => {
        fetchArgs = { path, params }
        return { ok: true, status: 200, text: async () => xml }
      },
    })

    assert.deepEqual(fetchArgs, { path: '/thing', params: { id: '1,2' } })
    assert.equal(calls.getAll, 1)
    assert.equal(calls.commits, 1)
    assert.deepEqual(calls.batchSets, [
      { id: '1', collectionName: 'bggCatalogGames', payload: { thumbnailUrl: 'https://cdn/1.jpg' }, opts: { merge: true } },
    ])
    assert.deepEqual(wroteIds, ['1'])
    assert.deepEqual(results, [
      { catalogEntryId: '3', thumbnailUrl: 'https://cdn/3.jpg', source: 'cache' },
      { catalogEntryId: '1', thumbnailUrl: 'https://cdn/1.jpg', source: 'bgg' },
      { catalogEntryId: '2', thumbnailUrl: 'https://cdn/2.jpg', source: 'bgg' },
    ])
  })
})

describe('bggThumbHandler', () => {
  function mockRes() {
    return {
      statusCode: 0,
      body: null,
      headers: {},
      set(k, v) {
        this.headers[k] = v
      },
      status(code) {
        this.statusCode = code
        return this
      },
      json(payload) {
        this.body = payload
        return this
      },
    }
  }

  it('returns 400 without ids', async () => {
    const res = mockRes()
    await bggThumbHandler({ method: 'GET', query: {}, path: '/', url: '/' }, res)
    assert.equal(res.statusCode, 400)
    assert.deepEqual(res.body.results, [])
  })

  it('returns results array', async () => {
    const res = mockRes()
    await bggThumbHandler(
      { method: 'GET', query: { id: '1,2' }, path: '/', url: '/' },
      res,
      {
        resolve: async (ids) => ({
          results: ids.map((id) => ({
            catalogEntryId: id,
            thumbnailUrl: `https://t/${id}`,
            source: 'cache',
          })),
          wroteIds: [],
        }),
      },
    )
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body, {
      results: [
        { catalogEntryId: '1', thumbnailUrl: 'https://t/1', source: 'cache' },
        { catalogEntryId: '2', thumbnailUrl: 'https://t/2', source: 'cache' },
      ],
    })
  })
})
