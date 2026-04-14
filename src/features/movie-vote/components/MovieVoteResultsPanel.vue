<template>
  <div class="mv-results q-pa-md column no-wrap">
    <div v-if="!irvResult" class="text-body2 text-grey-6">No results.</div>

    <template v-else>
      <!-- Graphical IRV replay -->
      <div v-if="showReplay" class="mv-results-replay column col" style="min-height: 0">
        <div class="text-subtitle2 text-weight-medium text-grey-5 q-mb-sm">
          Round {{ roundIdx + 1 }} of {{ totalRounds }}
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
                <div class="text-caption text-grey-6">{{ row.count }} of {{ ballotsLabel }} votes</div>
              </div>
            </div>
            <div class="mv-results-bar-track rounded-borders overflow-hidden">
              <div class="mv-results-bar-fill" :style="{ width: `${barPct(row.id)}%` }" />
            </div>
          </div>
        </div>
      </div>

      <q-card v-if="showFinal" flat bordered class="q-pa-lg text-center q-mt-md">
        <div class="text-h6 q-mb-md">Winner</div>
        <div v-if="irvResult.winnerId" class="column items-center q-gutter-sm">
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
        <div v-else-if="irvResult.tieWinnerIds?.length" class="text-h6">
          It’s a tie: {{ irvResult.tieWinnerIds.map((id) => titleFor(id)).join(', ') }}
        </div>
      </q-card>

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
import { posterUrl } from '../tmdb.js'

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

const rounds = computed(() => props.irvResult?.rounds ?? [])
const totalRounds = computed(() => Math.max(1, rounds.value.length))

/** Fixed pool size for bar width = share of all voters (so count changes always move the bar). */
const barVoteDenominator = computed(() => {
  const r0 = rounds.value[0]
  const n = r0?.ballotsWithVote
  return typeof n === 'number' && n > 0 ? n : 1
})

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

/** Bar target %: each count / total electorate (round 0 ballot count). */
function targetPctsForRound(r) {
  if (!r || !Array.isArray(r.activeIds) || !r.activeIds.length) return {}
  const denom = barVoteDenominator.value
  /** @type {Record<string, number>} */
  const out = {}
  for (const id of r.activeIds) {
    const count = r.counts[id] ?? 0
    out[id] = Math.min(100, Math.round((100 * count) / denom))
  }
  return out
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

const ballotsLabel = computed(() => {
  const r = currentRound.value
  if (!r) return '—'
  const n = r.ballotsWithVote
  return typeof n === 'number' && n > 0 ? String(n) : '—'
})

const sortedRows = computed(() => {
  const r = currentRound.value
  if (!r || !Array.isArray(r.activeIds)) return []
  const denom = barVoteDenominator.value
  const rows = r.activeIds.map((id) => {
    const count = r.counts[id] ?? 0
    return {
      id,
      title: titleFor(id),
      thumb: thumbFor(id),
      count,
      pct: Math.min(100, Math.round((100 * count) / denom)),
    }
  })
  rows.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count
    return a.title.localeCompare(b.title)
  })
  return rows
})

const winnerThumb = computed(() => {
  const id = props.irvResult?.winnerId
  if (!id) return null
  return thumbFor(id)
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
    if (r && Array.isArray(r.rounds) && r.rounds.length) {
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
</style>
