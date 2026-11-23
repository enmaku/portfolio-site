<script setup>
// Placeholder: #503 builds the U T E M L ladder list here.
import ScreenPlaceholder from './ScreenPlaceholder.vue'
defineProps({ sheet: { type: Object, required: true } })
</script>

<template>
  <ScreenPlaceholder title="Skills" :detail="`${sheet.skills.length} skills`" />
</template>
