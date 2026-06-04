<template>
  <div :data-testid="MATCH_OVER_SHELL_TEST_IDS.root">
    <q-dialog :model-value="true" persistent transition-show="scale" transition-hide="scale">
      <q-card class="q-pa-md dr-match-over-dialog" :class="toneClass" style="min-width: 340px">
        <div class="text-overline dr-outcome-kicker">Match complete</div>
        <div class="text-h5 text-weight-bold q-mb-sm dr-outcome-title">{{ summary.title }}</div>
        <div class="text-body1 q-mb-xs">{{ summary.message }}</div>
        <div v-if="summary.showWinner" class="text-body2 q-mb-md">
          Winner: {{ summary.winnerLabel }}
        </div>
        <div class="row q-gutter-sm justify-end">
          <q-btn
            color="primary"
            unelevated
            label="Rematch"
            class="dr-outcome-btn"
            :data-testid="MATCH_OVER_SHELL_TEST_IDS.rematch"
            @click="emit('rematch')"
          />
          <q-btn
            flat
            color="primary"
            label="Back to setup"
            class="dr-outcome-btn-secondary"
            :data-testid="MATCH_OVER_SHELL_TEST_IDS.backToSetup"
            @click="emit('back-to-setup')"
          />
        </div>
      </q-card>
    </q-dialog>

    <q-card v-if="debugMode" flat bordered class="q-pa-md q-mt-md">
      <div class="text-subtitle2 q-mb-sm">Debug replay</div>
      <div v-if="nnDebugTraceHistory.length" class="q-mb-sm">
        <div class="text-caption text-grey-5 q-mb-xs">NN trace history</div>
        <div v-for="(entry, index) in nnDebugTraceHistory" :key="`nn-trace-${index}`" class="text-caption">
          {{ entry.at }} | {{ entry.modelId }} | {{ entry.trace.kind }} |
          {{ entry.trace.fallbackReason ?? entry.trace.mode ?? 'sample' }}
        </div>
      </div>
      <div class="row q-gutter-sm q-mb-sm">
        <q-btn
          color="primary"
          flat
          label="Export replay"
          :data-testid="MATCH_OVER_SHELL_TEST_IDS.exportReplay"
          @click="emit('export-replay')"
        />
      </div>
      <q-input
        :model-value="replayExportText"
        type="textarea"
        autogrow
        readonly
        label="Export payload"
        outlined
        dense
        class="q-mb-sm"
      />
      <q-input
        :model-value="nnDebugTraceText"
        type="textarea"
        autogrow
        readonly
        label="NN trace (features/mask/logits)"
        outlined
        dense
      />
    </q-card>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { buildMatchOverSummary } from '../matchOverSummaryBuilder.js'
import { MATCH_OVER_END_VARIANTS } from '../humanEliminationCompletionPolicy.js'
import { runMatchOverShellActivation } from './matchOverShellActivation.js'
import { MATCH_OVER_SHELL_TEST_IDS } from './matchOverShellTestIds.js'

const props = defineProps({
  match: {
    type: Object,
    default: null,
  },
  humanSeatId: {
    type: String,
    default: null,
  },
  debugMode: {
    type: Boolean,
    default: false,
  },
  replayExportText: {
    type: String,
    default: '',
  },
  nnDebugTraceText: {
    type: String,
    default: '',
  },
  nnDebugTraceHistory: {
    type: Array,
    default: () => [],
  },
  uploadTracker: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['rematch', 'back-to-setup', 'export-replay'])

const summary = computed(() =>
  buildMatchOverSummary({
    state: props.match?.state ?? null,
    humanPlayerSeatId: props.humanSeatId,
    seats: props.match?.state?.seats ?? [],
  }),
)

const toneClass = computed(() =>
  summary.value.variant === MATCH_OVER_END_VARIANTS.VICTORY
    ? 'dr-outcome--success'
    : 'dr-outcome--failure',
)

function activateShell() {
  runMatchOverShellActivation({
    match: props.match,
    uploadTracker: props.uploadTracker,
  })
}

watch(
  () => props.match?.id,
  () => {
    activateShell()
  },
  { immediate: true },
)
</script>

<style scoped>
.dr-match-over-dialog {
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 14px;
  box-shadow:
    0 12px 34px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
}

.dr-outcome--success {
  background:
    radial-gradient(120% 100% at 0% 0%, rgba(102, 187, 106, 0.22), rgba(102, 187, 106, 0) 60%),
    radial-gradient(120% 120% at 100% 100%, rgba(41, 182, 246, 0.2), rgba(41, 182, 246, 0) 62%),
    #171b1f;
}

.dr-outcome--failure {
  background:
    radial-gradient(120% 100% at 0% 0%, rgba(239, 83, 80, 0.24), rgba(239, 83, 80, 0) 58%),
    radial-gradient(120% 120% at 100% 100%, rgba(171, 71, 188, 0.2), rgba(171, 71, 188, 0) 62%),
    #1b161c;
}

.dr-outcome-kicker {
  letter-spacing: 0.18em;
  color: rgba(255, 255, 255, 0.72);
}

.dr-outcome-title {
  text-shadow: 0 2px 14px rgba(0, 0, 0, 0.5);
}

.dr-outcome-btn {
  letter-spacing: 0.03em;
}

.dr-outcome-btn-secondary {
  color: rgba(255, 255, 255, 0.86);
}
</style>
