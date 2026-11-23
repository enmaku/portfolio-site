<script setup>
/**
 * Minimal local breakdown sheet for a sheet Stat (value + breakdown rows + linked actions). Built so #503 can
 * wire tappable bonuses without touching #502's breakdown sheet; swap the import for the shared one when it lands.
 * Props: `title`, `stat` ({ value, breakdown[], actions? }).
 */
import { computed } from 'vue'
import { signed } from '../viewer/screenModel.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  stat: { type: Object, default: null },
  plain: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'open-action'])
const open = computed({ get: () => props.modelValue, set: (v) => emit('update:modelValue', v) })
const fmt = (n) => (props.plain ? String(n) : signed(n))
</script>

<template>
  <q-dialog v-model="open" position="bottom" data-testid="cc-stat-sheet">
    <q-card v-if="stat" class="cc-sheet">
      <q-card-section class="row items-baseline no-wrap">
        <div class="text-h6 col">{{ title }}</div>
        <div class="text-h4">{{ fmt(stat.value) }}</div>
      </q-card-section>
      <q-separator />
      <q-list>
        <q-item v-for="(b, i) in stat.breakdown" :key="i" dense>
          <q-item-section>{{ b.label }}</q-item-section>
          <q-item-section side><span class="cc-chip">{{ b.type }}</span></q-item-section>
          <q-item-section side class="cc-amt">{{ fmt(b.amount) }}</q-item-section>
        </q-item>
        <q-item dense class="text-weight-bold">
          <q-item-section>Total</q-item-section>
          <q-item-section side class="cc-amt">{{ fmt(stat.value) }}</q-item-section>
        </q-item>
        <q-item v-for="a in stat.actions || []" :key="a.key" clickable @click="$emit('open-action', a)">
          <q-item-section>{{ a.name }}</q-item-section>
        </q-item>
      </q-list>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.cc-sheet {
  width: 100%;
  max-width: 480px;
  max-height: 80vh;
  overflow: auto;
}
.cc-chip {
  font-size: 10px;
  text-transform: uppercase;
  color: var(--q-secondary);
}
.cc-amt {
  min-width: 40px;
  text-align: right;
}
</style>
