<template>
  <div data-testid="world-builder-colonist-settings-panel">
    <div class="text-subtitle2 q-mb-sm">Colonist settings</div>
    <q-btn
      flat
      dense
      color="primary"
      class="full-width q-mb-md"
      data-testid="world-builder-colonist-reset-defaults"
      aria-label="Reset colonist settings to defaults"
      :disable="runningPhase"
      @click="$emit('reset-defaults')"
    >
      Reset to defaults
    </q-btn>

    <div class="row items-center no-wrap q-gutter-xs q-mb-xs">
      <span class="text-caption">Three-day haul distance</span>
      <WorldBuilderSettingHelp
        :text="THREE_DAY_HAUL_DISTANCE_TOOLTIP"
        label="Three-day haul distance"
      />
    </div>
    <q-slider
      :model-value="displaySettings.threeDayHaulDistance"
      :min="1"
      :max="maxThreeDayHaulDistance"
      :step="1"
      label
      color="primary"
      data-testid="world-builder-colonist-three-day-haul-distance"
      :disable="runningPhase"
      @update:model-value="(value) => emitSetting('threeDayHaulDistance', value)"
    />

    <div class="row items-center no-wrap q-gutter-xs q-mb-xs q-mt-md">
      <span class="text-caption">Starting population</span>
      <WorldBuilderSettingHelp
        :text="STARTING_POPULATION_TOOLTIP"
        label="Starting population"
      />
    </div>
    <q-slider
      :model-value="displaySettings.startingPopulation"
      :min="10"
      :max="500"
      :step="10"
      label
      color="primary"
      data-testid="world-builder-colonist-starting-population"
      :disable="runningPhase"
      @update:model-value="(value) => emitSetting('startingPopulation', value)"
    />

    <div class="row items-center no-wrap q-gutter-xs q-mb-xs q-mt-md">
      <span class="text-caption">Yield modifier</span>
      <WorldBuilderSettingHelp
        :text="YIELD_MODIFIER_TOOLTIP"
        label="Yield modifier"
      />
    </div>
    <q-btn-toggle
      :model-value="displaySettings.yieldModifier"
      spread
      no-caps
      toggle-color="primary"
      data-testid="world-builder-colonist-yield-modifier"
      :disable="runningPhase"
      :options="yieldModifierOptions"
      @update:model-value="(value) => emitSetting('yieldModifier', value)"
    />

    <div class="row items-center no-wrap q-gutter-xs q-mb-xs q-mt-md">
      <span class="text-caption">Epoch batch</span>
      <WorldBuilderSettingHelp
        :text="EPOCH_BATCH_TOOLTIP"
        label="Epoch batch"
      />
    </div>
    <q-slider
      :model-value="runningPhase ? pendingEpochBatch : colonistSettings.epochBatch"
      :min="1"
      :max="100"
      :step="1"
      label
      color="primary"
      data-testid="world-builder-colonist-epoch-batch"
      @update:model-value="onEpochBatchInput"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  EPOCH_BATCH_TOOLTIP,
  STARTING_POPULATION_TOOLTIP,
  THREE_DAY_HAUL_DISTANCE_TOOLTIP,
  YIELD_MODIFIER_TOOLTIP,
} from '@world-builder/worldBuilderColonistSettingsControls.js'
import { MAX_THREE_DAY_HAUL_DISTANCE } from '@world-builder/core/colonization/createDefaultColonizationSlice.js'
import WorldBuilderSettingHelp from './WorldBuilderSettingHelp.vue'

const props = defineProps({
  colonistSettings: {
    type: Object,
    required: true,
  },
  colonistSettingsSnapshot: {
    type: Object,
    required: true,
  },
  pendingEpochBatch: {
    type: Number,
    required: true,
  },
  runningPhase: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update-setting', 'update:pending-epoch-batch', 'reset-defaults'])
const maxThreeDayHaulDistance = MAX_THREE_DAY_HAUL_DISTANCE

const displaySettings = computed(() =>
  props.runningPhase ? props.colonistSettingsSnapshot : props.colonistSettings,
)

const yieldModifierOptions = [
  { label: 'Marginal', value: 'marginal' },
  { label: 'Typical', value: 'typical' },
  { label: 'Bountiful', value: 'bountiful' },
]

/**
 * @param {string} key
 * @param {unknown} value
 */
function emitSetting(key, value) {
  emit('update-setting', key, value)
}

/**
 * @param {number} value
 */
function onEpochBatchInput(value) {
  if (props.runningPhase) {
    emit('update:pending-epoch-batch', value)
    return
  }
  emitSetting('epochBatch', value)
}
</script>
