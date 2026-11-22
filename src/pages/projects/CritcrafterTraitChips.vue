<script setup>
/** PROTOTYPE (throwaway): tiny PF2e trait chips for the bottom of a row. */
defineProps({ traits: { type: Array, default: () => [] } })
</script>

<template>
  <div v-if="traits && traits.length" class="traits">
    <span v-for="t in traits" :key="t" class="traits__chip">{{ t }}</span>
  </div>
</template>

<style scoped>
.traits { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.traits__chip { font-size: 10px; line-height: 1; letter-spacing: 0.04em; text-transform: uppercase; padding: 3px 7px; border-radius: 4px; background: var(--q-primary); color: rgba(255, 255, 255, 0.9); }
</style>
