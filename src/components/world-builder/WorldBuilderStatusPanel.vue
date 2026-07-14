<template>
  <div
    v-if="statusBar.mode === 'overlays'"
    :data-testid="statusBar.panelTestId"
    class="status-bar-panel status-bar-panel--overlays resource-overlay-row"
  >
    <q-checkbox
      v-for="overlay in statusBar.overlayDefs"
      :key="overlay.id"
      dense
      :toggle-indeterminate="false"
      :model-value="resourceOverlayVisibility[overlay.id] === true"
      :data-testid="overlay.testId"
      :label="overlay.label"
      @update:model-value="(value) => toggleResourceOverlayVisibility(overlay.id, value === true)"
    />
  </div>
  <div
    v-else
    :data-testid="statusBar.panelTestId"
    class="status-bar-panel status-bar-panel--generation"
  >
    <q-linear-progress
      :value="statusBar.indeterminate ? undefined : statusBar.percent / 100"
      :indeterminate="statusBar.indeterminate"
      :color="statusBar.color"
      track-color="grey-9"
      rounded
    />
    <div class="row q-gutter-xs items-center no-wrap generation-step-row">
      <template
        v-for="step in statusBar.steps"
        :key="step.id"
      >
        <q-chip
          dense
          :data-testid="step.testId"
          :color="generationStepStatusColor(step.status)"
          text-color="white"
          :outline="step.status === 'pending'"
        >
          {{ step.label }}
        </q-chip>
        <template v-if="step.status === 'active' && statusBar.nestedByParentId[step.id]">
          <q-chip
            v-for="substep in statusBar.nestedByParentId[step.id]"
            :key="substep.id"
            dense
            :data-testid="substep.testId"
            :color="generationStepStatusColor(substep.status)"
            text-color="white"
            :outline="substep.status === 'pending'"
            size="sm"
          >
            {{ substep.label }}
          </q-chip>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup>
import { generationStepStatusColor } from '@world-builder/worldBuilderPageModel.js'

defineProps({
  statusBar: {
    type: Object,
    required: true,
  },
  resourceOverlayVisibility: {
    type: Object,
    default: () => ({}),
  },
  toggleResourceOverlayVisibility: {
    type: Function,
    default: () => {},
  },
})
</script>

<style scoped>
.status-bar-panel {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.status-bar-panel--generation {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.status-bar-panel--overlays {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  overflow-x: hidden;
}

.generation-step-row {
  overflow-x: hidden;
  height: 28px;
  flex: 0 0 28px;
}
</style>
