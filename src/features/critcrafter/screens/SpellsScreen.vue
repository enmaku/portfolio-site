<script setup>
/**
 * Spells: per caster then rank (header with tradition, DC, attack), one Focus section across casters, Rituals last.
 * Rows open spell detail; scroll/wand `linked[]` spells show in that detail. Slot/focus usage controls are #504's.
 */
import { computed, ref } from 'vue'
import CritcrafterEntryRow from '../components/CritcrafterEntryRow.vue'
import CritcrafterEntrySheet from '../components/CritcrafterEntrySheet.vue'
import CritcrafterStatSheet from '../components/CritcrafterStatSheet.vue'
import CritcrafterTapStat from '../components/CritcrafterTapStat.vue'
import { signed, spellsView } from '../viewer/screenModel.js'

const props = defineProps({ sheet: { type: Object, required: true } })
const view = computed(() => spellsView(props.sheet.spells))
const isEmpty = computed(() => view.value.casters.length === 0 && !view.value.focus && view.value.rituals.length === 0)

const entryOpen = ref(false)
const entry = ref(null)
const statOpen = ref(false)
const stat = ref({ title: '', stat: null })
function openEntry(e) {
  entry.value = e
  entryOpen.value = true
}
function openStat(title, s) {
  stat.value = { title, stat: s }
  statOpen.value = true
}
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
          <CritcrafterTapStat :text="String(c.dc.value)" @tap="openStat(`${c.name} spell DC`, c.dc)" />
        </template>
        <template v-if="c.attack">
          <span class="cc-muted q-ml-md">Attack</span>
          <CritcrafterTapStat :text="signed(c.attack.value)" @tap="openStat(`${c.name} spell attack`, c.attack)" />
        </template>
      </div>
      <q-expansion-item v-for="r in c.ranks" :key="r.rank" default-opened :label="r.label" :caption="r.slots != null ? `${r.slots} slots` : 'at will'" header-class="cc-group">
        <CritcrafterEntryRow v-for="e in r.entries" :key="e.key" :entry="e" @open="openEntry(e)" />
      </q-expansion-item>
    </section>

    <section v-if="view.focus" class="q-mb-md" data-testid="cc-focus">
      <div class="cc-label">Focus · {{ view.focus.pool }} {{ view.focus.pool === 1 ? 'point' : 'points' }}</div>
      <div v-if="view.focus.dc || view.focus.attack" class="row items-center">
        <template v-if="view.focus.dc">
          <span class="cc-muted">DC</span>
          <CritcrafterTapStat :text="String(view.focus.dc.value)" @tap="openStat('Focus spell DC', view.focus.dc)" />
        </template>
        <template v-if="view.focus.attack">
          <span class="cc-muted q-ml-md">Attack</span>
          <CritcrafterTapStat :text="signed(view.focus.attack.value)" @tap="openStat('Focus spell attack', view.focus.attack)" />
        </template>
      </div>
      <!-- #504 hook point: focus point boxes. -->
      <CritcrafterEntryRow v-for="e in view.focus.entries" :key="e.key" :entry="e" @open="openEntry(e)" />
    </section>

    <section v-if="view.rituals.length" data-testid="cc-rituals">
      <div class="cc-label">Rituals</div>
      <CritcrafterEntryRow v-for="e in view.rituals" :key="e.key" :entry="e" @open="openEntry(e)" />
    </section>

    <CritcrafterEntrySheet v-model="entryOpen" :entry="entry" />
    <CritcrafterStatSheet v-model="statOpen" :title="stat.title" :stat="stat.stat" />
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
