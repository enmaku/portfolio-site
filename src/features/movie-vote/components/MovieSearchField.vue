<template>
  <div class="mv-search q-px-md q-pb-sm">
    <div v-if="!configured" class="text-caption text-warning q-mb-xs">
      Add <code class="text-body2">VITE_TMDB_READ_ACCESS_TOKEN</code> or <code class="text-body2">VITE_TMDB_API_KEY</code> in
      <code class="text-body2">.env</code> (see <code class="text-body2">.env.example</code>), then restart the dev server.
    </div>
    <q-input
      v-model="query"
      outlined
      dense
      clearable
      label="Search movies"
      :loading="loading"
      autocomplete="off"
      autocorrect="off"
      spellcheck="false"
      inputmode="search"
      @update:model-value="onQueryInput"
    >
      <template #hint> Type at least 2 characters to search. </template>
    </q-input>

    <!-- Inline list (no q-menu): avoids focus bugs and stray overlays on desktop/mobile -->
    <q-list
      v-show="showSuggestionPanel"
      bordered
      separator
      class="rounded-borders q-mt-xs mv-search__suggestions"
      dense
    >
      <q-item v-for="r in suggestions" :key="r.id" v-ripple clickable @click="pick(r)">
        <q-item-section avatar class="mv-search__avatar">
          <q-img
            v-if="thumbUrls[r.id]"
            :src="thumbUrls[r.id]"
            width="40px"
            height="60px"
            fit="cover"
            class="rounded-borders"
            spinner-color="primary"
            loading="lazy"
          />
          <q-icon v-else name="movie" size="md" color="grey-5" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ r.title }}</q-item-label>
          <q-item-label v-if="r.release_date" caption>{{ String(r.release_date).slice(0, 4) }}</q-item-label>
        </q-item-section>
      </q-item>
      <q-item v-if="showNoResults">
        <q-item-section class="text-grey-6 text-caption">No results</q-item-section>
      </q-item>
      <q-item v-if="showNeedKey">
        <q-item-section class="text-caption text-warning">
          Set TMDB read token or API key in <code>.env</code> to load results.
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { genresLabelFromApi, getMovieDetails, isTmdbConfigured, posterUrl, searchMovies } from '../tmdb.js'

const emit = defineEmits(['select'])

const configured = computed(() => isTmdbConfigured())
const query = ref('')
const suggestions = ref([])
const loading = ref(false)
const thumbUrls = ref(/** @type {Record<number, string>} */ ({}))
const lastSearchedQuery = ref('')

/** @type {AbortController | null} */
let abort = null
let debounceId = 0

function onQueryInput() {
  window.clearTimeout(debounceId)
  debounceId = window.setTimeout(runSearch, 320)
}

const showNoResults = computed(
  () =>
    configured.value &&
    query.value.trim().length >= 2 &&
    !loading.value &&
    lastSearchedQuery.value === query.value.trim() &&
    suggestions.value.length === 0,
)

const showNeedKey = computed(
  () => !configured.value && query.value.trim().length >= 2 && !loading.value,
)

const showSuggestionPanel = computed(() => {
  const q = query.value.trim()
  if (q.length < 2) return false
  return loading.value || suggestions.value.length > 0 || showNoResults.value || showNeedKey.value
})

async function runSearch() {
  const q = query.value.trim()
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
    const results = await searchMovies(q, { signal: abort.signal })
    suggestions.value = results
    lastSearchedQuery.value = q
    const next = {}
    for (const r of results.slice(0, 12)) {
      if (r.poster_path) {
        next[r.id] = posterUrl(r.poster_path, 'w92') ?? ''
      }
    }
    thumbUrls.value = next
  } catch {
    if (abort?.signal.aborted) return
    suggestions.value = []
    lastSearchedQuery.value = q
  } finally {
    loading.value = false
  }
}

/**
 * @param {{ id: number, title: string, poster_path: string | null, overview: string, release_date?: string }} r
 */
async function pick(r) {
  if (!isTmdbConfigured()) return
  /** @type {number | undefined} */
  let runtime
  /** @type {string | undefined} */
  let genres
  try {
    const d = await getMovieDetails(r.id)
    if (d) {
      if (typeof d.runtime === 'number' && d.runtime > 0) runtime = d.runtime
      const g = genresLabelFromApi(d.genres)
      if (g) genres = g
    }
  } catch {
    void 0
  }
  emit('select', {
    localId: crypto.randomUUID(),
    tmdbId: r.id,
    title: r.title,
    posterPath: r.poster_path,
    overview: typeof r.overview === 'string' ? r.overview : '',
    releaseDate: r.release_date,
    runtime,
    genres,
  })
  query.value = ''
  suggestions.value = []
  lastSearchedQuery.value = ''
}

watch(query, (q) => {
  if (!String(q).trim()) {
    suggestions.value = []
    lastSearchedQuery.value = ''
  }
})
</script>

<style scoped>
.mv-search__suggestions {
  max-height: 50vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.mv-search__avatar {
  min-width: 48px;
}
</style>
