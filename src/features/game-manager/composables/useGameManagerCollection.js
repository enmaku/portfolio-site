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
  function addFromSearchPick(pick) {
    const uid = user.value?.uid
    if (!uid) return null
    error.value = null

    if (pick.source === 'custom') {
      const { items: next, entry } = addCustomTitleToCollection(items.value, pick.title)
      items.value = next
      void upsertManagerCollectionItem(uid, entry.id, entry).catch((e) => {
        error.value = e
      })
      return entry
    }

    const entry = {
      catalogEntryId: pick.catalogEntryId,
      title: pick.title,
      yearPublished: pick.yearPublished ?? null,
      thumbnailUrl: pick.thumbnailUrl || null,
    }
    const applied = applyCatalogPickToCollection(items.value, entry)
    items.value = applied.items
    const saved = applied.items.find(
      (i) => i.kind === 'catalog' && i.catalogEntryId === entry.catalogEntryId,
    )
    if (saved) {
      void upsertManagerCollectionItem(uid, saved.id, saved).catch((e) => {
        error.value = e
      })
    }
    return saved || null
  }

  function renameCustom(itemId, title) {
    const uid = user.value?.uid
    if (!uid) return
    error.value = null
    const { items: next, entry } = renameCustomInCollection(items.value, itemId, title)
    if (!entry) {
      error.value = new Error('Custom entry not found')
      return
    }
    items.value = next
    void upsertManagerCollectionItem(uid, entry.id, entry).catch((e) => {
      error.value = e
    })
  }

  function removeItem(itemId) {
    const uid = user.value?.uid
    if (!uid) return
    const previous = items.value
    items.value = previous.filter((item) => item.id !== itemId)
    error.value = null
    void deleteManagerCollectionItem(uid, itemId).catch((e) => {
      items.value = previous
      error.value = e
    })
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
