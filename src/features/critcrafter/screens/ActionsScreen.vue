<script setup>
// Placeholder: #503 builds the Action source groups here.
import ScreenPlaceholder from './ScreenPlaceholder.vue'
defineProps({ sheet: { type: Object, required: true } })
</script>

<template>
  <ScreenPlaceholder title="Actions" :detail="`${sheet.actions.groups.length} groups`" />
</template>
