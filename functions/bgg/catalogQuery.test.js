const assert = require('node:assert/strict')
const { describe, it } = require('node:test')
const {
  compareCatalogDocs,
  docMatchesAllTokens,
  pickLookupToken,
  queryTokens,
  toSearchHit,
} = require('./catalogQuery')

describe('queryTokens', () => {
  it('drops stopwords and short tokens', () => {
    assert.deepEqual(queryTokens('The Lord of the Rings'), ['lord', 'rings'])
    assert.deepEqual(queryTokens('a'), [])
  })
})

describe('pickLookupToken', () => {
  it('prefers the longest token', () => {
    assert.equal(pickLookupToken(['lord', 'rings']), 'rings')
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
      },
    )
  })
})
