<script setup>
/**
 * HP keypad bottom sheet: Damage, Heal, Temp HP, and (only while a shield is raised) Damage Shield
 * and Repair Shield. Apply emits `apply(mode, amount)` and closes. Rules live in table/tableState.js.
 */
import { computed, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  /** Mode to open on. */
  mode: { type: String, default: 'damage' },
  hp: { type: Number, required: true },
  maxHp: { type: Number, required: true },
  tempHp: { type: Number, default: 0 },
  /** Shield row data (store.shield) or null. */
  shield: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'apply'])

const active = ref(props.mode)
const digits = ref('')

const modes = computed(() => {
  const m = [
    { key: 'damage', label: 'Damage' },
    { key: 'heal', label: 'Heal' },
    { key: 'temp', label: 'Temp HP' },
  ]
  if (props.shield?.raised) {
    m.push({ key: 'shieldDamage', label: 'Damage Shield' }, { key: 'shieldRepair', label: 'Repair Shield' })
  }
  return m
})

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    digits.value = ''
    active.value = modes.value.some((m) => m.key === props.mode) ? props.mode : 'damage'
  },
)

const amount = computed(() => (digits.value ? Number(digits.value) : 0))

function press(d) {
  if (digits.value.length >= 4) return
  digits.value = digits.value === '0' ? d : digits.value + d
}
function back() {
  digits.value = digits.value.slice(0, -1)
}
function apply() {
  if (amount.value <= 0) return
  emit('apply', active.value, amount.value)
  emit('update:modelValue', false)
}
</script>

<template>
  <q-dialog
    :model-value="modelValue"
    position="bottom"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card class="cc-keypad" data-testid="cc-keypad">
      <q-card-section class="q-pb-none">
        <div class="text-subtitle1" data-testid="cc-keypad-status">
          HP {{ hp }} / {{ maxHp }}<span v-if="tempHp"> · Temp {{ tempHp }}</span>
          <span v-if="shield?.raised"> · Shield {{ shield.hp }} / {{ shield.max }}</span>
        </div>
        <div class="row q-gutter-xs q-mt-sm">
          <q-btn
            v-for="m in modes"
            :key="m.key"
            :label="m.label"
            :color="active === m.key ? 'primary' : 'secondary'"
            :data-testid="`cc-mode-${m.key}`"
            no-caps
            dense
            class="cc-mode"
            @click="active = m.key"
          />
        </div>
        <div class="cc-amount text-h4 text-center q-my-md" data-testid="cc-keypad-amount">
          {{ digits || '0' }}
        </div>
      </q-card-section>
      <q-card-section class="q-pt-none">
        <div class="cc-pad">
          <q-btn v-for="d in ['1', '2', '3', '4', '5', '6', '7', '8', '9']" :key="d" :label="d" class="cc-key" :data-testid="`cc-key-${d}`" @click="press(d)" />
          <q-btn icon="backspace" class="cc-key" aria-label="Backspace" data-testid="cc-key-back" @click="back" />
          <q-btn label="0" class="cc-key" data-testid="cc-key-0" @click="press('0')" />
          <q-btn label="Apply" color="primary" class="cc-key" :disable="amount <= 0" data-testid="cc-keypad-apply" @click="apply" />
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.cc-keypad {
  width: 100%;
  max-width: 420px;
  border-radius: 18px 18px 0 0;
}
.cc-mode {
  min-height: 40px;
}
.cc-pad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.cc-key {
  min-height: 56px;
  font-size: 20px;
}
</style>
