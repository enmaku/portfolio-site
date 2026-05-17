<template>
  <div class="mv-results q-pa-md column no-wrap min-width-0">
    <div v-if="!irvResult" class="text-body2 text-grey-6">No results.</div>

    <template v-else>
      <!-- Graphical IRV replay -->
      <div v-if="showReplay" class="mv-results-replay column col" style="min-height: 0">
        <div class="text-subtitle2 text-weight-medium text-grey-5 q-mb-sm">
          {{ replayHeading }}
        </div>
        <div class="mv-results-replay__list column q-gutter-sm col scroll">
          <div
            v-for="row in sortedRows"
            :key="row.id"
            class="mv-results-row rounded-borders q-pa-sm"
            :class="{ 'mv-results-row--leaving': isExiting(row.id) }"
          >
            <div class="row no-wrap items-center q-gutter-sm q-mb-xs">
              <q-img
                v-if="row.thumb"
                :src="row.thumb"
                width="36px"
                height="54px"
                fit="cover"
                class="rounded-borders"
                style="flex-shrink: 0"
                spinner-color="primary"
              />
              <div v-else class="mv-results-row__ph rounded-borders row flex-center" style="flex-shrink: 0">
                <q-icon name="movie" size="sm" color="grey-6" />
              </div>
              <div class="col min-width-0">
                <div class="text-body1 text-weight-medium ellipsis">{{ row.title }}</div>
                <div class="text-caption text-grey-6">
                  {{ row.votes }} {{ scoreUnit }}{{ showPoolSuffix ? ` of ${roundPoolLabel}` : '' }}
                </div>
              </div>
            </div>
            <div class="mv-results-bar-track rounded-borders overflow-hidden">
              <div class="mv-results-bar-fill" :style="{ width: `${barPct(row.id)}%` }" />
            </div>
          </div>
        </div>
      </div>


      <q-card
        v-if="showFinal"
        flat
        bordered
        class="mv-results-final q-mt-md full-width"
        :class="irvResult.winnerId ? 'q-pa-md' : 'q-pa-sm'"
      >
        <template v-if="irvResult.winnerId">
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
            <div class="text-h5 text-weight-bold text-primary">{{ titleFor(irvResult.winnerId) }}</div>
          </div>
        </template>
        <template v-else-if="irvResult.tieWinnerIds?.length">
          <div class="text-h6 q-mb-md text-center">It’s a tie</div>
          <div class="column q-gutter-sm min-width-0">
            <div
              v-for="m in tiedMoviesOrdered"
              :key="m.publicId"
              class="mv-results-tie-row row items-center no-wrap q-px-sm q-py-xs rounded-borders cursor-pointer"
              @click="openTieDetail(m)"
            >
              <q-img
                v-if="thumbFor(m.publicId)"
                :src="thumbFor(m.publicId)"
                width="40px"
                height="60px"
                fit="cover"
                class="mv-results-tie-thumb rounded-borders q-mr-sm"
                style="flex-shrink: 0"
                spinner-color="primary"
                loading="lazy"
              />
              <q-icon
                v-else
                name="movie"
                size="md"
                class="q-mr-sm"
                style="flex-shrink: 0"
                color="grey-5"
              />
              <div class="col min-width-0">
                <div class="text-body1 text-weight-medium ellipsis">{{ m.title }}</div>
                <div v-if="tieMetaLine(m)" class="text-caption text-grey-6 ellipsis">
                  {{ tieMetaLine(m) }}
                </div>
              </div>
            </div>
          </div>
        </template>
      </q-card>

      <div
        v-if="showFinal && isCondorcetResult && pairwiseMatrix"
        class="mv-pairwise q-mt-md full-width min-width-0"
      >
        <div class="text-subtitle2 text-weight-medium text-grey-5 q-mb-xs">Pairwise matchups</div>

        <div v-if="pairwiseUseCompactGrid" class="mv-pairwise__fluid column q-gutter-xs">
          <div class="row q-col-gutter-xs items-center">
            <div class="col-auto mv-pairwise__axis-slot" aria-hidden="true" />
            <div
              v-for="colId in matrixCandidateIds"
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
            v-for="rowId in matrixCandidateIds"
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
              v-for="colId in matrixCandidateIds"
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
              v-for="colId in matrixCandidateIds"
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
            <template v-for="rowId in matrixCandidateIds" :key="`row-${rowId}`">
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
                v-for="colId in matrixCandidateIds"
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

      <MovieDetailDialog v-model="tieDetailOpen" :movie="tieDetailAsPick" />

      <q-btn
        v-if="allowReset && showFinal"
        outline
        color="primary"
        no-caps
        class="full-width q-mt-md"
        label="Start over"
        @click="$emit('reset')"
      />
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import {
  pairwiseCellAriaLabel,
  pairwiseCellCssClass,
  pairwiseCellGlyph,
} from '../pairwiseMatrixDisplay.js'
import {
  replayHeadingForResult,
  scoreUnitForResult,
  shouldAnimateRoundsReplay,
  showVotePoolSuffix,
  targetPctsForScoreboardRound,
  totalRoundsForReplay,
} from '../resultsScoreboard.js'
import { formatMovieMetaLine, posterUrl } from '../tmdb.js'
import MovieDetailDialog from './MovieDetailDialog.vue'

