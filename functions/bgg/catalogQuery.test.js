const assert = require('node:assert/strict')
const { describe, it } = require('node:test')
const {
  DEFAULT_RESULT_LIMIT,
  attachMissingThumbnails,
  compareCatalogDocs,
  docMatchesAllTokens,
  pickLookupToken,
  queryTokens,
  searchCatalogGames,
  toSearchHit,
} = require('./catalogQuery')

describe('queryTokens', () => {
  it('drops stopwords; requires first token length ≥ 2', () => {
    assert.deepEqual(queryTokens('The Lord of the Rings'), ['lord', 'rings'])
    assert.deepEqual(queryTokens('a'), [])
    assert.deepEqual(queryTokens('g'), [])
    assert.deepEqual(queryTokens('w last'), [])
    assert.deepEqual(queryTokens('last w'), ['last', 'w'])
  })
})

describe('pickLookupToken', () => {
  it('prefers the longest token of length ≥ 2', () => {
    assert.equal(pickLookupToken(['lord', 'rings']), 'rings')
    assert.equal(pickLookupToken(['last', 'w']), 'last')
    assert.equal(pickLookupToken(['w']), null)
  })
})

describe('docMatchesAllTokens', () => {
  it('requires every query token in searchPrefixes', () => {
    const data = { searchPrefixes: ['lo', 'lor', 'lord', 'ri', 'rin', 'ring', 'rings'] }
    assert.equal(docMatchesAllTokens(data, ['lord', 'rings']), true)
    assert.equal(docMatchesAllTokens(data, ['lord', 'rin']), true)
    assert.equal(docMatchesAllTokens(data, ['lord', 'matrix']), false)
  })
})

describe('compareCatalogDocs', () => {
  it('orders by rank then bayesAverage', () => {
    const a = { bggId: '1', name: 'A', rank: 2, bayesAverage: 9 }
    const b = { bggId: '2', name: 'B', rank: 1, bayesAverage: 8 }
    assert.ok(compareCatalogDocs(b, a) < 0)
    const unranked = { bggId: '3', name: 'C', rank: null, bayesAverage: 9 }
    assert.ok(compareCatalogDocs(b, unranked) < 0)
  })
})

describe('toSearchHit', () => {
  it('maps catalog docs to search hit shape with popularity fields', () => {
    assert.deepEqual(
      toSearchHit({
        bggId: '266192',
        name: 'Wingspan',
        yearPublished: 2019,
        rank: 38,
        bayesAverage: 7.84,
        average: 8,
        usersRated: 100,
      }),
      {
        catalogEntryId: '266192',
        title: 'Wingspan',
        yearPublished: 2019,
        type: 'boardgame',
        usersRated: 100,
        averageRating: 8,
        bayesAverage: 7.84,
        boardGameRank: 38,
        thumbnailUrl: null,
      },
    )
  })

  it('includes thumbnailUrl when present', () => {
    const hit = toSearchHit({
      bggId: '13',
      name: 'Catan',
      thumbnailUrl: 'https://cf.geekdo-images.com/catan.jpg',
    })
    assert.equal(hit.thumbnailUrl, 'https://cf.geekdo-images.com/catan.jpg')
  })
})

describe('DEFAULT_RESULT_LIMIT', () => {
  it('is 20', () => {
    assert.equal(DEFAULT_RESULT_LIMIT, 20)
  })
})

describe('attachMissingThumbnails', () => {
  it('skips resolve when every row already has a url', async () => {
    let called = 0
    const rows = [
      { bggId: '1', thumbnailUrl: 'https://cdn/1.jpg' },
      { bggId: '2', thumbnailUrl: 'https://cdn/2.jpg' },
    ]
    await attachMissingThumbnails(rows, async () => {
      called += 1
      return { results: [] }
    })
    assert.equal(called, 0)
  })

  it('resolves only missing ids and writes urls onto rows', async () => {
    const seen = []
    const rows = [
      { bggId: '1', thumbnailUrl: 'https://cdn/1.jpg' },
      { bggId: '2', thumbnailUrl: null },
      { bggId: '3' },
    ]
    await attachMissingThumbnails(rows, async (ids) => {
      seen.push(ids)
      return {
        results: [
          { catalogEntryId: '2', thumbnailUrl: 'https://cdn/2.jpg' },
          { catalogEntryId: '3', thumbnailUrl: 'https://cdn/3.jpg' },
        ],
      }
    })
    assert.deepEqual(seen, [['2', '3']])
    assert.equal(rows[1].thumbnailUrl, 'https://cdn/2.jpg')
    assert.equal(rows[2].thumbnailUrl, 'https://cdn/3.jpg')
    assert.equal(rows[0].thumbnailUrl, 'https://cdn/1.jpg')
  })
})

describe('searchCatalogGames', () => {
  it('returns at most 20 hits and fills missing thumbs after rank', async () => {
    const docs = []
    for (let i = 1; i <= 25; i += 1) {
      docs.push({
        id: String(i),
        data: () => ({
          bggId: String(i),
          name: `Game ${String(i).padStart(2, '0')}`,
          rank: i,
          searchPrefixes: ['ga', 'gam', 'game'],
        }),
      })
    }
    const db = {
      collection: () => ({
        where: () => ({
          get: async () => ({ docs }),
        }),
      }),
    }
    const seen = []
    const results = await searchCatalogGames(db, 'game', {
      resolveThumbs: async (ids) => {
        seen.push(ids)
        return {
          results: ids.map((id) => ({ catalogEntryId: id, thumbnailUrl: `https://cdn/${id}.jpg` })),
        }
      },
    })
    assert.equal(results.length, 20)
    assert.equal(results[0].catalogEntryId, '1')
    assert.equal(results[19].catalogEntryId, '20')
    assert.deepEqual(seen[0], Array.from({ length: 20 }, (_, i) => String(i + 1)))
    assert.equal(results[0].thumbnailUrl, 'https://cdn/1.jpg')
  })
})
