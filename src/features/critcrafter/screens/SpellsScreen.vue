<script setup>
/**
 * Spells: per caster (collapsible) then rank (header with tradition; DC and attack live on the Stats screen), one Focus section across casters, Rituals last.
 * Rows open spell detail (scroll/wand `linked[]` spells show there). Slot and focus usage boxes in the headers
 * tap-to-cycle through the table store (#504); cantrips show "at will".
 */
import { computed } from 'vue'
import { useCritcrafterTableStore } from '../../../stores/critcrafterTable.js'
import CritcrafterEntryRow from '../components/CritcrafterEntryRow.vue'
import CritcrafterUsageBoxes from '../components/CritcrafterUsageBoxes.vue'
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
const casterLabel = (c) => (c.tradition ? `${c.name} · ${tradition(c.tradition)}` : c.name)
</script>

<template>
  <div data-testid="cc-screen-spells">
    <div v-if="isEmpty" class="text-body2 cc-muted" data-testid="cc-empty">No spells in this build</div>

    <section v-for="c in view.casters" :key="c.key" data-testid="cc-caster">
      <q-expansion-item default-opened dark expand-separator class="cc-exp cc-exp--caster" header-class="cc-exp-head" :label="casterLabel(c)">
        <q-expansion-item v-for="r in c.ranks" :key="r.rank" default-opened dark expand-separator class="cc-exp" header-class="cc-exp-head">
          <template #header>
            <q-item-section>{{ r.label }}</q-item-section>
            <q-item-section v-if="slots(c, r)" side data-testid="cc-slots">
              <CritcrafterUsageBoxes :used="slots(c, r).used" :max="slots(c, r).max" label="slots" @cycle="table.cycleSlot(slots(c, r).key)" />
            </q-item-section>
            <q-item-section v-else side>
              <span class="text-caption text-grey-5">{{ r.rank === 0 ? 'at will' : r.slots != null ? `${r.slots} slots` : '' }}</span>
            </q-item-section>
          </template>
          <CritcrafterEntryRow v-for="e in r.entries" :key="e.key" :entry="e" @open="openDetail(e)" />
        </q-expansion-item>
      </q-expansion-item>
    </section>

    <section v-if="view.focus" data-testid="cc-focus">
      <q-expansion-item default-opened dark expand-separator class="cc-exp" header-class="cc-exp-head">
        <template #header>
          <q-item-section>Focus ({{ view.focus.pool }} {{ view.focus.pool === 1 ? 'pt' : 'pts' }})</q-item-section>
          <q-item-section v-if="focus && focus.max > 0" side data-testid="cc-focus-boxes">
            <CritcrafterUsageBoxes :used="focus.used" :max="focus.max" label="focus points" @cycle="table.cycleFocus()" />
          </q-item-section>
        </template>
        <CritcrafterEntryRow v-for="e in view.focus.entries" :key="e.key" :entry="e" @open="openDetail(e)" />
      </q-expansion-item>
    </section>

    <section v-if="view.rituals.length" data-testid="cc-rituals">
      <q-expansion-item default-opened dark expand-separator class="cc-exp" header-class="cc-exp-head" label="Rituals" :caption="String(view.rituals.length)">
        <CritcrafterEntryRow v-for="e in view.rituals" :key="e.key" :entry="e" @open="openDetail(e)" />
      </q-expansion-item>
    </section>
  </div>
</template>

<style scoped>
.cc-muted {
  color: var(--q-secondary);
}
</style>
