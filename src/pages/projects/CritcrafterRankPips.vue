<script setup>
/** PROTOTYPE (throwaway): U T E M L proficiency ladder; the current rank gets a filled circle. */
defineProps({ rank: { type: String, default: 'U' } })
const RANKS = ['U', 'T', 'E', 'M', 'L']
</script>

<template>
  <span class="ranks">
    <span v-for="r in RANKS" :key="r" class="ranks__pip" :class="{ 'ranks__pip--on': r === rank }">{{ r }}</span>
  </span>
</template>

<style scoped>
.ranks { display: inline-flex; flex: none; gap: 2px; }
.ranks__pip { width: 26px; height: 26px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; color: var(--q-secondary); opacity: 0.6; }
.ranks__pip--on { background: var(--q-primary); color: #fff; opacity: 1; }
</style>
