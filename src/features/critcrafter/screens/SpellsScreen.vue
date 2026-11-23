<script setup>
// Placeholder: #503 builds casters by rank, the Focus section and Rituals here.
import ScreenPlaceholder from './ScreenPlaceholder.vue'
defineProps({ sheet: { type: Object, required: true } })
</script>

<template>
  <ScreenPlaceholder title="Spells" :detail="`${sheet.spells.casters.length} casters`" />
</template>
