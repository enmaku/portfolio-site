<template>
  <div v-if="model.mount && model.cells" class="mv-pairwise q-mt-md full-width min-width-0">
    <div
      v-if="copelandRows.length"
      class="mv-copeland-scores column q-gutter-xs q-mb-sm"
    >
      <div class="text-subtitle2 text-weight-medium text-grey-5">Copeland scores</div>
      <div
        v-for="row in copelandRows"
        :key="row.id"
        class="mv-copeland-scores__row row items-center no-wrap q-px-sm q-py-xs rounded-borders"
      >
        <q-img
          v-if="thumbFor(row.id)"
          :src="thumbFor(row.id)"
          width="28px"
          height="42px"
          fit="cover"
          class="rounded-borders q-mr-sm"
          style="flex-shrink: 0"
          spinner-color="primary"
          loading="lazy"
          :alt="titleFor(row.id)"
        />
        <q-icon v-else name="movie" size="sm" class="q-mr-sm" color="grey-6" style="flex-shrink: 0" />
        <div class="col min-width-0 text-body2 ellipsis">{{ titleFor(row.id) }}</div>
        <div class="text-body2 text-weight-medium" :class="row.scoreClass">{{ row.scoreLabel }}</div>
      </div>
    </div>
    <div class="text-subtitle2 text-weight-medium text-grey-5 q-mb-xs">Pairwise matchups</div>

    <div v-if="model.useCompactGrid" class="mv-pairwise__fluid column q-gutter-xs">
      <div class="row q-col-gutter-xs items-center">
        <div class="col-auto mv-pairwise__axis-slot" aria-hidden="true" />
        <div
          v-for="colId in candidateIds"
          :key="`col-${colId}`"
          class="col column items-center justify-center mv-pairwise__axis-slot"
          :aria-label="titleFor(colId)"
        >
          <q-img
            v-if="thumbFor(colId)"
            :src="thumbFor(colId)"
            width="28px"
            height="42px"
            fit="cover"
            class="mv-pairwise__thumb rounded-borders"
            style="flex-shrink: 0"
            spinner-color="primary"
            loading="lazy"
            :alt="titleFor(colId)"
          />
          <q-icon v-else name="movie" size="sm" color="grey-6" />
        </div>
      </div>
      <div
        v-for="rowId in candidateIds"
        :key="`row-${rowId}`"
        class="row q-col-gutter-xs items-stretch"
      >
        <div
          class="col-auto column items-center justify-center mv-pairwise__axis-slot"
          :aria-label="titleFor(rowId)"
        >
          <q-img
            v-if="thumbFor(rowId)"
            :src="thumbFor(rowId)"
            width="28px"
            height="42px"
            fit="cover"
            class="mv-pairwise__thumb rounded-borders"
            style="flex-shrink: 0"
            spinner-color="primary"
            loading="lazy"
            :alt="titleFor(rowId)"
          />
          <q-icon v-else name="movie" size="sm" color="grey-6" />
        </div>
        <div
          v-for="colId in candidateIds"
          :key="`cell-${rowId}-${colId}`"
          class="col mv-pairwise__cell mv-pairwise__cell--fluid row flex-center"
          :class="pairwiseCellClass(rowId, colId)"
          :aria-label="pairwiseCellAria(rowId, colId)"
        >
          <span v-if="rowId !== colId" class="mv-pairwise__glyph" aria-hidden="true">{{
            pairwiseGlyph(rowId, colId)
          }}</span>
        </div>
      </div>
    </div>

    <div v-else class="mv-pairwise__scroll">
      <div class="mv-pairwise__grid" :style="pairwiseGridStyle">
        <div class="mv-pairwise__corner" aria-hidden="true" />
        <div
          v-for="colId in candidateIds"
          :key="`col-${colId}`"
          class="mv-pairwise__axis mv-pairwise__axis--col column items-center"
          :aria-label="titleFor(colId)"
        >
          <q-img
            v-if="thumbFor(colId)"
            :src="thumbFor(colId)"
            width="28px"
            height="42px"
            fit="cover"
            class="rounded-borders"
            spinner-color="primary"
            loading="lazy"
            :alt="titleFor(colId)"
          />
          <q-icon v-else name="movie" size="xs" color="grey-6" />
        </div>
        <template v-for="rowId in candidateIds" :key="`row-${rowId}`">
          <div
            class="mv-pairwise__axis mv-pairwise__axis--row row items-center flex-center"
            :aria-label="titleFor(rowId)"
          >
            <q-img
              v-if="thumbFor(rowId)"
              :src="thumbFor(rowId)"
              width="28px"
              height="42px"
              fit="cover"
              class="rounded-borders"
              spinner-color="primary"
              loading="lazy"
              :alt="titleFor(rowId)"
            />
            <q-icon v-else name="movie" size="xs" color="grey-6" />
          </div>
          <div
            v-for="colId in candidateIds"
            :key="`cell-${rowId}-${colId}`"
            class="mv-pairwise__cell row flex-center"
            :class="pairwiseCellClass(rowId, colId)"
            :aria-label="pairwiseCellAria(rowId, colId)"
          >
            <span v-if="rowId !== colId" class="mv-pairwise__glyph" aria-hidden="true">{{
              pairwiseGlyph(rowId, colId)
            }}</span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  pairwiseCellAriaLabel,
  pairwiseCellCssClass,
  pairwiseCellGlyph,
} from '../../pairwiseMatrixDisplay.js'
import { posterUrl } from '../../tmdb.js'
import { buildBallotMovieIndex } from '../ballotMovieIndex.js'

