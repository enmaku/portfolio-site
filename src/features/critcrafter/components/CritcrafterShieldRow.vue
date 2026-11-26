<script setup>
/**
 * Tiny centred shield row for the topper (`extra` slot): name, raised/lowered, Hardness, HP n/max
 * (red and BROKEN at or below BT), BT. Tapping a raised shield opens the keypad (event `open`).
 * `shield` is the store getter `shield` (tableState.shieldView). Markup and styles follow the prototype.
 */
defineProps({ shield: { type: Object, required: true } })
const emit = defineEmits(['open'])
</script>

<template>
  <div
    class="cc-shield text-caption"
    :class="{ 'cc-shield--off': !shield.raised, 'cc-shield--tap': shield.raised }"
    data-testid="cc-shield-row"
    :role="shield.raised ? 'button' : undefined"
    :aria-label="`${shield.name}, ${shield.raised ? 'raised' : 'lowered'}`"
    @click="shield.raised && emit('open')"
  >
    <q-icon name="shield" size="14px" />
    {{ shield.name }} · {{ shield.raised ? (shield.acBonus === null ? 'raised' : `raised, +${shield.acBonus} AC`) : 'lowered' }} · Hardness {{ shield.hardness ?? '?' }} · HP
    <b :class="{ 'text-red-3': shield.broken }" data-testid="cc-shield-hp">{{ shield.hp ?? '?' }}</b>/{{ shield.max ?? '?' }} · BT {{ shield.bt ?? '?' }}<span v-if="shield.broken"> · BROKEN</span>
  </div>
</template>

<style scoped>
.cc-shield { min-height: 32px; font-size: 11px; margin-top: 6px; display: flex; align-items: center; justify-content: center; gap: 4px; opacity: 1; }
.cc-shield--tap { cursor: pointer; }
.cc-shield--off { opacity: 0.45; }
</style>
