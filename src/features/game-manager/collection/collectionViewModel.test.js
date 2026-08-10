import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CATALOG_ATTRIBUTION,
  addCustomTitleToCollection,
  applyCatalogPickToCollection,
  catalogItemNeedsArtBackfill,
  renameCustomInCollection,
  sortCollectionItemsByTitle,
} from './collectionViewModel.js'

test('applyCatalogPickToCollection upserts by catalog id', () => {
  let items = []
  ;({ items } = applyCatalogPickToCollection(items, {
    catalogEntryId: '1',
    title: 'Catan',
  }))
  ;({ items } = applyCatalogPickToCollection(items, {
    catalogEntryId: '1',
    title: 'Catan',
  }))
  assert.equal(items.length, 1)
})

test('addCustomTitleToCollection appends custom entry', () => {
  const { items, entry } = addCustomTitleToCollection([], 'Homebrew')
  assert.equal(items.length, 1)
  assert.equal(entry.kind, 'custom')
})

test('renameCustomInCollection renames only the matching custom row', () => {
  const { items: seeded, entry } = addCustomTitleToCollection([], 'Old')
  const { items, entry: renamed } = renameCustomInCollection(seeded, entry.id, 'New')
  assert.equal(items.length, 1)
  assert.equal(renamed.title, 'New')
})

test('catalogItemNeedsArtBackfill detects catalog rows missing thumbnails', () => {
  assert.equal(
    catalogItemNeedsArtBackfill({ kind: 'catalog', catalogEntryId: '1', thumbnailUrl: null }),
    true,
  )
  assert.equal(
    catalogItemNeedsArtBackfill({
      kind: 'catalog',
      catalogEntryId: '1',
      thumbnailUrl: 'https://example.com/t.jpg',
    }),
    false,
  )
  assert.equal(catalogItemNeedsArtBackfill({ kind: 'custom', title: 'X' }), false)
})

test('catalog attribution constant is non-empty', () => {
  assert.equal(typeof CATALOG_ATTRIBUTION, 'string')
  assert.ok(CATALOG_ATTRIBUTION.length > 0)
})

test('sortCollectionItemsByTitle orders alphabetically', () => {
  const sorted = sortCollectionItemsByTitle([
    { id: '2', title: 'Catan' },
    { id: '1', title: 'Azul' },
    { id: '3', title: 'Brass' },
  ])
  assert.deepEqual(
    sorted.map((item) => item.title),
    ['Azul', 'Brass', 'Catan'],
  )
})
