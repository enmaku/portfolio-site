import { collectionHasCatalogEntry, createCustomCollectionEntry, upsertCatalogCollectionItem } from '../domain/collection.js'
import { CATALOG_ATTRIBUTION } from '../catalog/catalogAttribution.js'

export { CATALOG_ATTRIBUTION }

/**
 * @param {object[]} items
 * @param {object} catalogEntry
 * @param {{ addToShelf?: boolean }} [options]
 */
export function applyCatalogPickToCollection(items, catalogEntry, options = {}) {
  const addToShelf = options.addToShelf !== false
  if (!addToShelf) {
    return { items, added: false, alreadyOwned: collectionHasCatalogEntry(items, catalogEntry.catalogEntryId) }
  }
  const alreadyOwned = collectionHasCatalogEntry(items, catalogEntry.catalogEntryId)
  return {
    items: upsertCatalogCollectionItem(items, catalogEntry),
    added: !alreadyOwned,
    alreadyOwned,
  }
}

/**
 * @param {object[]} items
 * @param {string} title
 */
export function addCustomTitleToCollection(items, title) {
  const entry = createCustomCollectionEntry({ title })
  return { items: [...items, entry], entry }
}
