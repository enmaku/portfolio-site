/**
 * @param {object[]} items
 * @param {string} catalogEntryId
 */
export function collectionHasCatalogEntry(items, catalogEntryId) {
  return items.some((item) => item.kind === 'catalog' && item.catalogEntryId === catalogEntryId)
}

/**
 * @param {object[]} items
 * @param {{ catalogEntryId: string, title: string, thumbnailUrl?: string, imageUrl?: string, minPlayers?: number, maxPlayers?: number, playingTime?: number }} entry
 */
export function upsertCatalogCollectionItem(items, entry) {
  const next = {
    kind: 'catalog',
    id: `catalog:${entry.catalogEntryId}`,
    catalogEntryId: entry.catalogEntryId,
    title: entry.title,
    thumbnailUrl: entry.thumbnailUrl || null,
    imageUrl: entry.imageUrl || null,
    minPlayers: entry.minPlayers ?? null,
    maxPlayers: entry.maxPlayers ?? null,
    playingTime: entry.playingTime ?? null,
  }
  const idx = items.findIndex((item) => item.kind === 'catalog' && item.catalogEntryId === entry.catalogEntryId)
  if (idx === -1) return [...items, next]
  const copy = [...items]
  copy[idx] = next
  return copy
}

/**
 * @param {{ title: string, id?: string }} input
 */
export function createCustomCollectionEntry(input) {
  const title = String(input.title || '').trim()
  if (!title) throw new Error('Custom collection entry requires a title')
  return {
    kind: 'custom',
    id: input.id || `custom:${cryptoRandomId()}`,
    title,
  }
}

function cryptoRandomId() {
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}
