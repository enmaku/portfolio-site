const assert = require('node:assert/strict')
const { describe, it } = require('node:test')
const {
  parseThingIds,
  freshCachedEntry,
  resolveBggThings,
  bggThingHandler,
  THING_CACHE_TTL_MS,
  BGG_THING_CACHE_COLLECTION,
  MAX_BATCH,
} = require('./bggThing')

describe('parseThingIds', () => {
  it('reads comma-separated numeric ids', () => {
    assert.deepEqual(parseThingIds('266192,13'), ['266192', '13'])
  })

  it('drops non-numeric and caps batch size', () => {
    const ids = parseThingIds(['1', 'abc', '2', ...Array.from({ length: 30 }, (_, i) => String(i + 3))].join(','))
    assert.equal(ids.length, MAX_BATCH)
    assert.equal(ids[0], '1')
    assert.equal(ids[1], '2')
  })
})

describe('freshCachedEntry', () => {
  const entry = { catalogEntryId: '1', title: 'One' }

  it('returns entry when within TTL', () => {
    const nowMs = 1_000_000
    assert.deepEqual(
      freshCachedEntry({ entry, cachedAtMs: nowMs - THING_CACHE_TTL_MS + 1 }, nowMs),
      entry,
    )
  })

  it('returns null when expired or incomplete', () => {
    const nowMs = 1_000_000
    assert.equal(freshCachedEntry({ entry, cachedAtMs: nowMs - THING_CACHE_TTL_MS }, nowMs), null)
    assert.equal(freshCachedEntry({ entry }, nowMs), null)
    assert.equal(freshCachedEntry(null, nowMs), null)
  })
})

/**
 * @param {{ docs: Record<string, object | null> }} opts
 */
function mockDb({ docs }) {
  const calls = { getAll: 0, batchSets: [], commits: 0, singleSets: [] }

  function makeRef(id) {
    return {
      id,
      async get() {
        const data = docs[id]
        return {
          exists: data != null,
          data: () => data,
        }
      },
      async set(payload, opts) {
        calls.singleSets.push({ id, payload, opts })
      },
    }
  }

  return {
    calls,
    db: {
      collection(name) {
        assert.equal(name, BGG_THING_CACHE_COLLECTION)
        return {
          doc(id) {
            return makeRef(id)
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
            ops.push({ id: ref.id, payload, opts })
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

describe('resolveBggThings', () => {
  it('returns cache hits without calling BGG', async () => {
    const nowMs = 2_000_000
    const { db, calls } = mockDb({
      docs: {
        '1': {
          entry: { catalogEntryId: '1', title: 'One' },
          cachedAtMs: nowMs - 1000,
        },
        '2': {
          entry: { catalogEntryId: '2', title: 'Two' },
          cachedAtMs: nowMs - 2000,
        },
      },
    })
    let fetched = false
    const { entries, wroteIds } = await resolveBggThings(['1', '2'], {
      db,
      nowMs,
      fetchBggImpl: async () => {
        fetched = true
        throw new Error('should not fetch')
      },
    })
    assert.equal(fetched, false)
    assert.equal(calls.getAll, 1)
    assert.equal(calls.commits, 0)
    assert.deepEqual(wroteIds, [])
    assert.deepEqual(entries, [
      { catalogEntryId: '1', title: 'One' },
      { catalogEntryId: '2', title: 'Two' },
    ])
  })

  it('refetches expired ids with stats and writes cache', async () => {
    const nowMs = 5_000_000
    const { db, calls } = mockDb({
      docs: {
        '1': {
          entry: { catalogEntryId: '1', title: 'Stale' },
          cachedAtMs: nowMs - THING_CACHE_TTL_MS,
        },
        '2': {
          entry: { catalogEntryId: '2', title: 'Fresh' },
          cachedAtMs: nowMs - 1000,
        },
        '3': null,
      },
    })

    let fetchArgs = null
    const xml = `<?xml version="1.0"?>
      <items>
        <item type="boardgame" id="1">
          <name type="primary" value="One"/>
          <yearpublished value="2020"/>
        </item>
        <item type="boardgame" id="3">
          <name type="primary" value="Three"/>
          <yearpublished value="2021"/>
        </item>
      </items>`

    const { entries, wroteIds } = await resolveBggThings(['2', '1', '3'], {
      db,
      nowMs,
      fetchBggImpl: async (path, params) => {
        fetchArgs = { path, params }
        return { ok: true, status: 200, text: async () => xml }
      },
    })

    assert.deepEqual(fetchArgs, { path: '/thing', params: { id: '1,3', stats: '1' } })
    assert.equal(calls.getAll, 1)
    assert.equal(calls.commits, 1)
    assert.deepEqual(wroteIds, ['1', '3'])
    assert.equal(calls.batchSets.length, 2)
    assert.equal(calls.batchSets[0].payload.cachedAtMs, nowMs)
    assert.equal(calls.batchSets[0].payload.entry.catalogEntryId, '1')
    assert.equal(calls.batchSets[0].opts.merge, true)
    assert.deepEqual(
      entries.map((row) => row.catalogEntryId),
      ['2', '1', '3'],
    )
    assert.equal(entries[0].title, 'Fresh')
    assert.equal(entries[1].title, 'One')
    assert.equal(entries[2].title, 'Three')
  })
})

describe('bggThingHandler', () => {
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
    await bggThingHandler({ method: 'GET', query: {} }, res)
    assert.equal(res.statusCode, 400)
    assert.deepEqual(res.body.entries, [])
  })

  it('returns entry and entries from resolver', async () => {
    const res = mockRes()
    await bggThingHandler(
      { method: 'GET', query: { id: '1,2' } },
      res,
      {
        resolve: async (ids) => ({
          entries: ids.map((id) => ({ catalogEntryId: id, title: `T${id}` })),
          wroteIds: [],
        }),
      },
    )
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body, {
      entry: { catalogEntryId: '1', title: 'T1' },
      entries: [
        { catalogEntryId: '1', title: 'T1' },
        { catalogEntryId: '2', title: 'T2' },
      ],
    })
  })
})
