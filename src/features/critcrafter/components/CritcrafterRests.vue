<script setup>
/**
 * Stats screen rest row (Refocus, 8 h, 24 h, Extended) plus Reset tracking. Rests apply immediately
 * and announce their effect in a toast (no per-rest prompt, SPEC "Table tracking"); only Reset tracking
 * confirms before clearing the character's state.
 * Rules: table/tableState.js `rest`. Reads and writes the table store.
 */
import { useQuasar } from 'quasar'
import { useCritcrafterTableStore } from '../../../stores/critcrafterTable.js'

const $q = useQuasar()
const store = useCritcrafterTableStore()

const RESTS = [
  { kind: 'refocus', label: 'Refocus', icon: 'self_improvement', text: 'Spend 10 minutes: regain 1 focus point.' },
  { kind: '8h', label: '8 h', icon: 'bedtime', text: 'Regain Con modifier + 1 HP, refill spell slots and focus, clear temp HP.' },
  { kind: '24h', label: '24 h', icon: 'hotel', text: 'Regain twice that HP, refill spell slots and focus, clear temp HP.' },
  { kind: 'extended', label: 'Extended', icon: 'night_shelter', text: 'A week of downtime: full HP, refill spell slots and focus, clear temp HP.' },
]

function rest(r) {
  store.rest(r.kind)
  $q.notify({ message: `${r.label}: ${r.text}`, icon: r.icon, timeout: 2500 })
}

function resetTracking() {
  $q.dialog({
    title: 'Reset tracking',
    message: 'Clear HP, slots, focus, consumables, equipment and shield state for this character?',
    cancel: true,
    ok: { label: 'Reset', color: 'negative' },
    dark: true,
  }).onOk(() => store.resetTracking())
}
</script>

<template>
  <div data-testid="cc-rests">
    <div class="cc-label">Rest</div>
    <div class="row no-wrap cc-rests q-mb-sm">
      <q-btn
        v-for="r in RESTS"
        :key="r.kind"
        unelevated
        no-caps
        dense
        class="cc-step cc-rest col"
        :label="r.label"
        :data-testid="`cc-rest-${r.kind}`"
        @click="rest(r)"
      />
    </div>
    <q-btn flat no-caps dense class="cc-reset" label="Reset tracking" icon="restart_alt" data-testid="cc-reset" @click="resetTracking" />
  </div>
</template>

<style scoped>
.cc-reset {
  min-height: 48px;
}
</style>
