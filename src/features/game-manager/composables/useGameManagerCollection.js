import { ref, shallowRef, watch } from 'vue'
import {
  fetchBggCatalogEntry,
  searchBggCatalog,
} from '../catalog/bggCatalogClient.js'
import { CATALOG_ATTRIBUTION } from '../catalog/catalogAttribution.js'
import {
  addCustomTitleToCollection,
  applyCatalogPickToCollection,
  catalogItemNeedsArtBackfill,
  renameCustomInCollection,
} from '../collection/collectionViewModel.js'
import {
  deleteManagerCollectionItem,
  listManagerCollection,
  upsertManagerCollectionItem,
} from '../firebase/managerStore.js'
import { useGameManagerAuth } from './useGameManagerAuth.js'

export function useGameManagerCollection() {
  const { user } = useGameManagerAuth()
  const items = shallowRef([])
  const loading = ref(false)
  const error = ref(null)
  const attribution = CATALOG_ATTRIBUTION

  async function reload() {
    const uid = user.value?.uid
    if (!uid) {
      items.value = []
      return
    }
    loading.value = true
    error.value = null
    try {
      items.value = await listManagerCollection(uid)
      void backfillMissingArt(uid)
    } catch (e) {
      error.value = e
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * @param {string} uid
   */
  async function backfillMissingArt(uid) {
    const missing = items.value.filter(catalogItemNeedsArtBackfill)
    for (const item of missing.slice(0, 8)) {
      try {
        const detail = await fetchBggCatalogEntry(item.catalogEntryId, { stats: false })
        if (!detail.ok || !detail.entry) continue
        const applied = applyCatalogPickToCollection(items.value, {
          catalogEntryId: detail.entry.catalogEntryId,
          title: detail.entry.title || item.title,
          yearPublished: detail.entry.yearPublished,
          thumbnailUrl: detail.entry.thumbnailUrl,
          imageUrl: detail.entry.imageUrl,
          minPlayers: detail.entry.minPlayers,
          maxPlayers: detail.entry.maxPlayers,
          playingTime: detail.entry.playingTime,
        })
        const next = applied.items.find((i) => i.id === item.id)
        if (!next?.thumbnailUrl) continue
        await upsertManagerCollectionItem(uid, next.id, next)
        items.value = applied.items
      } catch {
        // leave row without art
      }
    }
  }

  watch(
    () => user.value?.uid || null,
    () => {
      reload().catch(() => {})
    },
    { immediate: true },
  )

  /**
   * @param {{ source: string, catalogEntryId?: string, title: string, yearPublished?: number | null, thumbnailUrl?: string | null }} pick
   */
  async function addFromSearchPick(pick) {
    const uid = user.value?.uid
    if (!uid) return
    error.value = null
    try {
      if (pick.source === 'custom') {
        const { items: next, entry } = addCustomTitleToCollection(items.value, pick.title)
        items.value = next
        await upsertManagerCollectionItem(uid, entry.id, entry)
        await reload()
        return entry
      }

      let entry = {
        catalogEntryId: pick.catalogEntryId,
        title: pick.title,
        yearPublished: pick.yearPublished ?? null,
        thumbnailUrl: pick.thumbnailUrl || null,
      }
      const detail = await fetchBggCatalogEntry(pick.catalogEntryId)
      if (detail.ok && detail.entry) {
        entry = {
          catalogEntryId: detail.entry.catalogEntryId,
          title: detail.entry.title || pick.title,
          yearPublished: detail.entry.yearPublished ?? pick.yearPublished ?? null,
          thumbnailUrl: detail.entry.thumbnailUrl || pick.thumbnailUrl || null,
          imageUrl: detail.entry.imageUrl || null,
          minPlayers: detail.entry.minPlayers,
          maxPlayers: detail.entry.maxPlayers,
          playingTime: detail.entry.playingTime,
        }
      }
      const applied = applyCatalogPickToCollection(items.value, entry)
      items.value = applied.items
      const saved = applied.items.find(
        (i) => i.kind === 'catalog' && i.catalogEntryId === entry.catalogEntryId,
      )
      if (saved) await upsertManagerCollectionItem(uid, saved.id, saved)
      await reload()
      return saved
    } catch (e) {
      error.value = e
      throw e
    }
  }

  async function renameCustom(itemId, title) {
    const uid = user.value?.uid
    if (!uid) return
    error.value = null
    try {
      const { items: next, entry } = renameCustomInCollection(items.value, itemId, title)
      if (!entry) throw new Error('Custom entry not found')
      items.value = next
      await upsertManagerCollectionItem(uid, entry.id, entry)
      await reload()
    } catch (e) {
      error.value = e
      throw e
    }
  }

  async function removeItem(itemId) {
    const uid = user.value?.uid
    if (!uid) return
    const previous = items.value
    items.value = previous.filter((item) => item.id !== itemId)
    error.value = null
    try {
      await deleteManagerCollectionItem(uid, itemId)
      await reload()
    } catch (e) {
      items.value = previous
      error.value = e
      throw e
    }
  }

  return {
    items,
    loading,
    error,
    attribution,
    reload,
    searchCatalog: searchBggCatalog,
    addFromSearchPick,
    renameCustom,
    removeItem,
  }
}
