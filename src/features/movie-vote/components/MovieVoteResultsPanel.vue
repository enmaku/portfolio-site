<template>
  <div class="mv-results q-pa-md column q-gutter-md">
    <div v-if="!irvResult" class="text-body2 text-grey-6">No results.</div>

    <template v-else>
      <q-linear-progress
        v-if="animating"
        :value="progressFrac"
        color="primary"
        class="rounded-borders"
        size="8px"
      />

      <q-card v-if="displayRound" flat bordered class="q-pa-md">
        <div class="text-subtitle2 text-grey-6 q-mb-sm">Round {{ displayRoundIndex + 1 }}</div>
        <div class="column q-gutter-xs">
          <div
            v-for="(c, id) in displayRound.counts"
            :key="id"
            class="row items-center justify-between"
          >
            <span class="ellipsis col">{{ titleFor(id) }}</span>
            <span class="text-mono text-weight-medium">{{ c }}</span>
          </div>
        </div>
        <div v-if="displayRound.eliminatedIds?.length" class="text-caption text-negative q-mt-sm">
          Eliminated:
          {{ displayRound.eliminatedIds.map((id) => titleFor(id)).join(', ') }}
        </div>
      </q-card>

      <q-card v-if="showFinal" flat bordered class="q-pa-lg text-center">
        <div class="text-h6 q-mb-md">Winner</div>
        <div v-if="irvResult.winnerId" class="text-h5 text-weight-bold text-primary">
          {{ titleFor(irvResult.winnerId) }}
        </div>
        <div v-else-if="irvResult.tieWinnerIds?.length" class="text-h6">
          It’s a tie: {{ irvResult.tieWinnerIds.map((id) => titleFor(id)).join(', ') }}
        </div>
      </q-card>

      <q-btn
        v-if="allowReset"
        outline
        color="primary"
        no-caps
        class="full-width"
        label="Start over"
        @click="$emit('reset')"
      />
    </template>
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  /** @type {import('vue').PropType<import('../irv.js').IrvResult | null>} */
  irvResult: { type: Object, default: null },
  /** @type {import('vue').PropType<import('../types.js').BallotMovie[]>} */
  ballotMovies: { type: Array, default: () => [] },
  allowReset: { type: Boolean, default: true },
})

defineEmits(['reset'])

const STEP_MS = 1400

const displayRoundIndex = ref(0)
const animating = ref(true)
const progressFrac = ref(0)
/** @type {ReturnType<typeof setInterval> | null} */
let progressTimer = null
/** @type {ReturnType<typeof setTimeout> | null} */
let stepTimer = null

const idToTitle = computed(() => {
  const m = new Map()
  for (const x of props.ballotMovies) m.set(x.publicId, x.title)
  return m
})

function titleFor(id) {
  return idToTitle.value.get(id) ?? id
}

const rounds = computed(() => props.irvResult?.rounds ?? [])

const displayRound = computed(() => rounds.value[displayRoundIndex.value] ?? null)

const showFinal = computed(() => {
  if (!props.irvResult || animating.value) return false
  return displayRoundIndex.value >= rounds.value.length && rounds.value.length > 0
})

function clearTimers() {
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }
  if (stepTimer) {
    clearTimeout(stepTimer)
    stepTimer = null
  }
}

function startAnimation() {
  clearTimers()
  displayRoundIndex.value = 0
  animating.value = true
  progressFrac.value = 0
  const total = Math.max(1, rounds.value.length)
  const start = Date.now()
  progressTimer = setInterval(() => {
    const elapsed = Date.now() - start
    const frac = Math.min(1, elapsed / (total * STEP_MS))
    progressFrac.value = frac
  }, 80)

  function step() {
    if (displayRoundIndex.value < rounds.value.length - 1) {
      displayRoundIndex.value += 1
      stepTimer = setTimeout(step, STEP_MS)
    } else {
      displayRoundIndex.value = rounds.value.length
      animating.value = false
      clearTimers()
      progressFrac.value = 1
    }
  }
  stepTimer = setTimeout(step, STEP_MS)
}

watch(
  () => props.irvResult,
  (r) => {
    if (r && r.rounds?.length) {
      startAnimation()
    } else {
      clearTimers()
      displayRoundIndex.value = 0
      animating.value = false
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  clearTimers()
})
</script>