const props = defineProps({
  /** @type {import('vue').PropType<import('../irv.js').IrvResult | null>} */
  irvResult: { type: Object, default: null },
  /** @type {import('vue').PropType<import('../types.js').BallotMovie[]>} */
  ballotMovies: { type: Array, default: () => [] },
  allowReset: { type: Boolean, default: true },
})

defineEmits(['reset'])

/** Time to read current vote totals before any elimination animation */
const DISPLAY_MS = 2000
/** Eliminated row(s) slide out */
const EXIT_MS = 780
/** Pause between rounds after elimination */
const BETWEEN_MS = 480
/** Brief beat before first round (builds suspense) */
const INTRO_MS = 280
/** Bar fill tween: first paint + vote redistribution */
const BAR_TWEEN_MS = 580
/** When targets match current bar %, nudge from slightly lower so each step still animates */
const BAR_SAME_TARGET_KICK = 0.13

const idToMovie = computed(() => {
  const m = new Map()
  for (const x of props.ballotMovies) {
    if (x && typeof x.publicId === 'string') m.set(x.publicId, x)
  }
  return m
})

function titleFor(id) {
  return idToMovie.value.get(id)?.title ?? id
}

function thumbFor(id) {
  const p = idToMovie.value.get(id)?.posterPath
  return p ? posterUrl(p, 'w92') : null
}

const isCondorcetResult = computed(() => props.irvResult?.votingMethod === 'condorcet')
const pairwiseMatrix = computed(() => props.irvResult?.pairwiseMatrix ?? null)

const matrixCandidateIds = computed(() => {
  const ids = pairwiseMatrix.value?.candidateIds
  if (Array.isArray(ids) && ids.length) return ids
  return props.ballotMovies.map((m) => m.publicId).filter(Boolean)
})

const PAIRWISE_COMPACT_MAX = 6

const pairwiseUseCompactGrid = computed(
  () => matrixCandidateIds.value.length <= PAIRWISE_COMPACT_MAX,
)

const pairwiseGridStyle = computed(() => {
  const n = matrixCandidateIds.value.length
  return {
    gridTemplateColumns: `36px repeat(${n}, 36px)`,
    gridTemplateRows: `44px repeat(${n}, 40px)`,
  }
})

/**
 * @param {string} rowId
 * @param {string} colId
 */
function pairwiseGlyph(rowId, colId) {
  return pairwiseCellGlyph(pairwiseMatrix.value?.cells[rowId]?.[colId])
}

/**
 * @param {string} rowId
 * @param {string} colId
 */
function pairwiseCellClass(rowId, colId) {
  return pairwiseCellCssClass(rowId, colId, pairwiseMatrix.value?.cells)
}

/**
 * @param {string} rowId
 * @param {string} colId
 */
function pairwiseCellAria(rowId, colId) {
  if (rowId === colId) return undefined
  return pairwiseCellAriaLabel(
    titleFor(rowId),
    titleFor(colId),
    pairwiseMatrix.value?.cells[rowId]?.[colId],
  )
}

