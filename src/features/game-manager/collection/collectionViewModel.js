import {
  collectionHasCatalogEntry,
  createCustomCollectionEntry,
  renameCustomCollectionEntry,
  upsertCatalogCollectionItem,
} from '../domain/collection.js'
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

/**
 * @param {object[]} items
 * @param {string} itemId
 * @param {string} title
 */
export function renameCustomInCollection(items, itemId, title) {
  const next = renameCustomCollectionEntry(items, itemId, title)
  const entry = next.find((item) => item.id === itemId)
  return { items: next, entry }
}

/**
 * @param {object} item
 * @returns {boolean}
 */
export function catalogItemNeedsArtBackfill(item) {
  return Boolean(item && item.kind === 'catalog' && item.catalogEntryId && !item.thumbnailUrl)
}

/**
 * @param {object} item
 * @returns {string | null}
 */
export function collectionItemThumbUrl(item) {
  if (!item) return null
  return item.thumbnailUrl || item.imageUrl || null
}
