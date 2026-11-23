<script setup>
/** U T E M L proficiency ladder in fixed 26px slots; the current rank gets a filled circle. */
import { computed } from 'vue'
import { rankLadder } from '../viewer/screenModel.js'

const props = defineProps({ rank: { type: String, default: 'U' } })
const pips = computed(() => rankLadder(props.rank))
</script>

<template>
  <span class="ranks">
    <span v-for="r in pips" :key="r.rank" class="ranks__pip" :class="{ 'ranks__pip--on': r.current }">{{ r.rank }}</span>
  </span>
</template>

<style scoped>
.ranks { display: inline-flex; flex: none; gap: 2px; }
.ranks__pip { width: 26px; height: 26px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; color: var(--q-secondary); opacity: 0.6; }
.ranks__pip--on { background: var(--q-primary); color: #fff; opacity: 1; }
</style>
