import assert from 'node:assert/strict'
import test from 'node:test'
import { CATALOG_ATTRIBUTION, addCustomTitleToCollection, applyCatalogPickToCollection } from './collectionViewModel.js'

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

test('catalog attribution constant is non-empty', () => {
  assert.equal(typeof CATALOG_ATTRIBUTION, 'string')
  assert.ok(CATALOG_ATTRIBUTION.length > 0)
})
