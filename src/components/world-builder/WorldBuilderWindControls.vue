<template>
  <div class="world-builder-wind-controls">
    <div
      v-for="control in windSliderControls"
      :key="control.key"
      class="generation-control q-mb-sm"
    >
      <div class="row items-center no-wrap q-gutter-xs q-mb-xs">
        <span class="text-caption">
          {{ control.label }}:
          {{ formatGenerationControlValue(control.key, controlValue(control.key)) }}
        </span>
        <WorldBuilderSettingHelp
          :text="control.tooltip"
          :label="control.label"
        />
      </div>
      <div class="row items-center no-wrap q-gutter-xs">
        <q-slider
          class="col generation-control__slider"
          dense
          :model-value="Number(controlValue(control.key))"
          :disable="isControlDisabled(control.key)"
          :data-testid="control.testId"
          :min="control.min"
          :max="control.max"
          :step="control.step"
          label
          color="primary"
          @update:model-value="onSliderInput(control.key, $event)"
          @change="onSliderCommit(control.key, $event)"
        />
        <PrevailingWindArrow
          :data-testid="arrowTestId(control.key)"
          :degrees="Number(controlValue(control.key))"
        />
      </div>
      <div
        v-if="control.key === 'prevailingWindDegrees'"
        class="wind-link-row"
      >
        <q-btn
          flat
          dense
          round
          size="sm"
          :icon="secondaryMaximumLinked ? 'link' : 'link_off'"
          :aria-pressed="secondaryMaximumLinked ? 'true' : 'false'"
          data-testid="world-builder-secondary-maximum-link"
          aria-label="Link secondary maximum to prevailing"
          @click="onToggleLink"
        />
        <WorldBuilderSettingHelp
          :text="SECONDARY_MAXIMUM_LINK_TOOLTIP"
          label="Link secondary maximum"
        />
      </div>
    </div>
    <WorldBuilderWindRosePreview
      :geography-seed="geographySeed"
      :prevailing-wind-degrees="Number(controlValue('prevailingWindDegrees'))"
      :secondary-maximum-degrees="Number(controlValue('secondaryMaximumDegrees'))"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  formatGenerationControlValue,
  SECONDARY_MAXIMUM_LINK_TOOLTIP,
} from '@world-builder/worldBuilderGenerationControls.js'
import PrevailingWindArrow from './PrevailingWindArrow.vue'
import WorldBuilderSettingHelp from './WorldBuilderSettingHelp.vue'
import WorldBuilderWindRosePreview from './WorldBuilderWindRosePreview.vue'

const props = defineProps({
  controls: {
    type: Array,
    required: true,
  },
  controlValue: {
    type: Function,
    required: true,
  },
  isControlDisabled: {
    type: Function,
    required: true,
  },
  onSliderInput: {
    type: Function,
    required: true,
  },
  onSliderCommit: {
    type: Function,
    required: true,
  },
  onLinkChange: {
    type: Function,
    required: true,
  },
  geographySeed: {
    type: Number,
    required: true,
  },
  secondaryMaximumLinked: {
    type: Boolean,
    required: true,
  },
})

const windSliderControls = computed(() =>
  props.controls.filter((control) => control.kind === 'slider'),
)

function arrowTestId(key) {
  return key === 'prevailingWindDegrees'
    ? 'world-builder-wind-arrow'
    : 'world-builder-secondary-maximum-arrow'
}

function onToggleLink() {
  props.onLinkChange(!props.secondaryMaximumLinked)
}
</script>

<style scoped>
.wind-link-row {
  display: flex;
  justify-content: center;
  margin-top: 2px;
}
</style>
