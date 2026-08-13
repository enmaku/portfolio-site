<template>
  <q-card class="column no-wrap full-width gm-flow-panel" data-testid="gm-session-scoring">
    <q-card-section class="row items-center no-wrap q-pb-sm gm-flow-panel__header">
      <div class="text-h6 col ellipsis">{{ session?.game?.title || 'Scores' }}</div>
      <q-btn
        flat
        dense
        round
        icon="close"
        aria-label="Close"
        data-testid="gm-session-scoring-close"
        @click="$emit('close')"
      />
    </q-card-section>

    <q-card-section class="col q-pt-none gm-flow-panel__scroll column q-gutter-md">
      <div>
        <div class="text-subtitle2 q-mb-sm">Score entry mode</div>
        <q-btn-toggle
          v-model="scoreMode"
          spread
          unelevated
          toggle-color="primary"
          :options="modeOptions"
          data-testid="gm-session-scoring-mode"
        />
      </div>

      <div>
        <div class="text-subtitle2 q-mb-sm">Present players</div>
        <div
          v-if="!(session?.presentPlayers || []).length"
          class="text-body2 text-grey-6"
          data-testid="gm-session-scoring-empty-table"
        >
          No one at the table yet.
        </div>
        <div
          v-for="seat in session?.presentPlayers || []"
          :key="seat.recordedPlayerId || seat.name"
          class="row items-center q-gutter-sm q-mb-sm"
        >
          <div class="col text-body1">{{ seat.name }}</div>
          <q-input
            v-if="scoreMode === SCORE_ENTRY_MODES.POINTS"
            dense
            outlined
            type="number"
            class="col-4"
            :model-value="perPlayerScores[seat.recordedPlayerId]"
            :data-testid="`gm-session-scoring-score-${seat.recordedPlayerId}`"
            @update:model-value="(v) => (perPlayerScores[seat.recordedPlayerId] = Number(v))"
          />
          <q-select
            v-else-if="scoreMode === SCORE_ENTRY_MODES.OUTCOMES"
            dense
            outlined
            emit-value
            map-options
            class="col-5"
            :options="outcomeOptions"
            :model-value="outcomes[seat.recordedPlayerId]"
            :data-testid="`gm-session-scoring-outcome-${seat.recordedPlayerId}`"
            @update:model-value="(v) => (outcomes[seat.recordedPlayerId] = v)"
          />
        </div>
      </div>
    </q-card-section>

    <q-card-actions class="gm-flow-panel__actions q-pa-md row items-center no-wrap q-gutter-sm">
      <q-btn
        v-if="canReturnToTimer"
        flat
        dense
        round
        icon="img:icons/favicon-timer.svg"
        aria-label="Back to Game Timer"
        data-testid="gm-session-scoring-back"
        :disable="busy"
        @click="$emit('back')"
      />
      <q-btn
        class="col"
        unelevated
        color="primary"
        label="Save"
        data-testid="gm-session-scoring-save"
        :disable="!canSave || busy"
        :loading="busy"
        @click="onSave"
      />
    </q-card-actions>
  </q-card>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import {
  SCORE_ENTRY_MODES,
  canCompletePlaySession,
  normalizeScoreEntryMode,
} from '../sessions/sessionsViewModel.js'
import { normalizeTimerExport } from '../domain/timerHandoff.js'

const props = defineProps({
  session: { type: Object, default: null },
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'save', 'back'])

const scoreMode = ref(SCORE_ENTRY_MODES.POINTS)
const perPlayerScores = reactive({})
const outcomes = reactive({})

const modeOptions = [
  { label: 'Points', value: SCORE_ENTRY_MODES.POINTS },
  { label: 'Outcomes', value: SCORE_ENTRY_MODES.OUTCOMES },
]

const outcomeOptions = [
  { label: 'Win', value: 'win' },
  { label: 'Loss', value: 'loss' },
  { label: 'Draw', value: 'draw' },
]

const draftSession = computed(() => {
  if (!props.session || !scoreMode.value) return null
  return {
    ...props.session,
    score: buildScore(),
  }
})

const canSave = computed(() => canCompletePlaySession(draftSession.value))

const canReturnToTimer = computed(() => Boolean(normalizeTimerExport(props.session?.timerExport)))

function buildScore() {
  if (scoreMode.value === SCORE_ENTRY_MODES.POINTS) {
    return { mode: SCORE_ENTRY_MODES.POINTS, perPlayer: { ...perPlayerScores } }
  }
  return { mode: SCORE_ENTRY_MODES.OUTCOMES, outcomes: { ...outcomes } }
}

function syncFromSession(session) {
  Object.keys(perPlayerScores).forEach((k) => delete perPlayerScores[k])
  Object.keys(outcomes).forEach((k) => delete outcomes[k])
  const mode = normalizeScoreEntryMode(session?.score?.mode)
  if (mode === SCORE_ENTRY_MODES.OUTCOMES) {
    scoreMode.value = SCORE_ENTRY_MODES.OUTCOMES
    Object.assign(outcomes, session.score?.outcomes || {})
  } else {
    scoreMode.value = SCORE_ENTRY_MODES.POINTS
    Object.assign(perPlayerScores, session?.score?.perPlayer || {})
  }
}

watch(
  () => [props.session?.id, props.session?.score?.mode],
  () => {
    syncFromSession(props.session)
  },
  { immediate: true },
)

function onSave() {
  if (!canSave.value) return
  emit('save', buildScore())
}
</script>
