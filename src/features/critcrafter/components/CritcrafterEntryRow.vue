<script setup>
/**
 * Chunky row for any sheet entry: name, optional stat text, trait chips, cost glyph, qty.
 * Tapping the row emits `open` (item detail). Slots: `stats` (extra tap targets under the name, e.g. weapon
 * attack/damage chips, which must stop propagation) and `controls` (right side; the #504 store renders
 * equip/raise/consumed controls there).
 */
import CritcrafterCostGlyph from './CritcrafterCostGlyph.vue'
import CritcrafterTraitChips from './CritcrafterTraitChips.vue'

defineProps({
  entry: { type: Object, required: true },
  statText: { type: String, default: '' },
  qty: { type: Number, default: 0 },
  showCost: { type: Boolean, default: true },
})
defineEmits(['open'])
</script>

<template>
  <div class="cc-row row items-center no-wrap q-py-xs cursor-pointer" role="button" tabindex="0" data-testid="cc-entry-row" @click="$emit('open')" @keydown.enter="$emit('open')">
    <div class="col">
      <div class="cc-row__name">
        {{ entry.name }}<span v-if="entry.count" class="cc-muted"> ×{{ entry.count }}</span>
        <span v-if="entry.option" class="cc-muted"> ({{ entry.option }})</span>
      </div>
      <div v-if="statText" class="text-body2 cc-muted">{{ statText }}</div>
      <slot name="stats" />
      <CritcrafterTraitChips :traits="entry.traits" />
    </div>
    <div class="row items-center no-wrap q-gutter-x-sm q-ml-sm">
      <span v-if="qty > 1" class="cc-muted" data-testid="cc-qty">×{{ qty }}</span>
      <CritcrafterCostGlyph v-if="showCost" :cost="entry.cost" />
      <!-- #504 hook point: equip / raise / consumed-box controls render here. -->
      <slot name="controls" />
    </div>
  </div>
</template>

<style scoped>
.cc-row {
  min-height: 52px;
}
.cc-row__name {
  font-size: 16px;
}
.cc-muted {
  color: var(--q-secondary);
}
</style>
