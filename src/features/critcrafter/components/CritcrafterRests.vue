<script setup>
/**
 * Stats screen rest row (Refocus, 8 h, 24 h, Extended) plus Reset tracking. Each rest confirms with
 * a dialog that describes its effect; Reset tracking confirms before clearing the character's state.
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
  $q.dialog({ title: `${r.label} rest`, message: r.text, cancel: true, ok: 'Rest', dark: true }).onOk(() => {
    store.rest(r.kind)
    $q.notify({ message: `${r.label} rest done`, icon: 'bedtime', timeout: 1500 })
  })
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
    <div class="text-overline">Rest</div>
    <div class="row no-wrap q-gutter-xs">
      <q-btn
        v-for="r in RESTS"
        :key="r.kind"
        :icon="r.icon"
        :label="r.label"
        stack
        no-caps
        dense
        color="secondary"
        class="col cc-rest"
        :data-testid="`cc-rest-${r.kind}`"
        @click="rest(r)"
      />
    </div>
    <q-btn
      flat
      no-caps
      dense
      class="q-mt-md cc-reset"
      label="Reset tracking"
      icon="restart_alt"
      data-testid="cc-reset"
      @click="resetTracking"
    />
  </div>
</template>

<style scoped>
.cc-rest {
  min-height: 56px;
}
.cc-reset {
  min-height: 48px;
}
</style>
