<template>
  <q-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)">
    <q-card class="mv-detail-card column no-wrap">
      <q-card-section class="mv-detail-card__header row no-wrap q-gutter-md">
        <q-img
          v-if="posterSrc"
          :src="posterSrc"
          width="120px"
          height="180px"
          fit="cover"
          class="rounded-borders"
          style="flex-shrink: 0"
          spinner-color="primary"
          loading="lazy"
        />
        <div class="column q-gutter-y-xs col min-width-0">
          <div class="text-h6">{{ title }}</div>
          <div v-if="year" class="text-caption text-grey-6">{{ year }}</div>
          <div v-if="runtimeLabel" class="text-caption text-grey-6">{{ runtimeLabel }}</div>
        </div>
      </q-card-section>
      <q-separator />
      <q-card-section class="mv-detail-card__body column no-wrap">
        <div class="text-body2">{{ overviewText }}</div>
        <template v-if="castRows.length">
          <q-separator spaced />
          <div class="text-subtitle2 text-weight-medium q-mb-xs">Cast</div>
          <div class="column no-wrap q-gutter-y-sm">
            <div v-for="row in displayedCast" :key="row.key" class="row no-wrap mv-cast-row">
              <div class="mv-cast-thumb">
                <img
                  v-if="row.headshotSrc"
                  class="mv-cast-thumb__img"
                  :src="row.headshotSrc"
                  :alt="row.name"
                  loading="lazy"
                  decoding="async"
                />
                <div v-else class="mv-cast-thumb__placeholder column flex-center">
                  <q-icon name="person" size="20px" color="grey-6" />
                </div>
              </div>
              <div class="column justify-center min-width-0 col q-pl-sm">
                <div class="text-body2 text-weight-medium ellipsis">{{ row.name }}</div>
                <div class="text-body2 text-grey-7 ellipsis">{{ row.character }}</div>
              </div>
            </div>
            <q-btn
              v-if="hasTruncatedCast && !castExpanded"
              flat
              dense
              no-caps
              padding="xs sm xs none"
              align="left"
              class="self-start mv-cast-toggle"
              label="more"
              icon-right="expand_more"
              color="primary"
              @click="castExpanded = true"
            />
            <q-btn
              v-if="hasTruncatedCast && castExpanded"
              flat
              dense
              no-caps
              padding="xs sm xs none"
              align="left"
              class="self-start mv-cast-toggle"
              label="less"
              icon-right="expand_less"
              color="primary"
              @click="castExpanded = false"
            />
          </div>
        </template>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right" class="mv-detail-card__footer q-px-md q-pb-md q-pt-sm">
        <q-btn
          unelevated
          no-caps
          color="primary"
          label="Close"
          padding="sm lg"
          class="mv-detail-close text-weight-medium"
          v-close-popup
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { getMovieDetails, isTmdbConfigured, posterUrl, profileUrl } from '../tmdb.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** @type {import('vue').PropType<import('../types.js').BallotMovie | import('../types.js').MoviePick | null>} */
  movie: { type: Object, default: null },
})

defineEmits(['update:modelValue'])

const fetched = ref(/** @type {Awaited<ReturnType<typeof getMovieDetails>>} */ (null))
const posterSrc = ref(/** @type {string | null} */ (null))

const title = computed(() => props.movie?.title ?? '')
const year = computed(() => {
  const d = fetched.value?.release_date ?? props.movie?.releaseDate
  if (!d || typeof d !== 'string') return ''
  return d.slice(0, 4)
})
const overviewText = computed(
  () => fetched.value?.overview ?? props.movie?.overview ?? 'No description.',
)
const runtimeLabel = computed(() => {
  const r = fetched.value?.runtime ?? props.movie?.runtime
  if (typeof r !== 'number' || r <= 0) return ''
  return `${r} min`
})

const CAST_PREVIEW = 5

const castExpanded = ref(false)

const castRows = computed(() => {
  const credits = fetched.value?.credits
  const raw = credits && typeof credits === 'object' && 'cast' in credits ? credits.cast : null
  if (!Array.isArray(raw)) return []
  const rows = []
  for (const c of raw) {
    if (!c || typeof c !== 'object') continue
    const name = 'name' in c && c.name != null ? String(c.name).trim() : ''
    if (!name) continue
    const character =
      'character' in c && c.character != null && String(c.character).trim()
        ? String(c.character).trim()
        : '—'
    const creditId = 'credit_id' in c && c.credit_id != null ? String(c.credit_id) : ''
    const order = 'order' in c && typeof c.order === 'number' ? c.order : 9999
    const pp = 'profile_path' in c && c.profile_path != null ? String(c.profile_path).trim() : ''
    const headshotSrc = pp ? profileUrl(pp, 'w92') : null
    rows.push({
      key: creditId ? `${creditId}-${order}` : `${order}-${name}`,
      name,
      character,
      order,
      headshotSrc,
    })
  }
  rows.sort((a, b) => a.order - b.order)
  return rows.map(({ key, name, character, headshotSrc }) => ({ key, name, character, headshotSrc }))
})

const hasTruncatedCast = computed(() => castRows.value.length > CAST_PREVIEW)

const displayedCast = computed(() => {
  const all = castRows.value
  if (castExpanded.value || all.length <= CAST_PREVIEW) return all
  return all.slice(0, CAST_PREVIEW)
})

watch(
  () => [props.modelValue, props.movie?.tmdbId],
  async ([open, tmdbId], _, onCleanup) => {
    if (!open || tmdbId == null) {
      fetched.value = null
      posterSrc.value = null
      castExpanded.value = false
      return
    }
    castExpanded.value = false
    const m = props.movie
    if (m?.posterPath) {
      posterSrc.value = posterUrl(m.posterPath, 'w342')
    } else {
      posterSrc.value = null
    }
    if (!isTmdbConfigured()) return
    const ac = new AbortController()
    onCleanup(() => ac.abort())
    try {
      const detail = await getMovieDetails(Number(tmdbId), { signal: ac.signal })
      fetched.value = detail
      if (detail?.poster_path) {
        posterSrc.value = posterUrl(detail.poster_path, 'w342')
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      throw e
    }
  },
  { immediate: true },
)
</script>

<style scoped lang="scss">
.mv-detail-card {
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  width: min(420px, 100vw - 24px);
  /* Fixed height so flex:1 on the body has space; max-height alone lets the card shrink and crushes the middle. */
  height: min(88vh, 720px);
  box-sizing: border-box;
}

.mv-detail-card__header {
  flex: 0 0 auto;
}

.mv-detail-card__body {
  flex: 1 1 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.mv-detail-card__footer {
  flex: 0 0 auto;
}

.mv-cast-row {
  align-items: stretch;
}

.mv-cast-thumb {
  flex: 0 0 40px;
  width: 40px;
  align-self: stretch;
  min-height: 44px;
  border-radius: 4px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.06);
}

.body--dark .mv-cast-thumb {
  background: rgba(255, 255, 255, 0.08);
}

.mv-cast-thumb__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mv-cast-thumb__placeholder {
  min-height: 44px;
  height: 100%;
}

.mv-cast-toggle {
  font-weight: 500;
  opacity: 0.92;
  transition: opacity 0.15s ease;

  :deep(.q-btn__content) {
    gap: 4px;
    border-bottom: 1px solid currentColor;
    padding-bottom: 2px;
  }

  &:hover {
    opacity: 1;
  }

  &:focus-visible {
    opacity: 1;
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }
}

.mv-detail-close {
  min-height: 44px;
}
</style>
