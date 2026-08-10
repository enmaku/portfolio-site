<template>
  <div
    class="gm-catalog-search column"
    :class="{ 'gm-catalog-search--panel col': panel }"
    data-testid="gm-catalog-search"
  >
    <div class="gm-catalog-search__header q-pb-sm">
      <div v-if="!configured" class="text-caption text-warning q-mb-xs">
        Catalog search is off. Cloud Functions base URL could not be resolved.
      </div>
      <q-input
        ref="inputRef"
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
    </div>

    <q-scroll-area
      v-show="showSuggestionPanel"
      class="gm-catalog-search__scroll col"
      :thumb-style="scrollThumbStyle"
      data-testid="gm-catalog-search-scroll"
    >
      <q-list
        bordered
        separator
        dense
        class="rounded-borders gm-catalog-search__suggestions"
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
    </q-scroll-area>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { CATALOG_ATTRIBUTION } from '../catalog/catalogAttribution.js'
import { isBggCatalogConfigured, searchBggCatalog } from '../catalog/bggCatalogClient.js'
import { rankCatalogSearchHits } from '../catalog/rankCatalogSearch.js'

const props = defineProps({
  /** Fill parent height: search top, scrollable results below. */
  panel: {
    type: Boolean,
    default: false,
  },
  autofocus: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['select'])

const configured = computed(() => isBggCatalogConfigured())
const attribution = CATALOG_ATTRIBUTION
const query = ref('')
const suggestions = ref([])
const loading = ref(false)
const thumbUrls = ref(/** @type {Record<string, string>} */ ({}))
const lastSearchedQuery = ref('')
const inputRef = ref(null)

const scrollThumbStyle = {
  borderRadius: '4px',
  background: 'rgba(128, 128, 128, 0.45)',
  width: '4px',
  opacity: '0.75',
}

/** @type {AbortController | null} */
let abort = null
let debounceId = 0

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
    suggestions.value = rankCatalogSearchHits(rawHits, q, { limit: 20 })
    lastSearchedQuery.value = q
    thumbUrls.value = {}
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
    thumbnailUrl: hit.thumbnailUrl || thumbUrls.value[hit.catalogEntryId] || null,
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

function focusInput() {
  const input = inputRef.value
  if (input && typeof input.focus === 'function') {
    input.focus()
  }
}

watch(query, (q) => {
  if (!String(q).trim()) {
    suggestions.value = []
    lastSearchedQuery.value = ''
  }
})

onMounted(async () => {
  if (!props.autofocus) return
  await nextTick()
  focusInput()
})

defineExpose({ resetQueryState, focusInput })
</script>

<style scoped>
.gm-catalog-search--panel {
  min-height: 0;
}

.gm-catalog-search__header {
  flex-shrink: 0;
}

.gm-catalog-search__scroll {
  min-height: 0;
}

.gm-catalog-search:not(.gm-catalog-search--panel) .gm-catalog-search__scroll {
  flex: 0 0 auto;
  height: min(45vh, 360px);
  margin-top: 8px;
}

.gm-catalog-search__custom {
  background: rgba(25, 118, 210, 0.08);
}
</style>
