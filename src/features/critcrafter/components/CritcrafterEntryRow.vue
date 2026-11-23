<script setup>
/**
 * Chunky card row for any sheet entry (prototype `cc-card`): name, optional stat text, trait chips, cost glyph, qty.
 * Tapping the row emits `open` (item detail). Slots: `stats` (extra tap targets under the name, e.g. weapon
 * attack/damage chips, which must stop propagation) and `controls` (right side: equip, raise and consumed controls).
 */
import CritcrafterCostGlyph from './CritcrafterCostGlyph.vue'
import CritcrafterTraitChips from './CritcrafterTraitChips.vue'

defineProps({
  entry: { type: Object, required: true },
  statText: { type: String, default: '' },
  qty: { type: Number, default: 0 },
  showCost: { type: Boolean, default: true },
  /** Actions screen: bold name. */
  bold: { type: Boolean, default: false },
})
defineEmits(['open'])
</script>

<template>
  <div class="cc-card cc-card--tap q-mb-xs row no-wrap items-center" role="button" tabindex="0" data-testid="cc-entry-row" @click="$emit('open')" @keydown.enter="$emit('open')">
    <div class="col" style="min-width: 0">
      <div class="ellipsis" :class="{ 'text-weight-bold': bold }">
        {{ entry.name }}<span v-if="entry.count" class="text-grey-5"> ×{{ entry.count }}</span>
        <span v-if="entry.option" class="text-grey-5"> ({{ entry.option }})</span>
      </div>
      <div v-if="statText" class="text-grey-5 text-caption">{{ statText }}</div>
      <slot name="stats" />
      <CritcrafterTraitChips :traits="entry.traits" />
    </div>
    <span v-if="qty > 1" class="text-grey-5 text-caption q-mr-sm" data-testid="cc-qty">×{{ qty }}</span>
    <CritcrafterCostGlyph v-if="showCost" :cost="entry.cost" />
    <slot name="controls" />
  </div>
</template>
