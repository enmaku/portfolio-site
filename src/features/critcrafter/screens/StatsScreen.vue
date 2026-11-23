<script setup>
// Placeholder: #502 builds Saves, Abilities, DC & attack, rests and Features here.
import ScreenPlaceholder from './ScreenPlaceholder.vue'
defineProps({ sheet: { type: Object, required: true } })
</script>

<template>
  <ScreenPlaceholder title="Stats" :detail="`${sheet.stats.saves.length} saves, ${sheet.stats.abilities.length} abilities`" />
</template>
