<template>
  <div class="gm-catalog-search" data-testid="gm-catalog-search">
    <div v-if="!configured" class="text-caption text-warning q-mb-xs">
      Catalog search is off. Cloud Functions base URL could not be resolved.
    </div>
    <q-input
      v-model="query"
      outlined
      dense
      clearable
      label="Search or enter a game title"
      :loading="loading"
      autocomplete="off"
      autocorrect="off"
      spellcheck="false"
      inputmode="search"
      data-testid="gm-catalog-search-input"
      @update:model-value="onQueryInput"
      @keydown.enter.prevent="onEnterPressed"
    />

    <div class="text-caption text-grey-6 q-mt-xs" data-testid="gm-catalog-search-attribution">
      {{ attribution }}
    </div>

    <q-list
      v-show="showSuggestionPanel"
      bordered
      separator
      dense
      class="rounded-borders q-mt-sm gm-catalog-search__suggestions"
      data-testid="gm-catalog-search-results"
    >
      <q-item
        v-for="hit in suggestions"
        :key="hit.catalogEntryId"
        v-ripple
        clickable
        :data-testid="`gm-catalog-hit-${hit.catalogEntryId}`"
        @click="pickCatalog(hit)"
      >
        <q-item-section avatar>
          <div class="gm-row-thumb flex flex-center">
            <q-img
              v-if="thumbUrls[hit.catalogEntryId]"
              :src="thumbUrls[hit.catalogEntryId]"
              width="40px"
              height="56px"
              fit="cover"
              spinner-color="primary"
              loading="lazy"
            />
            <q-icon v-else name="casino" size="md" color="grey-5" />
          </div>
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ hit.title }}</q-item-label>
          <q-item-label v-if="hit.yearPublished" caption>{{ hit.yearPublished }}</q-item-label>
        </q-item-section>
      </q-item>

      <q-item v-if="showNoResults">
        <q-item-section class="text-grey-6 text-caption">No catalog match.</q-item-section>
      </q-item>

      <q-item
        v-if="showCustomOption"
        v-ripple
        clickable
        class="gm-catalog-search__custom"
        data-testid="gm-catalog-search-custom"
        @click="pickCustom(trimmedQuery)"
      >
        <q-item-section avatar>
          <div class="gm-row-thumb flex flex-center">
            <q-icon name="add" size="md" color="primary" />
          </div>
        </q-item-section>
        <q-item-section>
          <q-item-label>Add &ldquo;{{ trimmedQuery }}&rdquo; as a custom entry</q-item-label>
          <q-item-label caption class="text-grey-6">No box art — just the title.</q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { CATALOG_ATTRIBUTION } from '../catalog/catalogAttribution.js'
import {
  fetchBggCatalogEntries,
  isBggCatalogConfigured,
  searchBggCatalog,
} from '../catalog/bggCatalogClient.js'
import {
  rankCatalogSearchHits,
  selectCatalogSearchEnrichmentIds,
} from '../catalog/rankCatalogSearch.js'

const emit = defineEmits(['select'])

const configured = computed(() => isBggCatalogConfigured())
const attribution = CATALOG_ATTRIBUTION
const query = ref('')
const suggestions = ref([])
const loading = ref(false)
const thumbUrls = ref(/** @type {Record<string, string>} */ ({}))
const lastSearchedQuery = ref('')

/** @type {AbortController | null} */
let abort = null
let debounceId = 0
/** @type {Map<string, string>} */
const thumbCache = new Map()
/** @type {Map<string, object>} */
const detailCache = new Map()

function onQueryInput() {
  window.clearTimeout(debounceId)
  debounceId = window.setTimeout(runSearch, 320)
}

const trimmedQuery = computed(() => query.value.trim())

const showNoResults = computed(
  () =>
    configured.value &&
    trimmedQuery.value.length >= 2 &&
    !loading.value &&
    lastSearchedQuery.value === trimmedQuery.value &&
    suggestions.value.length === 0,
)

