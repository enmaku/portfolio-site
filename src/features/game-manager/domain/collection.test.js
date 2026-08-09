import assert from 'node:assert/strict'
import test from 'node:test'
import {
  collectionHasCatalogEntry,
  createCustomCollectionEntry,
  upsertCatalogCollectionItem,
} from './collection.js'

test('collection allows only one item per catalog entry id', () => {
  let items = []
  items = upsertCatalogCollectionItem(items, {
    catalogEntryId: '295947',
    title: 'Cascadia',
    thumbnailUrl: 'https://example.com/a.jpg',
  })
  items = upsertCatalogCollectionItem(items, {
    catalogEntryId: '295947',
    title: 'Cascadia Updated',
    thumbnailUrl: 'https://example.com/b.jpg',
  })
  assert.equal(items.length, 1)
  assert.equal(items[0].title, 'Cascadia Updated')
  assert.equal(collectionHasCatalogEntry(items, '295947'), true)
})

test('custom collection entry requires only a title', () => {
  const entry = createCustomCollectionEntry({ title: 'Homebrew Hexes' })
  assert.equal(entry.kind, 'custom')
  assert.equal(entry.title, 'Homebrew Hexes')
  assert.ok(entry.id)
})
