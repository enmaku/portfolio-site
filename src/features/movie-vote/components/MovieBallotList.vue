<template>
  <div class="mv-ballot">
    <div class="q-px-md q-pb-xs text-caption text-grey-6">
      Drag to rank (top = 1st choice). Tap a row for details.
    </div>
    <div class="mv-ballot__inner q-pa-sm">
      <Draggable
        v-model="rankingModel"
        item-key="publicId"
        tag="div"
        class="mv-draggable"
        :animation="200"
        :delay="450"
        :delay-on-touch-only="true"
        :touch-start-threshold="8"
        direction="vertical"
        :disabled="myVoteSubmitted"
        ghost-class="mv-sortable-ghost"
        chosen-class="mv-sortable-chosen"
        drag-class="mv-sortable-drag"
        @contextmenu.prevent
      >
        <template #item="{ element }">
          <div
            class="mv-ballot-row row items-center no-wrap q-px-md q-py-sm q-mb-sm rounded-borders"
            @click="openDetail(element)"
          >
            <q-img
              v-if="thumbs[element.publicId]"
              :src="thumbs[element.publicId]"
              width="48px"
              height="72px"
              fit="cover"
              class="rounded-borders q-mr-md"
              style="flex-shrink: 0"
              spinner-color="primary"
              loading="lazy"
            />
            <q-icon v-else name="movie" size="lg" class="q-mr-sm" color="grey-5" />
            <div class="col min-width-0">
              <div class="text-body1 text-weight-medium ellipsis">{{ element.title }}</div>
              <div v-if="element.releaseDate" class="text-caption text-grey-6">
                {{ String(element.releaseDate).slice(0, 4) }}
              </div>
            </div>
          </div>
        </template>
      </Draggable>
    </div>

    <MovieDetailDialog v-model="detailOpen" :movie="detailAsPick" />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Draggable from 'vuedraggable'
import { useMovieVoteStore } from '../../../stores/movieVote.js'
import { posterUrl } from '../tmdb.js'
import MovieDetailDialog from './MovieDetailDialog.vue'

const store = useMovieVoteStore()
const { myRanking, ballotMovies, myVoteSubmitted } = storeToRefs(store)

const moviesById = computed(() => {
  const m = new Map()
  for (const x of ballotMovies.value) m.set(x.publicId, x)
  return m
})

const orderedMovies = computed(() => myRanking.value.map((id) => moviesById.value.get(id)).filter(Boolean))

const rankingModel = computed({
  get: () => orderedMovies.value,
  set: (next) => {
    if (!Array.isArray(next) || myVoteSubmitted.value) return
    store.setMyRanking(next.map((m) => m.publicId))
  },
})

const thumbs = ref(/** @type {Record<string, string>} */ ({}))

watch(
  ballotMovies,
  async (movies) => {
    const next = { ...thumbs.value }
    for (const m of movies) {
      if (m.posterPath && !next[m.publicId]) {
        next[m.publicId] = posterUrl(m.posterPath, 'w92') ?? ''
      }
    }
    thumbs.value = next
  },
  { deep: true, immediate: true },
)

const detailOpen = ref(false)
/** @type {import('vue').Ref<import('../types.js').BallotMovie | null>} */
const detailTarget = ref(null)

const detailAsPick = computed(() => {
  const b = detailTarget.value
  if (!b) return null
  return {
    localId: b.publicId,
    tmdbId: b.tmdbId,
    title: b.title,
    posterPath: b.posterPath,
    overview: b.overview,
    releaseDate: b.releaseDate,
  }
})

/** @param {import('../types.js').BallotMovie} m */
function openDetail(m) {
  detailTarget.value = m
  detailOpen.value = true
}
</script>

<style scoped lang="scss">
.mv-ballot {
  min-height: 0;
}

.mv-ballot__inner {
  min-height: 0;
}

.mv-ballot-row {
  background: rgba(128, 128, 128, 0.12);
  min-height: 56px;
}

.body--light .mv-ballot-row {
  background: rgba(0, 0, 0, 0.04);
}

.mv-sortable-ghost {
  opacity: 0.45;
}
</style>