const rounds = computed(() => props.irvResult?.rounds ?? [])
const totalRounds = computed(() => totalRoundsForReplay(rounds.value))
const scoreUnit = computed(() => scoreUnitForResult(props.irvResult))
const showPoolSuffix = computed(() => showVotePoolSuffix(props.irvResult))
const replayHeading = computed(() =>
  replayHeadingForResult(props.irvResult, roundIdx.value, totalRounds.value),
)

const roundIdx = ref(0)
/** @type {import('vue').Ref<string[]>} */
const exitingIds = ref([])
const showReplay = ref(true)
const showFinal = ref(false)

/** @type {import('vue').Ref<Record<string, number>>} */
const displayPct = ref({})

let runId = 0
let barAnimGen = 0
let barAnimRaf = 0

function stopBarAnim() {
  barAnimGen += 1
  if (barAnimRaf) {
    cancelAnimationFrame(barAnimRaf)
    barAnimRaf = 0
  }
}

function targetPctsForRound(r) {
  return targetPctsForScoreboardRound(r, props.irvResult?.votingMethod)
}

function animateBarsToTargets() {
  const r = currentRound.value
  if (!r?.activeIds?.length) return

  stopBarAnim()

  const targets = targetPctsForRound(r)
  const activeIds = r.activeIds
  /** @type {Record<string, number>} */
  const tweenFrom = {}
  for (const id of activeIds) {
    tweenFrom[id] = displayPct.value[id] ?? 0
  }
  let allSame = true
  for (const id of activeIds) {
    if ((tweenFrom[id] ?? 0) !== (targets[id] ?? 0)) {
      allSame = false
      break
    }
  }
  if (allSame) {
    for (const id of activeIds) {
      const t = targets[id] ?? 0
      tweenFrom[id] = t > 0 ? Math.max(0, Math.round(t * (1 - BAR_SAME_TARGET_KICK))) : 0
    }
    displayPct.value = { ...tweenFrom }
  }

  const gen = barAnimGen
  const start = performance.now()

  function tick(now) {
    if (gen !== barAnimGen) return
    const t = Math.min(1, (now - start) / BAR_TWEEN_MS)
    const e = 1 - (1 - t) ** 3
    /** @type {Record<string, number>} */
    const out = {}
    for (const id of activeIds) {
      const a = tweenFrom[id] ?? 0
      const b = targets[id] ?? 0
      out[id] = Math.round(a + (b - a) * e)
    }
    displayPct.value = out
    if (t < 1) {
      barAnimRaf = requestAnimationFrame(tick)
    } else {
      displayPct.value = { ...targets }
      barAnimRaf = 0
    }
  }
  barAnimRaf = requestAnimationFrame(tick)
}

function barPct(id) {
  return displayPct.value[id] ?? 0
}

const currentRound = computed(() => rounds.value[roundIdx.value] ?? null)

const roundPoolLabel = computed(() => {
  const r = currentRound.value
  if (!r) return '—'
  const n = r.ballotsWithVote
  return typeof n === 'number' && n > 0 ? String(n) : '—'
})

const sortedRows = computed(() => {
  const r = currentRound.value
  if (!r || !Array.isArray(r.activeIds)) return []
  const targets = targetPctsForRound(r)
  const rows = r.activeIds.map((id) => {
    const votes = r.firstPreferenceCounts[id] ?? 0
    return {
      id,
      title: titleFor(id),
      thumb: thumbFor(id),
      votes,
      pct: targets[id] ?? 0,
    }
  })
  rows.sort((a, b) => {
    if (a.votes !== b.votes) return b.votes - a.votes
    return a.title.localeCompare(b.title)
  })
  return rows
})

const winnerThumb = computed(() => {
  const id = props.irvResult?.winnerId
  if (!id) return null
  return thumbFor(id)
})

/** @type {import('vue').Ref<import('../types.js').BallotMovie | null>} */
const tieDetailTarget = ref(null)
const tieDetailOpen = ref(false)

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

/** @param {import('../types.js').BallotMovie} m */
function tieMetaLine(m) {
  return formatMovieMetaLine(m.releaseDate, m.runtime)
}

