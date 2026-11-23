<script setup>
/** PROTOTYPE (throwaway): PF2e action-cost glyphs from SoT card templates. `cost` e.g. ['single'], ['single','to','three']. */
import single from 'assets/critcrafter-prototype/action-single.png'
import two from 'assets/critcrafter-prototype/action-two.png'
import three from 'assets/critcrafter-prototype/action-three.png'
import reaction from 'assets/critcrafter-prototype/action-reaction.png'
import free from 'assets/critcrafter-prototype/action-free.png'

defineProps({ cost: { type: Array, default: () => [] } })
const SRC = { single, two, three, reaction, free }
</script>

<template>
  <span class="cost">
    <template v-for="(k, i) in cost" :key="i">
      <img v-if="SRC[k]" :src="SRC[k]" class="cost__img" alt="" />
      <span v-else class="cost__to">{{ k }}</span>
    </template>
  </span>
</template>

<style scoped>
.cost { display: inline-flex; align-items: center; gap: 4px; flex: none; }
.cost__img { height: 18px; width: auto; filter: invert(0.85); }
.cost__to { font-size: 11px; color: var(--q-secondary); }
</style>
