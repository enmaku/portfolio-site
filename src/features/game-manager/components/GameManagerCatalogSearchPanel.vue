<template>
  <div class="gm-catalog-panel column" :data-testid="testId">
    <div class="col column q-pa-md gm-catalog-panel__body">
      <div class="text-h6 q-mb-sm">{{ title }}</div>
      <GameManagerCatalogSearchField panel autofocus class="col" @select="onSelect" />
    </div>
    <div class="gm-catalog-panel__actions q-pa-md">
      <q-btn
        unelevated
        class="full-width"
        label="Close"
        color="primary"
        :data-testid="closeTestId"
        @click="emit('close')"
      />
    </div>
  </div>
</template>

<script setup>
import GameManagerCatalogSearchField from './GameManagerCatalogSearchField.vue'

defineProps({
  title: {
    type: String,
    required: true,
  },
  testId: {
    type: String,
    default: 'gm-catalog-search-panel',
  },
  closeTestId: {
    type: String,
    default: 'gm-catalog-search-close',
  },
})

const emit = defineEmits(['select', 'close'])

/** @param {unknown} pick */
function onSelect(pick) {
  emit('select', pick)
}
</script>