/** @param {import('../types.js').BallotMovie} m */
function openTieDetail(m) {
  tieDetailTarget.value = m
  tieDetailOpen.value = true
}

const tiedMoviesOrdered = computed(() => {
  const ids = props.irvResult?.tieWinnerIds
  if (!Array.isArray(ids) || !ids.length) return []
  const map = idToMovie.value
  return /** @type {import('../types.js').BallotMovie[]} */ (
    ids.map((id) => map.get(id)).filter(Boolean)
  )
})

function isExiting(id) {
  return exitingIds.value.includes(id)
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

async function runSequence(myRun) {
  const rs = rounds.value
  showReplay.value = true
  showFinal.value = false
  roundIdx.value = 0
  exitingIds.value = []
  stopBarAnim()
  displayPct.value = {}

  if (!rs.length) {
    showReplay.value = false
    showFinal.value = true
    return
  }

  await sleep(INTRO_MS)
  if (myRun !== runId) return

  let lastBarRoundIdx = -1

  for (let i = 0; i < rs.length; i++) {
    roundIdx.value = i
    exitingIds.value = []
    await nextTick()
    if (myRun !== runId) return
    if (lastBarRoundIdx !== roundIdx.value) {
      animateBarsToTargets()
      lastBarRoundIdx = roundIdx.value
    }
    await sleep(DISPLAY_MS)
    if (myRun !== runId) return

    const r = rs[i]
    const elim = Array.isArray(r.eliminatedIds) ? r.eliminatedIds.filter(Boolean) : []
    if (elim.length > 0) {
      exitingIds.value = [...elim]
      await sleep(EXIT_MS)
      if (myRun !== runId) return
      exitingIds.value = []
      /* Move to next round's counts immediately so eliminated rows do not pop back. */
      if (i + 1 < rs.length) {
        roundIdx.value = i + 1
      }
      await nextTick()
      if (myRun !== runId) return
      animateBarsToTargets()
      lastBarRoundIdx = roundIdx.value
      await sleep(BETWEEN_MS)
      if (myRun !== runId) return
    }
  }

  showReplay.value = false
  showFinal.value = true
}

watch(
  () => props.irvResult,
  (r) => {
    runId += 1
    const my = runId
    if (shouldAnimateRoundsReplay(r)) {
      void runSequence(my)
    } else {
      stopBarAnim()
      displayPct.value = {}
      showReplay.value = false
      showFinal.value = Boolean(r)
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  runId += 1
  stopBarAnim()
})
</script>

<style scoped lang="scss">
.mv-results {
  min-height: 0;
  min-width: 0;
  max-width: 100%;
  width: 100%;
  overflow-x: hidden;
}

/* Size to content height so mv-page__scroll handles vertical overflow, not nested panes */
.mv-results.col {
  flex: 1 1 auto;
  min-height: auto;
  overflow: visible;
}

.mv-results-final {
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.mv-results-replay {
  min-height: 0;
}

.mv-results-replay__list {
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.mv-results-row {
  max-height: 240px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition:
    transform 0.72s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.68s ease,
    max-height 0.55s ease 0.1s,
    margin 0.32s ease 0.12s,
    padding 0.32s ease 0.12s,
    border-color 0.22s ease;
}

.body--light .mv-results-row {
  background: rgba(0, 0, 0, 0.03);
  border-color: rgba(0, 0, 0, 0.08);
}

.mv-results-row--leaving {
  transform: translateX(-108%);
  opacity: 0;
  max-height: 0 !important;
  margin-top: 0 !important;
  margin-bottom: 0 !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  border-color: transparent;
  pointer-events: none;
}

.mv-results-row__ph {
  width: 36px;
  height: 54px;
  background: rgba(255, 255, 255, 0.06);
}

.body--light .mv-results-row__ph {
  background: rgba(0, 0, 0, 0.06);
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

.mv-results-bar-track {
  height: 10px;
  background: rgba(255, 255, 255, 0.1);
}

.body--light .mv-results-bar-track {
  background: rgba(0, 0, 0, 0.08);
}

.mv-results-bar-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--q-primary);
  /* width driven by rAF tween in displayPct */
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
