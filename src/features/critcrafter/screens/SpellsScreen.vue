<script setup>
/**
 * Spells: per caster then rank (header with tradition, DC, attack), one Focus section across casters, Rituals last.
 * Rows open spell detail (scroll/wand `linked[]` spells show there). Slot and focus usage boxes in the headers
 * tap-to-cycle through the table store (#504); cantrips show "at will".
 */
import { computed } from 'vue'
import { useCritcrafterTableStore } from '../../../stores/critcrafterTable.js'
import CritcrafterEntryRow from '../components/CritcrafterEntryRow.vue'
import CritcrafterUsageBoxes from '../components/CritcrafterUsageBoxes.vue'
import StatNumber from '../detail/StatNumber.vue'
import { openDetail } from '../detail/sheetStack.js'
import { focusUsage, slotUsage } from '../table/tableView.js'
import { spellsView } from '../viewer/screenModel.js'

const props = defineProps({ sheet: { type: Object, required: true } })
const table = useCritcrafterTableStore()
const view = computed(() => spellsView(props.sheet.spells))
const isEmpty = computed(() => view.value.casters.length === 0 && !view.value.focus && view.value.rituals.length === 0)
const ready = computed(() => table.sheet === props.sheet && table.table !== null)
const slots = (c, r) => (ready.value ? slotUsage(props.sheet, table.table, c.key, r.rank) : null)
const focus = computed(() => (ready.value ? focusUsage(props.sheet, table.table) : null))
const tradition = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : '')
</script>

<template>
  <div class="q-pt-md" data-testid="cc-screen-spells">
    <div v-if="isEmpty" class="text-body2 cc-muted" data-testid="cc-empty">No spells in this build</div>

    <section v-for="c in view.casters" :key="c.key" class="q-mb-md" data-testid="cc-caster">
      <div class="cc-label">{{ c.name }}<span v-if="c.tradition"> · {{ tradition(c.tradition) }}</span></div>
      <div v-if="c.dc || c.attack" class="row items-center">
        <template v-if="c.dc">
          <span class="cc-muted">DC</span>
          <StatNumber :target="{ label: `${c.name} spell DC`, stat: c.dc, signed: false }" />
        </template>
        <template v-if="c.attack">
          <span class="cc-muted q-ml-md">Attack</span>
          <StatNumber :target="{ label: `${c.name} spell attack`, stat: c.attack }" />
        </template>
      </div>
      <q-expansion-item v-for="r in c.ranks" :key="r.rank" default-opened header-class="cc-group">
        <template #header>
          <q-item-section>
            <q-item-label>{{ r.label }}</q-item-label>
            <q-item-label v-if="!slots(c, r)" caption>{{ r.rank === 0 ? 'at will' : r.slots != null ? `${r.slots} slots` : '' }}</q-item-label>
          </q-item-section>
          <q-item-section v-if="slots(c, r)" side data-testid="cc-slots">
            <CritcrafterUsageBoxes :used="slots(c, r).used" :max="slots(c, r).max" label="slots" @cycle="table.cycleSlot(slots(c, r).key)" />
          </q-item-section>
        </template>
        <CritcrafterEntryRow v-for="e in r.entries" :key="e.key" :entry="e" @open="openDetail(e)" />
      </q-expansion-item>
    </section>

    <section v-if="view.focus" class="q-mb-md" data-testid="cc-focus">
      <div class="cc-label">Focus · {{ view.focus.pool }} {{ view.focus.pool === 1 ? 'point' : 'points' }}</div>
      <div v-if="view.focus.dc || view.focus.attack" class="row items-center">
        <template v-if="view.focus.dc">
          <span class="cc-muted">DC</span>
          <StatNumber :target="{ label: 'Focus spell DC', stat: view.focus.dc, signed: false }" />
        </template>
        <template v-if="view.focus.attack">
          <span class="cc-muted q-ml-md">Attack</span>
          <StatNumber :target="{ label: 'Focus spell attack', stat: view.focus.attack }" />
        </template>
      </div>
      <div v-if="focus && focus.max > 0" class="row items-center" data-testid="cc-focus-boxes">
        <span class="cc-muted">Used</span>
        <CritcrafterUsageBoxes :used="focus.used" :max="focus.max" label="focus points" @cycle="table.cycleFocus()" />
      </div>
      <CritcrafterEntryRow v-for="e in view.focus.entries" :key="e.key" :entry="e" @open="openDetail(e)" />
    </section>

    <section v-if="view.rituals.length" data-testid="cc-rituals">
      <div class="cc-label">Rituals</div>
      <CritcrafterEntryRow v-for="e in view.rituals" :key="e.key" :entry="e" @open="openDetail(e)" />
    </section>

  </div>
</template>

<style scoped>
.cc-muted {
  color: var(--q-secondary);
}
.cc-label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 11px;
  color: var(--q-secondary);
  margin-bottom: 4px;
}
:deep(.cc-group) {
  min-height: 52px;
}
</style>