const showCustomOption = computed(() => trimmedQuery.value.length >= 2 && !loading.value)

const showSuggestionPanel = computed(() => {
  if (trimmedQuery.value.length < 2) return false
  return loading.value || suggestions.value.length > 0 || showNoResults.value || showCustomOption.value
})

async function runSearch() {
  const q = trimmedQuery.value
  if (abort) abort.abort()
  if (q.length < 2) {
    suggestions.value = []
    thumbUrls.value = {}
    lastSearchedQuery.value = ''
    return
  }

  if (!configured.value) {
    suggestions.value = []
    thumbUrls.value = {}
    lastSearchedQuery.value = q
    return
  }

  abort = new AbortController()
  loading.value = true
  try {
    const result = await searchBggCatalog(q, { signal: abort.signal })
    if (abort.signal.aborted) return
    const rawHits = result.ok ? result.results : []
    const enrichIds = selectCatalogSearchEnrichmentIds(rawHits, q, 20)
    /** @type {Record<string, object>} */
    const detailsById = {}
    for (const id of enrichIds) {
      if (detailCache.has(id)) detailsById[id] = detailCache.get(id)
    }
    const missing = enrichIds.filter((id) => !detailsById[id])
    if (missing.length) {
      const detailResult = await fetchBggCatalogEntries(missing, { signal: abort.signal, stats: true })
      if (abort.signal.aborted) return
      if (detailResult.ok) {
        for (const entry of detailResult.entries) {
          detailCache.set(entry.catalogEntryId, entry)
          detailsById[entry.catalogEntryId] = entry
          const url = entry.thumbnailUrl || ''
          thumbCache.set(entry.catalogEntryId, url)
        }
      }
    }

    const ranked = rankCatalogSearchHits(rawHits, q, { detailsById, limit: 20 })
    suggestions.value = ranked
    lastSearchedQuery.value = q

    const nextThumbs = { ...thumbUrls.value }
    for (const hit of ranked) {
      const cached = thumbCache.get(hit.catalogEntryId)
      if (cached) nextThumbs[hit.catalogEntryId] = cached
      else if (hit.thumbnailUrl) nextThumbs[hit.catalogEntryId] = hit.thumbnailUrl
    }
    thumbUrls.value = nextThumbs
  } catch {
    if (abort?.signal.aborted) return
    suggestions.value = []
    lastSearchedQuery.value = q
  } finally {
    loading.value = false
  }
}

function resetQueryState() {
  query.value = ''
  suggestions.value = []
  thumbUrls.value = {}
  lastSearchedQuery.value = ''
}

/**
 * @param {{ catalogEntryId: string, title: string, yearPublished?: number | null, thumbnailUrl?: string | null }} hit
 */
async function pickCatalog(hit) {
  emit('select', {
    source: 'catalog',
    catalogEntryId: hit.catalogEntryId,
    title: hit.title,
    yearPublished: hit.yearPublished ?? null,
    thumbnailUrl:
      hit.thumbnailUrl ||
      thumbUrls.value[hit.catalogEntryId] ||
      thumbCache.get(hit.catalogEntryId) ||
      null,
  })
  resetQueryState()
}

/** @param {string} title */
function pickCustom(title) {
  const trimmed = title.trim()
  if (trimmed.length < 2) return
  emit('select', {
    source: 'custom',
    title: trimmed,
  })
  resetQueryState()
}

function onEnterPressed() {
  if (showCustomOption.value) pickCustom(trimmedQuery.value)
}

watch(query, (q) => {
  if (!String(q).trim()) {
    suggestions.value = []
    lastSearchedQuery.value = ''
  }
})

defineExpose({ resetQueryState })
</script>

<style scoped>
.gm-catalog-search__suggestions {
  max-height: 45vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.gm-catalog-search__custom {
  background: rgba(25, 118, 210, 0.08);
}
</style>
