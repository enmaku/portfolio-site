<script setup>
/** Action-cost glyph(s) for a sheet cost: single/two/three/reaction/free, or a range. Time costs show their label. */
import { computed } from 'vue'
import single from 'assets/critcrafter-prototype/action-single.png'
import two from 'assets/critcrafter-prototype/action-two.png'
import three from 'assets/critcrafter-prototype/action-three.png'
import reaction from 'assets/critcrafter-prototype/action-reaction.png'
import free from 'assets/critcrafter-prototype/action-free.png'
import { costGlyphs, costLabel } from '../viewer/screenModel.js'

const props = defineProps({ cost: { type: Object, default: null } })
const SRC = { single, two, three, reaction, free }
const glyphs = computed(() => costGlyphs(props.cost))
const label = computed(() => costLabel(props.cost))
const NAMES = { single: '1 action', two: '2 actions', three: '3 actions', reaction: 'Reaction', free: 'Free action' }
</script>

<template>
  <span v-if="glyphs" class="cc-cost" data-testid="cc-cost">
    <template v-for="(k, i) in glyphs" :key="i">
      <img v-if="SRC[k]" :src="SRC[k]" class="cc-cost__img" :alt="NAMES[k]" />
      <span v-else class="cc-cost__to">to</span>
    </template>
  </span>
  <span v-else-if="label" class="cc-cost__time">{{ label }}</span>
</template>

<style scoped>
.cc-cost {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
}
.cc-cost__img {
  height: 18px;
  width: auto;
  filter: invert(0.85);
}
.cc-cost__to,
.cc-cost__time {
  font-size: 11px;
  color: var(--q-secondary);
}
</style>
