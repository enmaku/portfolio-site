<script setup>
/**
 * Tiny centred shield row for the topper (`extra` slot): name, raised/lowered, Hardness, HP n/max
 * (red and BROKEN at or below BT), BT. Tapping a raised shield opens the keypad (event `open`).
 * `shield` is the store getter `shield` (tableState.shieldView).
 */
defineProps({ shield: { type: Object, required: true } })
const emit = defineEmits(['open'])
</script>

<template>
  <button
    type="button"
    class="cc-shield row items-center justify-center no-wrap text-caption"
    :class="{ lowered: !shield.raised }"
    data-testid="cc-shield-row"
    :aria-label="`${shield.name}, ${shield.raised ? 'raised' : 'lowered'}`"
    @click="shield.raised && emit('open')"
  >
    <q-icon name="shield" size="16px" class="q-mr-xs" />
    <span class="ellipsis cc-name">{{ shield.name }}</span>
    <span class="q-mx-xs">{{ shield.raised ? (shield.acBonus === null ? 'raised' : `raised, +${shield.acBonus} AC`) : 'lowered' }}</span>
    <span class="q-mx-xs">Hardness {{ shield.hardness ?? '?' }}</span>
    <span class="q-mx-xs" :class="{ broken: shield.broken }" data-testid="cc-shield-hp">
      HP {{ shield.hp ?? '?' }}/{{ shield.max ?? '?' }}<template v-if="shield.broken"> BROKEN</template>
    </span>
    <span class="q-ml-xs">BT {{ shield.bt ?? '?' }}</span>
  </button>
</template>

<style scoped>
.cc-shield {
  width: 100%;
  min-height: 28px;
  margin-top: 8px;
  background: none;
  border: 0;
  color: inherit;
  white-space: nowrap;
}
.cc-shield.lowered {
  opacity: 0.6;
}
.cc-name {
  min-width: 0;
  flex: 0 1 auto;
}
.broken {
  color: #ff8a80;
  font-weight: 600;
}
</style>
