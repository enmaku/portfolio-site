<script setup>
/**
 * A tappable derived number: opens the shared breakdown sheet. Number-only 48px target with a dotted
 * underline as the only affordance. Reuse anywhere a Stat is shown:
 *   <StatNumber :target="{ label: 'Athletics', stat: skill.bonus, signed: true }" />
 * Default slot overrides the text (default is the signed or flat value).
 */
import { computed } from 'vue'
import { formatAmount } from './breakdownModel.js'
import { openBreakdown } from './sheetStack.js'

const props = defineProps({
  /** `{ label, stat, signed? }`: sheet title, the Stat, and whether the total is shown as +n. */
  target: { type: Object, required: true },
})
const text = computed(() => formatAmount(props.target.stat.value, props.target.signed !== false))
</script>

<template>
  <button
    type="button"
    class="cc-statnum"
    :data-testid="`cc-stat-${target.label}`"
    :aria-label="`${target.label} ${text}, show breakdown`"
    @click.stop="openBreakdown(target)"
  >
    <span class="cc-statnum__v"><slot>{{ text }}</slot></span>
  </button>
</template>

<style scoped>
.cc-statnum {
  background: none;
  border: 0;
  color: inherit;
  font: inherit;
  min-width: 48px;
  min-height: 48px;
  padding: 0 4px;
  cursor: pointer;
}
.cc-statnum__v {
  border-bottom: 2px dotted currentColor;
}
</style>
