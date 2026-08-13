import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BGG_CATALOG_GAMES_COLLECTION,
  firestorePayloadFromCatalogDoc,
} from './bgg-upload-catalog-search-index.mjs'

test('collection id is bggCatalogGames', () => {
  assert.equal(BGG_CATALOG_GAMES_COLLECTION, 'bggCatalogGames')
})

test('firestorePayloadFromCatalogDoc maps Model A fields', () => {
  const payload = firestorePayloadFromCatalogDoc({
    bggId: '266192',
    name: 'Wingspan',
    yearPublished: 2019,
    rank: 38,
    bayesAverage: 7.8,
    average: 8,
    usersRated: 100,
    searchPrefixes: ['wi', 'wing', 'wingspan'],
  })
  assert.equal(payload.bggId, '266192')
  assert.equal(payload.name, 'Wingspan')
  assert.equal(payload.rank, 38)
  assert.deepEqual(payload.searchPrefixes, ['wi', 'wing', 'wingspan'])
  assert.equal(typeof payload.updatedAt, 'string')
})

test('firestorePayloadFromCatalogDoc nulls missing optionals', () => {
  const payload = firestorePayloadFromCatalogDoc({
    bggId: '1',
    name: 'X',
    searchPrefixes: [],
  })
  assert.equal(payload.rank, null)
  assert.equal(payload.yearPublished, null)
  assert.deepEqual(payload.searchPrefixes, [])
})
