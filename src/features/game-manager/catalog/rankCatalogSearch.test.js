import assert from 'node:assert/strict'
import test from 'node:test'
import {
  catalogTitleMatchScore,
  isExcludedCatalogSearchType,
  rankCatalogSearchHits,
  selectCatalogSearchEnrichmentIds,
} from './rankCatalogSearch.js'

test('isExcludedCatalogSearchType drops expansions and accessories', () => {
  assert.equal(isExcludedCatalogSearchType('boardgame'), false)
  assert.equal(isExcludedCatalogSearchType('boardgameexpansion'), true)
  assert.equal(isExcludedCatalogSearchType('boardgameaccessory'), true)
})

test('catalogTitleMatchScore prefers exact then prefix matches', () => {
  assert.ok(catalogTitleMatchScore('wingspan', 'Wingspan') > catalogTitleMatchScore('wingspan', 'Wingspan Asia'))
  assert.ok(catalogTitleMatchScore('wing', 'Wingspan') > catalogTitleMatchScore('wing', 'Ace of Aces: Wingleader'))
})

test('rankCatalogSearchHits filters expansions and surfaces popular base game', () => {
  const hits = [
    { catalogEntryId: '1', title: 'Ace of Aces: Wingleader', type: 'boardgame', yearPublished: 1988 },
    {
      catalogEntryId: '2',
      title: 'Wingspan: European Expansion',
      type: 'boardgameexpansion',
      yearPublished: 2019,
    },
    { catalogEntryId: '266192', title: 'Wingspan', type: 'boardgame', yearPublished: 2019 },
    { catalogEntryId: '3', title: 'Wingspan Asia', type: 'boardgame', yearPublished: 2022 },
  ]
  const detailsById = {
    1: { catalogEntryId: '1', title: 'Ace of Aces: Wingleader', bayesAverage: 5.5, usersRated: 200 },
    266192: {
      catalogEntryId: '266192',
      title: 'Wingspan',
      bayesAverage: 7.84,
      usersRated: 100000,
      boardGameRank: 38,
      thumbnailUrl: 'https://example.com/w.jpg',
    },
    3: {
      catalogEntryId: '3',
      title: 'Wingspan Asia',
      bayesAverage: 7.6,
      usersRated: 10000,
      boardGameRank: 90,
    },
  }

  const ranked = rankCatalogSearchHits(hits, 'wing', { detailsById })
  assert.equal(
    ranked.some((h) => h.type === 'boardgameexpansion'),
    false,
  )
  assert.equal(ranked[0].catalogEntryId, '266192')
  assert.equal(ranked[0].thumbnailUrl, 'https://example.com/w.jpg')
})

test('exact query puts Wingspan before Wingspan Asia even if Asia has similar bayes', () => {
  const hits = [
    { catalogEntryId: '3', title: 'Wingspan Asia', type: 'boardgame' },
    { catalogEntryId: '266192', title: 'Wingspan', type: 'boardgame' },
  ]
  const detailsById = {
    3: { bayesAverage: 7.9, usersRated: 9000 },
    266192: { bayesAverage: 7.84, usersRated: 100000 },
  }
  const ranked = rankCatalogSearchHits(hits, 'wingspan', { detailsById })
  assert.equal(ranked[0].catalogEntryId, '266192')
})

test('selectCatalogSearchEnrichmentIds prefers text-relevant ids before popularity fetch', () => {
  const hits = [
    { catalogEntryId: '1', title: 'Ace of Aces: Wingleader', type: 'boardgame' },
    { catalogEntryId: '266192', title: 'Wingspan', type: 'boardgame' },
  ]
  const ids = selectCatalogSearchEnrichmentIds(hits, 'wing', 20)
  assert.equal(ids[0], '266192')
})
