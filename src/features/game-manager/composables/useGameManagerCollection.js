import { ref, shallowRef, watch } from 'vue'
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
    } catch (e) {
      error.value = e
      throw e
    } finally {
      loading.value = false
    }
  }

  watch(
    () => user.value?.uid || null,
    () => {
      reload().catch(() => {})
    },
    { immediate: true },
  )

  async function searchCatalog(query) {
    searchPending.value = true
    error.value = null
    try {
      const result = await searchBggCatalog(query)
      searchResults.value = result.ok ? result.results : []
      if (!result.ok) error.value = new Error(result.error || 'Catalog search failed')
    } finally {
      searchPending.value = false
    }
  }

  async function addCatalogResult(result) {
    const uid = user.value?.uid
    if (!uid) return
    const previous = items.value
    const applied = applyCatalogPickToCollection(items.value, {
      catalogEntryId: result.catalogEntryId,
      title: result.title,
      yearPublished: result.yearPublished,
    })
    items.value = applied.items
    error.value = null
    try {
      for (const item of applied.items) {
        if (item.kind === 'catalog' && item.catalogEntryId === result.catalogEntryId) {
          await upsertManagerCollectionItem(uid, item.id, item)
        }
      }
      searchResults.value = []
      await reload()
    } catch (e) {
      items.value = previous
      error.value = e
      throw e
    }
  }

  async function addCustom(title) {
    const uid = user.value?.uid
    if (!uid) return
    const previous = items.value
    const { items: next, entry } = addCustomTitleToCollection(items.value, title)
    items.value = next
    error.value = null
    try {
      await upsertManagerCollectionItem(uid, entry.id, entry)
      await reload()
    } catch (e) {
      items.value = previous
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
