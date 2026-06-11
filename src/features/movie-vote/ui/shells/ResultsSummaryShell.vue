<template>
  <q-card
    v-if="model.variant !== 'empty'"
    flat
    bordered
    class="mv-results-final q-mt-md full-width"
    :class="model.variant === 'winner' ? 'q-pa-md' : 'q-pa-sm'"
  >
    <template v-if="model.variant === 'winner'">
      <div class="text-h6 q-mb-md text-center">Winner</div>
      <div class="column items-center q-gutter-sm">
        <q-img
          v-if="winnerThumb"
          :src="winnerThumb"
          width="96px"
          height="144px"
          fit="cover"
          class="rounded-borders"
          spinner-color="primary"
        />
        <div class="text-h5 text-weight-bold text-primary">{{ winnerTitle }}</div>
      </div>
    </template>
    <template v-else-if="model.variant === 'declaredTie'">
      <div class="text-h6 q-mb-md text-center">It’s a tie</div>
      <div class="column q-gutter-sm min-width-0">
        <div
          v-for="m in tieMovies"
          :key="m.publicId"
          class="mv-results-tie-row row items-center no-wrap q-px-sm q-py-xs rounded-borders cursor-pointer"
          @click="openTieDetail(m)"
        >
          <q-img
            v-if="m.thumb"
            :src="m.thumb"
            width="40px"
            height="60px"
            fit="cover"
            class="rounded-borders mv-results-tie-thumb q-mr-sm"
            style="flex-shrink: 0"
            spinner-color="primary"
          />
          <q-icon v-else name="movie" size="sm" class="q-mr-sm" color="grey-6" style="flex-shrink: 0" />
          <div class="col min-width-0">
            <div class="text-body1 text-weight-medium ellipsis">{{ m.title }}</div>
            <div v-if="m.metaLine" class="text-caption text-grey-6 ellipsis">
              {{ m.metaLine }}
            </div>
          </div>
        </div>
      </div>
    </template>
  </q-card>

  <MovieDetailDialog v-model="tieDetailOpen" :movie="tieDetailAsPick" />
</template>

<script setup>
import { computed, ref } from 'vue'
import MovieDetailDialog from '../../components/MovieDetailDialog.vue'
import { formatMovieMetaLine, posterUrl } from '../../tmdb.js'
import { buildBallotMovieIndex } from '../ballotMovieIndex.js'

const props = defineProps({
  /** @type {import('vue').PropType<ReturnType<import('../createResultsSummaryViewModel.js').createResultsSummaryViewModel>>} */
  model: { type: Object, required: true },
  /** @type {import('vue').PropType<import('../../types.js').BallotMovie[]>} */
  ballotMovies: { type: Array, default: () => [] },
})

const ballotIndex = computed(() => buildBallotMovieIndex(props.ballotMovies))

const winnerTitle = computed(() => {
  if (props.model.variant !== 'winner' || !props.model.winnerId) return ''
  return ballotIndex.value.get(props.model.winnerId)?.title ?? props.model.winnerId
})

const winnerThumb = computed(() => {
  const path = props.model.winnerPosterPath
  return path ? posterUrl(path, 'w185') : null
})

const tieMovies = computed(() => {
  if (props.model.variant !== 'declaredTie' || !props.model.tieMovies) return []
  return props.model.tieMovies.map((row) => {
    const movie = ballotIndex.value.get(row.publicId)
    return {
      publicId: row.publicId,
      title: movie?.title ?? row.publicId,
      thumb: row.posterPath ? posterUrl(row.posterPath, 'w92') : null,
      metaLine: movie ? formatMovieMetaLine(movie.releaseDate, movie.runtime) : '',
      ballotMovie: movie ?? null,
    }
  })
})

const tieDetailOpen = ref(false)
/** @type {import('vue').Ref<import('../../types.js').BallotMovie | null>} */
const tieDetailTarget = ref(null)

const tieDetailAsPick = computed(() => {
  const b = tieDetailTarget.value
  if (!b) return null
  return {
    localId: b.publicId,
    tmdbId: b.tmdbId,
    title: b.title,
    posterPath: b.posterPath,
    overview: b.overview,
    releaseDate: b.releaseDate,
    runtime: b.runtime,
  }
})

/** @param {{ ballotMovie: import('../../types.js').BallotMovie | null }} m */
function openTieDetail(m) {
  if (!m.ballotMovie) return
  tieDetailTarget.value = m.ballotMovie
  tieDetailOpen.value = true
}
</script>

<style scoped lang="scss">
.mv-results-final {
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.mv-results-tie-row {
  background: rgba(128, 128, 128, 0.12);
  min-height: 48px;
  min-width: 0;
  max-width: 100%;
  width: 100%;
  box-sizing: border-box;
}

.mv-results-tie-thumb {
  width: 40px !important;
  max-width: 40px;
}

.body--light .mv-results-tie-row {
  background: rgba(0, 0, 0, 0.04);
}
</style>
