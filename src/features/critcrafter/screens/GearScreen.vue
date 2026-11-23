<script setup>
// Placeholder: #503 builds the Bulk line and Weapons/Shields/Armor/Consumables/Gear groups here.
import ScreenPlaceholder from './ScreenPlaceholder.vue'
defineProps({ sheet: { type: Object, required: true } })
</script>

<template>
  <ScreenPlaceholder title="Gear" :detail="`${sheet.gear.weapons.length} weapons`" />
</template>
