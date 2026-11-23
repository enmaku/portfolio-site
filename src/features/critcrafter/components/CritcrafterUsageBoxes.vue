<script setup>
/**
 * Tap-to-cycle usage boxes (spell slots, focus, consumables): one big tap target, 0..max used then
 * reset (the store's cycle* actions do the cycling; this emits `cycle`). More than 5 units show one
 * box and "k / n used". Used by Spells and Gear.
 */
import { computed } from 'vue'

const props = defineProps({
  used: { type: Number, default: 0 },
  max: { type: Number, required: true },
  label: { type: String, default: 'uses' },
})
const emit = defineEmits(['cycle'])

const compact = computed(() => props.max > 5)
const boxes = computed(() => Array.from({ length: props.max }, (_, i) => i < props.used))
</script>

<template>
  <button
    type="button"
    class="cc-usage row items-center no-wrap"
    data-testid="cc-usage"
    :aria-label="`${label}: ${used} of ${max} used. Tap to change.`"
    @click.stop="emit('cycle')"
  >
    <template v-if="compact">
      <span class="cc-box" :class="{ on: used > 0 }" />
      <span class="text-caption q-ml-xs">{{ used }} / {{ max }} used</span>
    </template>
    <template v-else>
      <span v-for="(on, i) in boxes" :key="i" class="cc-box" :class="{ on }" />
    </template>
  </button>
</template>

<style scoped>
.cc-usage {
  min-height: 48px;
  min-width: 48px;
  padding: 0 4px;
  background: none;
  border: 0;
  color: inherit;
  gap: 4px;
}
.cc-box {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 2px solid currentColor;
  opacity: 0.8;
}
.cc-box.on {
  background: currentColor;
}
</style>