const props = defineProps({
  /** @type {import('vue').PropType<ReturnType<import('../createPairwiseMatrixViewModel.js').createPairwiseMatrixViewModel>>} */
  model: { type: Object, required: true },
  /** @type {import('vue').PropType<import('../../types.js').BallotMovie[]>} */
  ballotMovies: { type: Array, default: () => [] },
})

const ballotIndex = computed(() => buildBallotMovieIndex(props.ballotMovies))
const candidateIds = computed(() => props.model.candidateIds ?? [])

const copelandRows = computed(() => {
  const rows = props.model.copelandScoreRows ?? []
  return rows.map((row) => ({
    id: row.id,
    scoreLabel: row.score > 0 ? `+${row.score}` : String(row.score),
    scoreClass: row.isLeader ? 'text-primary' : 'text-grey-5',
  }))
})

const pairwiseGridStyle = computed(() => {
  const n = candidateIds.value.length
  return {
    gridTemplateColumns: `36px repeat(${n}, 36px)`,
    gridTemplateRows: `44px repeat(${n}, 40px)`,
  }
})

function titleFor(id) {
  return ballotIndex.value.get(id)?.title ?? id
}

function thumbFor(id) {
  const p = ballotIndex.value.get(id)?.posterPath
  return p ? posterUrl(p, 'w92') : null
}

function pairwiseGlyph(rowId, colId) {
  return pairwiseCellGlyph(props.model.cells?.[rowId]?.[colId])
}

function pairwiseCellClass(rowId, colId) {
  return pairwiseCellCssClass(rowId, colId, props.model.cells)
}

function pairwiseCellAria(rowId, colId) {
  if (rowId === colId) return undefined
  return pairwiseCellAriaLabel(
    titleFor(rowId),
    titleFor(colId),
    props.model.cells?.[rowId]?.[colId],
  )
}
</script>

<style scoped lang="scss">
.mv-copeland-scores__row {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.body--light .mv-copeland-scores__row {
  background: rgba(0, 0, 0, 0.03);
  border-color: rgba(0, 0, 0, 0.06);
}

.mv-pairwise__fluid {
  width: 100%;
}

.mv-pairwise__axis-slot.col-auto {
  flex: 0 0 2.25rem;
  max-width: 2.25rem;
}

.mv-pairwise__cell--fluid {
  width: auto;
  height: auto;
  min-height: 2.25rem;
  aspect-ratio: 1;
}

.mv-pairwise {
  flex-shrink: 0;
}

.mv-pairwise__scroll {
  overflow-x: auto;
  overflow-y: hidden;
  max-width: 100%;
  -webkit-overflow-scrolling: touch;
}

.mv-pairwise__grid {
  display: grid;
  gap: 4px;
  width: max-content;
}

.mv-pairwise__corner {
  min-height: 44px;
}

.mv-pairwise__cell {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.04);
}

.body--light .mv-pairwise__cell {
  background: rgba(0, 0, 0, 0.04);
}

.mv-pairwise__cell--diag {
  background: transparent;
}

.mv-pairwise__glyph {
  font-size: 15px;
  font-weight: 700;
  line-height: 1;
}

.mv-pairwise__cell--win .mv-pairwise__glyph {
  color: #66bb6a;
}

.mv-pairwise__cell--loss .mv-pairwise__glyph {
  color: #ef5350;
}

.mv-pairwise__cell--tie .mv-pairwise__glyph {
  color: #ffca28;
}
</style>
