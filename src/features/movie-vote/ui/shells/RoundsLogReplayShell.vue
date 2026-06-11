<template>
  <div v-if="visible" class="mv-results-replay column col" style="min-height: 0">
    <div class="text-subtitle2 text-weight-medium text-grey-5 q-mb-sm">
      {{ currentStep?.heading }}
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
              {{ row.votes }} {{ currentStep?.scoreUnit
              }}{{ currentStep?.showPoolSuffix ? ` of ${currentStep.poolLabel}` : '' }}
            </div>
          </div>
        </div>
        <div class="mv-results-bar-track rounded-borders overflow-hidden">
          <div class="mv-results-bar-fill" :style="{ width: `${barPct(row.id)}%` }" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { posterUrl } from '../../tmdb.js'
import { buildBallotMovieIndex } from '../ballotMovieIndex.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  /** @type {import('vue').PropType<ReturnType<import('../createRoundsLogReplayViewModel.js').createRoundsLogReplayViewModel>>} */
  replayModel: { type: Object, required: true },
  /** @type {import('vue').PropType<import('../../types.js').BallotMovie[]>} */
  ballotMovies: { type: Array, default: () => [] },
})

const emit = defineEmits(['complete'])

const DISPLAY_MS = 2000
const EXIT_MS = 780
const BETWEEN_MS = 480
const INTRO_MS = 280
const BAR_TWEEN_MS = 580
const BAR_SAME_TARGET_KICK = 0.13

const ballotIndex = computed(() => buildBallotMovieIndex(props.ballotMovies))
const steps = computed(() => props.replayModel.steps ?? [])

const roundIdx = ref(0)
/** @type {import('vue').Ref<string[]>} */
const exitingIds = ref([])
/** @type {import('vue').Ref<Record<string, number>>} */
const displayPct = ref({})

let runId = 0
let barAnimGen = 0
let barAnimRaf = 0

const currentStep = computed(() => steps.value[roundIdx.value] ?? null)

const sortedRows = computed(() => {
  const step = currentStep.value
  if (!step) return []
  return step.rows.map((row) => ({
    id: row.id,
    title: ballotIndex.value.get(row.id)?.title ?? row.id,
    thumb: row.posterPath ? posterUrl(row.posterPath, 'w92') : null,
    votes: row.votes,
    pct: row.barTargetPct,
  }))
})

function stopBarAnim() {
  barAnimGen += 1
  if (barAnimRaf) {
    cancelAnimationFrame(barAnimRaf)
    barAnimRaf = 0
  }
}

function animateBarsToTargets() {
  const step = currentStep.value
  if (!step?.rows?.length) return

  stopBarAnim()

  const targets = Object.fromEntries(step.rows.map((r) => [r.id, r.barTargetPct]))
  const activeIds = step.rows.map((r) => r.id)
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

function isExiting(id) {
  return exitingIds.value.includes(id)
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

async function runSequence(myRun) {
  const rs = steps.value
  roundIdx.value = 0
  exitingIds.value = []
  stopBarAnim()
  displayPct.value = {}

  if (!rs.length) {
    emit('complete')
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

  emit('complete')
}

watch(
  () => [props.visible, props.replayModel.replayKey],
  () => {
    if (!props.visible) {
      runId += 1
      stopBarAnim()
      return
    }
    runId += 1
    const my = runId
    void runSequence(my)
  },
  { immediate: true },
)

onUnmounted(() => {
  runId += 1
  stopBarAnim()
})
</script>

<style scoped lang="scss">
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
}
</style>
