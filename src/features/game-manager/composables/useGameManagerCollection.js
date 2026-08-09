import { onMounted, ref, shallowRef } from 'vue'
import { searchBggCatalog } from '../catalog/bggCatalogClient.js'
import { CATALOG_ATTRIBUTION } from '../catalog/catalogAttribution.js'
import {
  deleteManagerCollectionItem,
  listManagerCollection,
  upsertManagerCollectionItem,
} from '../firebase/managerStore.js'
import { useGameManagerAuth } from './useGameManagerAuth.js'
import { addCustomTitleToCollection, applyCatalogPickToCollection } from '../collection/collectionViewModel.js'

export function useGameManagerCollection() {
  const { user } = useGameManagerAuth()
  const items = shallowRef([])
  const loading = ref(false)
  const searchResults = shallowRef([])
  const searchPending = ref(false)
  const attribution = CATALOG_ATTRIBUTION

  async function reload() {
    const uid = user.value?.uid
    if (!uid) {
      items.value = []
      return
    }
    loading.value = true
    try {
      items.value = await listManagerCollection(uid)
    } finally {
      loading.value = false
    }
  }

  onMounted(reload)

  async function searchCatalog(query) {
    searchPending.value = true
    try {
      const result = await searchBggCatalog(query)
      searchResults.value = result.ok ? result.results : []
    } finally {
      searchPending.value = false
    }
  }

  async function addCatalogResult(result) {
    const uid = user.value?.uid
    if (!uid) return
    const applied = applyCatalogPickToCollection(items.value, {
      catalogEntryId: result.catalogEntryId,
      title: result.title,
      yearPublished: result.yearPublished,
    })
    items.value = applied.items
    for (const item of applied.items) {
      if (item.kind === 'catalog' && item.catalogEntryId === result.catalogEntryId) {
        await upsertManagerCollectionItem(uid, item.id, item)
      }
    }
    await reload()
  }

  async function addCustom(title) {
    const uid = user.value?.uid
    if (!uid) return
    const { items: next, entry } = addCustomTitleToCollection(items.value, title)
    items.value = next
    await upsertManagerCollectionItem(uid, entry.id, entry)
    await reload()
  }

  async function removeItem(itemId) {
    const uid = user.value?.uid
    if (!uid) return
    await deleteManagerCollectionItem(uid, itemId)
    await reload()
  }

  return {
    items,
    loading,
    searchResults,
    searchPending,
    attribution,
    reload,
    searchCatalog,
    addCatalogResult,
    addCustom,
    removeItem,
  }
}
