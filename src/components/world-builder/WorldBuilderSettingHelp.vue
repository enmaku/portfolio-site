<template>
  <q-icon
    name="help_outline"
    size="14px"
    color="grey-6"
    class="world-builder-setting-help"
    :aria-label="`${label} help`"
  >
    <q-tooltip
      anchor="center right"
      self="center left"
      :offset="[8, 0]"
      max-width="280px"
    >
      {{ text }}
    </q-tooltip>
  </q-icon>
</template>

<script setup>
defineProps({
  text: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
})
</script>

<style scoped>
.world-builder-setting-help {
  cursor: help;
  flex-shrink: 0;
}
</style>
