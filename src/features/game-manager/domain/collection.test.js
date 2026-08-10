import assert from 'node:assert/strict'
import test from 'node:test'
import {
  collectionHasCatalogEntry,
  createCustomCollectionEntry,
  renameCustomCollectionEntry,
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

test('renameCustomCollectionEntry updates title for matching custom id', () => {
  const entry = createCustomCollectionEntry({ title: 'A', id: 'custom:1' })
  const next = renameCustomCollectionEntry([entry], 'custom:1', 'B')
  assert.equal(next[0].title, 'B')
})

test('upsertCatalogCollectionItem stores year and art', () => {
  const items = upsertCatalogCollectionItem([], {
    catalogEntryId: '13',
    title: 'Catan',
    yearPublished: 1995,
    thumbnailUrl: 'https://example.com/t.jpg',
  })
  assert.equal(items[0].yearPublished, 1995)
  assert.equal(items[0].thumbnailUrl, 'https://example.com/t.jpg')
})
