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
  if (props.shield?.raised && props.shield.max !== null) {
    m.push({ key: 'shieldDamage', label: 'Damage Shield' }, { key: 'shieldRepair', label: 'Repair Shield' })
  }
  return m
})

const toOption = (m) => ({ label: m.label, value: m.key, attrs: { 'data-testid': `cc-mode-${m.key}` } })
const mainModes = computed(() => modes.value.filter((m) => !m.key.startsWith('shield')).map(toOption))
const shieldModes = computed(() => modes.value.filter((m) => m.key.startsWith('shield')).map(toOption))

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
    <q-card class="cc-sheet" data-testid="cc-keypad">
      <q-card-section>
        <div class="text-caption text-grey-5 q-mb-xs" data-testid="cc-keypad-status">
          HP {{ hp }} / {{ maxHp }}<span v-if="tempHp"> · Temp {{ tempHp }}</span>
          <span v-if="shield?.raised && shield.max !== null"> · Shield {{ shield.hp }} / {{ shield.max }}</span>
        </div>
        <q-btn-toggle v-model="active" no-caps unelevated spread toggle-color="primary" color="dark" :options="mainModes" />
        <q-btn-toggle v-if="shieldModes.length" v-model="active" class="q-mt-xs" no-caps unelevated spread toggle-color="primary" color="dark" :options="shieldModes" />
        <div class="text-h3 text-center q-my-sm" style="min-height: 56px" data-testid="cc-keypad-amount">{{ digits || '0' }}</div>
        <div class="row q-col-gutter-xs">
          <div v-for="d in ['1', '2', '3', '4', '5', '6', '7', '8', '9']" :key="d" class="col-4">
            <q-btn class="full-width cc-key" unelevated :label="d" :data-testid="`cc-key-${d}`" @click="press(d)" />
          </div>
          <div class="col-4"><q-btn class="full-width cc-key" unelevated label="⌫" aria-label="Backspace" data-testid="cc-key-back" @click="back" /></div>
          <div class="col-4"><q-btn class="full-width cc-key" unelevated label="0" data-testid="cc-key-0" @click="press('0')" /></div>
          <div class="col-4"><q-btn class="full-width cc-key" unelevated color="primary" label="Apply" :disable="amount <= 0" data-testid="cc-keypad-apply" @click="apply" /></div>
        </div>
        <div class="text-caption text-grey-5 q-mt-sm">Damage hits temp HP first. Temp HP does not stack: highest wins. Treat Wounds etc.: enter the result as Heal. Shield damage and repair are entered as the exact HP change; repair caps at the shield's max HP.</div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
