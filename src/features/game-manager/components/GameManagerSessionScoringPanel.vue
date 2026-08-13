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
        <div v-else class="gm-session-scoring-seats">
          <div
            v-for="seat in session?.presentPlayers || []"
            :key="seat.recordedPlayerId || seat.name"
            class="gm-session-scoring-seat"
            :style="seatRowStyle(seat)"
          >
            <div class="gm-session-scoring-name ellipsis">{{ seat.name }}</div>
            <q-input
              v-if="scoreMode === SCORE_ENTRY_MODES.POINTS"
              dense
              outlined
              type="text"
              inputmode="decimal"
              autocomplete="off"
              class="gm-session-scoring-field"
              :style="seatFieldStyle(seat)"
              :model-value="scoreDraftDisplay(seat.recordedPlayerId)"
              :data-testid="`gm-session-scoring-score-${seat.recordedPlayerId}`"
              @update:model-value="(v) => setScoreDraft(seat.recordedPlayerId, v)"
              @blur="commitScoreDraft(seat.recordedPlayerId)"
            />
            <q-select
              v-else-if="scoreMode === SCORE_ENTRY_MODES.OUTCOMES"
              dense
              outlined
              emit-value
              map-options
              class="gm-session-scoring-field"
              :style="seatFieldStyle(seat)"
              :options="outcomeOptions"
              :model-value="outcomes[seat.recordedPlayerId]"
              :data-testid="`gm-session-scoring-outcome-${seat.recordedPlayerId}`"
              @update:model-value="(v) => (outcomes[seat.recordedPlayerId] = v)"
            />
          </div>
        </div>
      </div>
    </q-card-section>

    <q-card-actions class="gm-flow-panel__actions q-pa-md row items-center no-wrap q-gutter-sm">
      <q-btn
        v-if="canReturnToTimer"
        unelevated
        color="primary"
        icon="img:icons/timer-glyph-white.svg"
        aria-label="Back to Game Timer"
        data-testid="gm-session-scoring-back"
        class="gm-session-scoring-back"
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
import { useQuasar } from 'quasar'
import {
  SCORE_ENTRY_MODES,
  canCompletePlaySession,
  normalizeScoreEntryMode,
} from '../sessions/sessionsViewModel.js'
import { normalizeTimerExport } from '../domain/timerHandoff.js'
import { evaluateScoreExpression } from '../domain/evaluateScoreExpression.js'
import { playerBarFillColor, playerBarTrackColor } from '../../game-timer/core.js'

const props = defineProps({
  session: { type: Object, default: null },
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'save', 'back'])

const $q = useQuasar()
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

function seatColor(seat) {
  return typeof seat?.color === 'string' && seat.color ? seat.color : '#78909c'
}

function seatRowStyle(seat) {
  const color = seatColor(seat)
  return {
    backgroundColor: color,
  }
}

function seatFieldStyle(seat) {
  const color = seatColor(seat)
  const isDark = $q.dark.isActive
  return {
    '--gm-score-field-bg': playerBarTrackColor(color, isDark),
    '--gm-score-field-outline': playerBarFillColor(color, isDark),
  }
}

function scoreDraftDisplay(recordedPlayerId) {
  const raw = perPlayerScores[recordedPlayerId]
  return raw == null ? '' : String(raw)
}

function setScoreDraft(recordedPlayerId, value) {
  perPlayerScores[recordedPlayerId] = value
}

function commitScoreDraft(recordedPlayerId) {
  const resolved = evaluateScoreExpression(perPlayerScores[recordedPlayerId])
  if (resolved !== null) {
    perPlayerScores[recordedPlayerId] = resolved
  }
}

function commitAllScoreDrafts() {
  for (const seat of props.session?.presentPlayers || []) {
    if (seat?.recordedPlayerId) commitScoreDraft(seat.recordedPlayerId)
  }
}

function buildScore() {
  if (scoreMode.value === SCORE_ENTRY_MODES.POINTS) {
    /** @type {Record<string, number>} */
    const perPlayer = {}
    for (const seat of props.session?.presentPlayers || []) {
      const id = seat?.recordedPlayerId
      if (!id) continue
      const resolved = evaluateScoreExpression(perPlayerScores[id])
      if (resolved !== null) perPlayer[id] = resolved
    }
    return { mode: SCORE_ENTRY_MODES.POINTS, perPlayer }
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
  commitAllScoreDrafts()
  if (!canSave.value) return
  emit('save', buildScore())
}
</script>

<style scoped>
.gm-session-scoring-seats {
  display: grid;
  grid-template-columns: fit-content(50%) minmax(0, 1fr);
  row-gap: 8px;
  column-gap: 0;
}

.gm-session-scoring-seat {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: subgrid;
  align-items: center;
  column-gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
}

.gm-session-scoring-name {
  min-width: 0;
  color: #fff;
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.25;
  text-shadow:
    -1.5px 0 0 #000,
    1.5px 0 0 #000,
    0 -1.5px 0 #000,
    0 1.5px 0 #000;
}

.gm-session-scoring-field {
  min-width: 0;
  width: 100%;
}

.gm-session-scoring-field :deep(.q-field__control) {
  background-color: var(--gm-score-field-bg);
}

.gm-session-scoring-field :deep(.q-field--outlined .q-field__control:before) {
  border-color: var(--gm-score-field-outline);
}

.gm-session-scoring-field :deep(.q-field--outlined.q-field--highlighted .q-field__control:before),
.gm-session-scoring-field :deep(.q-field--outlined.q-field--focused .q-field__control:before) {
  border-color: var(--gm-score-field-outline);
}

.gm-session-scoring-field :deep(.q-field__native),
.gm-session-scoring-field :deep(.q-field__input),
.gm-session-scoring-field :deep(.q-select__dropdown-icon) {
  color: #fff;
  font-weight: 600;
  text-shadow:
    -1.5px 0 0 #000,
    1.5px 0 0 #000,
    0 -1.5px 0 #000,
    0 1.5px 0 #000;
}

.gm-session-scoring-back {
  align-self: stretch;
  aspect-ratio: 1;
  min-width: 0;
  padding: 0;
}

.gm-session-scoring-back :deep(.q-icon) {
  font-size: 1.35em;
}
</style>
