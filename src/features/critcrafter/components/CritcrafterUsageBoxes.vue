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
const icon = (on) => (on ? 'check_box' : 'check_box_outline_blank')
</script>

<template>
  <button
    type="button"
    class="cc-pips row no-wrap items-center"
    data-testid="cc-usage"
    :aria-label="`${label}: ${used} of ${max} used. Tap to change.`"
    @click.stop="emit('cycle')"
  >
    <span v-if="compact" class="text-body1">
      <q-icon :name="icon(used > 0)" size="32px" :color="used > 0 ? 'white' : 'grey-6'" /> {{ used }} / {{ max }} used
    </span>
    <template v-else>
      <q-icon v-for="i in max" :key="i" :name="icon(i <= used)" size="32px" :color="i <= used ? 'white' : 'grey-6'" />
    </template>
  </button>
</template>
