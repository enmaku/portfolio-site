<template>
  <div :data-testid="PLAY_SETUP_SHELL_TEST_IDS.root">
    <q-card flat bordered class="q-pa-md">
      <div class="text-subtitle1 q-mb-sm">Setup</div>
      <div class="row q-col-gutter-md q-mb-md">
        <div class="col-12 col-sm-6">
          <div class="text-body2 q-mb-sm">Total players</div>
          <q-slider
            v-model="setup.totalSeats"
            :min="totalSeatSlider.min"
            :max="totalSeatSlider.max"
            :step="totalSeatSlider.step"
            snap
            markers
            marker-labels
            color="primary"
            aria-label="Total players"
            class="dr-total-seats-slider q-px-sm"
          />
        </div>
      </div>

      <div class="q-gutter-y-sm">
        <div
          v-for="(opponent, index) in setup.opponents"
          :key="`opponent-${index}`"
          class="row items-center q-col-gutter-sm"
        >
          <div class="col-7">
            <q-select
              v-model="opponent.type"
              :options="opponentTypeOptions"
              option-value="value"
              option-label="label"
              emit-value
              map-options
              behavior="menu"
              outlined
              dense
              :label="`Opponent ${index + 1}`"
            />
          </div>
          <div class="col-5" v-if="opponent.type === 'nn'">
            <q-select
              v-if="modelOptions.length"
              v-model="opponent.modelId"
              :options="modelOptions"
              label="Model"
              behavior="menu"
              outlined
              dense
            />
            <q-input v-else v-model="opponent.modelId" label="Model" outlined dense />
          </div>
        </div>
      </div>

      <div class="q-mt-md">
        <q-btn
          unelevated
          color="primary"
          label="Start match"
          :disable="!setupIsValid"
          :data-testid="PLAY_SETUP_SHELL_TEST_IDS.startMatch"
          @click="emit('start-match')"
        />
      </div>
    </q-card>

    <q-dialog
      :model-value="neuralLoadGateTerminalOpen"
      persistent
      :data-testid="PLAY_SETUP_SHELL_TEST_IDS.neuralLoadGateTerminal"
      @update:model-value="onNeuralLoadGateTerminalModelValue"
    >
      <q-card class="q-pa-md" style="min-width: 320px">
        <div class="text-subtitle1 q-mb-xs">Neural opponent unavailable</div>
        <div class="text-body2 q-mb-md">
          A selected neural model could not load. Adjust setup and start a new match.
        </div>
        <div class="row justify-end">
          <q-btn
            color="primary"
            unelevated
            label="Back to setup"
            :data-testid="PLAY_SETUP_SHELL_TEST_IDS.neuralLoadGateTerminalDismiss"
            @click="emit('update:neuralLoadGateTerminalOpen', false)"
          />
        </div>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { normalizeSetupState } from '../../setup/state.js'
import {
  PLAY_SETUP_SHELL_TEST_IDS,
  applyNnDefaultModelIds,
  isPlaySetupStartEnabled,
} from '../playSetupShell.js'

const setup = defineModel('setup', { type: Object, required: true })

const props = defineProps({
  modelOptions: {
    type: Array,
    required: true,
  },
  totalSeatSlider: {
    type: Object,
    required: true,
  },
  opponentTypeOptions: {
    type: Array,
    required: true,
  },
  neuralLoadGateTerminalOpen: {
    type: Boolean,
    required: true,
  },
})

const emit = defineEmits(['start-match', 'update:neuralLoadGateTerminalOpen'])

const setupIsValid = computed(() =>
  isPlaySetupStartEnabled({
    setup: setup.value,
    modelOptions: props.modelOptions,
  }),
)

watch(
  () => setup.value.totalSeats,
  (totalSeats) => {
    const normalized = normalizeSetupState({ totalSeats, opponents: setup.value.opponents })
    setup.value.totalSeats = normalized.totalSeats
    setup.value.opponents.splice(0, setup.value.opponents.length, ...normalized.opponents)
  },
)

watch(
  () => setup.value.opponents.map((opponent) => opponent.type),
  () => {
    applyNnDefaultModelIds(setup.value, props.modelOptions)
  },
)

function onNeuralLoadGateTerminalModelValue(open) {
  if (!open) {
    emit('update:neuralLoadGateTerminalOpen', false)
  }
}
</script>
