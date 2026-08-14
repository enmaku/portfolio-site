<template>
  <div
    class="q-mb-md"
    data-testid="world-builder-llm-names-panel"
  >
    <q-input
      :model-value="model.flavorPrompt"
      type="textarea"
      autogrow
      dense
      outlined
      label="Name flavor"
      hint="Theme for Gemini place names (elven, dwarven, pirates, …)"
      class="q-mb-sm"
      data-testid="world-builder-llm-flavor"
      @update:model-value="model.setFlavorPrompt"
    />
    <q-toggle
      :model-value="model.namesOverlayVisible"
      label="Names overlay"
      dense
      class="q-mb-sm"
      data-testid="world-builder-llm-names-overlay"
      @update:model-value="model.setNamesOverlayVisible"
    />
    <q-btn
      unelevated
      color="secondary"
      class="full-width"
      label="Generate names"
      data-testid="world-builder-llm-generate-names"
      :loading="model.isGenerateRunning"
      :disable="model.generateDisabled"
      @click="model.generateSettlementNames"
    />
    <q-btn
      flat
      dense
      color="grey-4"
      class="full-width q-mt-sm"
      label="Reset all names"
      data-testid="world-builder-llm-reset-names"
      :disable="model.resetNamesDisabled"
      @click="model.resetAllNames"
    />
    <q-input
      :model-value="model.regionWriteup"
      type="textarea"
      autogrow
      dense
      outlined
      readonly
      label="Region writeup"
      hint="Notable settlements after Generate names"
      class="q-mt-sm"
      input-style="max-height: 16rem; overflow-y: auto"
      data-testid="world-builder-llm-region-writeup"
    />
    <div
      v-if="model.lastError"
      class="text-negative text-caption q-mt-sm"
      data-testid="world-builder-llm-error"
    >
      {{ model.lastError }}
    </div>
    <q-dialog
      :model-value="model.nameEditorOpen"
      data-testid="world-builder-llm-name-editor"
      @update:model-value="model.setNameEditorOpen"
    >
      <q-card class="world-builder-name-editor-card">
        <q-card-section class="text-subtitle1">Edit name</q-card-section>
        <q-card-section class="q-pt-none">
          <q-input
            :model-value="model.nameEditorDraft"
            dense
            outlined
            autofocus
            data-testid="world-builder-llm-name-input"
            @update:model-value="model.setNameEditorDraft"
            @keyup.enter="model.saveNameEditor"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn
            flat
            color="grey"
            label="Clear"
            data-testid="world-builder-llm-name-clear"
            @click="model.clearNameEditor"
          />
          <q-btn
            unelevated
            color="primary"
            label="Save"
            data-testid="world-builder-llm-name-save"
            @click="model.saveNameEditor"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { reactive } from 'vue'

const props = defineProps({
  names: {
    type: Object,
    required: true,
  },
})

/** Composable refs are not unwrapped through a plain object prop; reactive() restores that. */
const model = reactive(props.names)
</script>

<style scoped>
.world-builder-name-editor-card {
  min-width: 18rem;
}
</style>
