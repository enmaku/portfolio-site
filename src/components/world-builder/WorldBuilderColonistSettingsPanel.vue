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
      <span class="text-caption">Population density</span>
      <WorldBuilderSettingHelp
        :text="POPULATION_DENSITY_TOOLTIP"
        label="Population density"
      />
    </div>
    <q-slider
      :model-value="displaySettings.populationDensity"
      :min="minPopulationDensity"
      :max="maxPopulationDensity"
      :step="0.1"
      label
      color="primary"
      data-testid="world-builder-colonist-population-density"
      :disable="runningPhase"
      @update:model-value="(value) => emitSetting('populationDensity', value)"
    />

    <div class="row items-center no-wrap q-gutter-xs q-mb-xs q-mt-md">
      <span class="text-caption">People per habitable cell</span>
      <WorldBuilderSettingHelp
        :text="PEOPLE_PER_HABITABLE_CELL_TOOLTIP"
        label="People per habitable cell"
      />
    </div>
    <q-slider
      :model-value="displaySettings.peoplePerHabitableCell"
      :min="minPeoplePerHabitableCell"
      :max="maxPeoplePerHabitableCell"
      :step="1"
      label
      color="primary"
      data-testid="world-builder-colonist-people-per-habitable-cell"
      :disable="runningPhase"
      @update:model-value="(value) => emitSetting('peoplePerHabitableCell', value)"
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
      <span class="text-caption">Land expedition range</span>
      <WorldBuilderSettingHelp
        :text="LAND_EXPEDITION_RANGE_TOOLTIP"
        label="Land expedition range"
      />
    </div>
    <q-slider
      :model-value="displaySettings.landExpeditionRange"
      :min="minLandExpeditionRange"
      :max="maxLandExpeditionRange"
      :step="1"
      label
      color="primary"
      data-testid="world-builder-colonist-land-expedition-range"
      :disable="runningPhase"
      @update:model-value="(value) => emitSetting('landExpeditionRange', value)"
    />

    <div class="row items-center no-wrap q-gutter-xs q-mb-xs q-mt-md">
      <span class="text-caption">Inland sail expedition range</span>
      <WorldBuilderSettingHelp
        :text="INLAND_SAIL_EXPEDITION_RANGE_TOOLTIP"
        label="Inland sail expedition range"
      />
    </div>
    <q-slider
      :model-value="displaySettings.inlandSailExpeditionRange"
      :min="minInlandSailExpeditionRange"
      :max="maxInlandSailExpeditionRange"
      :step="1"
      label
      color="primary"
      data-testid="world-builder-colonist-inland-sail-expedition-range"
      :disable="runningPhase"
      @update:model-value="(value) => emitSetting('inlandSailExpeditionRange', value)"
    />

    <div class="row items-center no-wrap q-gutter-xs q-mb-xs q-mt-md">
      <span class="text-caption">Open-sea expedition range</span>
      <WorldBuilderSettingHelp
        :text="OPEN_SEA_EXPEDITION_RANGE_TOOLTIP"
        label="Open-sea expedition range"
      />
    </div>
    <q-slider
      :model-value="displaySettings.openSeaExpeditionRange"
      :min="minOpenSeaExpeditionRange"
      :max="maxOpenSeaExpeditionRange"
      :step="1"
      label
      color="primary"
      data-testid="world-builder-colonist-open-sea-expedition-range"
      :disable="runningPhase"
      @update:model-value="(value) => emitSetting('openSeaExpeditionRange', value)"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  INLAND_SAIL_EXPEDITION_RANGE_TOOLTIP,
  LAND_EXPEDITION_RANGE_TOOLTIP,
  OPEN_SEA_EXPEDITION_RANGE_TOOLTIP,
  PEOPLE_PER_HABITABLE_CELL_TOOLTIP,
  POPULATION_DENSITY_TOOLTIP,
  STARTING_POPULATION_TOOLTIP,
  THREE_DAY_HAUL_DISTANCE_TOOLTIP,
  YIELD_MODIFIER_TOOLTIP,
} from '@world-builder/worldBuilderColonistSettingsControls.js'
import {
  MAX_INLAND_SAIL_EXPEDITION_RANGE,
  MAX_LAND_EXPEDITION_RANGE,
  MAX_OPEN_SEA_EXPEDITION_RANGE,
  MAX_PEOPLE_PER_HABITABLE_CELL,
  MAX_POPULATION_DENSITY,
  MAX_THREE_DAY_HAUL_DISTANCE,
  MIN_INLAND_SAIL_EXPEDITION_RANGE,
  MIN_LAND_EXPEDITION_RANGE,
  MIN_OPEN_SEA_EXPEDITION_RANGE,
  MIN_PEOPLE_PER_HABITABLE_CELL,
  MIN_POPULATION_DENSITY,
} from '@world-builder/core/colonization/createDefaultColonizationSlice.js'
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
  runningPhase: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update-setting', 'reset-defaults'])
const maxThreeDayHaulDistance = MAX_THREE_DAY_HAUL_DISTANCE
const minPopulationDensity = MIN_POPULATION_DENSITY
const maxPopulationDensity = MAX_POPULATION_DENSITY
const minPeoplePerHabitableCell = MIN_PEOPLE_PER_HABITABLE_CELL
const maxPeoplePerHabitableCell = MAX_PEOPLE_PER_HABITABLE_CELL
const minLandExpeditionRange = MIN_LAND_EXPEDITION_RANGE
const maxLandExpeditionRange = MAX_LAND_EXPEDITION_RANGE
const minInlandSailExpeditionRange = MIN_INLAND_SAIL_EXPEDITION_RANGE
const maxInlandSailExpeditionRange = MAX_INLAND_SAIL_EXPEDITION_RANGE
const minOpenSeaExpeditionRange = MIN_OPEN_SEA_EXPEDITION_RANGE
const maxOpenSeaExpeditionRange = MAX_OPEN_SEA_EXPEDITION_RANGE

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
</script>
