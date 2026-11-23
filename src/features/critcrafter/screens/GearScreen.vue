<script setup>
/**
 * Gear: tappable "Bulk n / limit", then Weapons, Shields, Armor, Consumables, Gear groups. Read-only for now;
 * #504's store renders equip / raise / consumed controls through the `controls` slot of CritcrafterEntryRow
 * (marked hook points below). Weapon attack and damage chips open breakdowns; the rest of a row opens item detail.
 */
import { computed, ref } from 'vue'
import CritcrafterEntryRow from '../components/CritcrafterEntryRow.vue'
import CritcrafterEntrySheet from '../components/CritcrafterEntrySheet.vue'
import CritcrafterStatSheet from '../components/CritcrafterStatSheet.vue'
import CritcrafterTapStat from '../components/CritcrafterTapStat.vue'
import { bulkLine, gearGroupsView, signed } from '../viewer/screenModel.js'

const props = defineProps({ sheet: { type: Object, required: true } })

const groups = computed(() => gearGroupsView(props.sheet.gear))

const entryOpen = ref(false)
const entry = ref(null)
const statOpen = ref(false)
const stat = ref({ title: '', stat: null, plain: false })

function openEntry(e) {
  entry.value = e
  entryOpen.value = true
}
function openStat(title, s, plain = false) {
  stat.value = { title, stat: s, plain }
  statOpen.value = true
}
function damageText(w) {
  const b = w.damage.bonus.value
  return `${w.damage.dice}${b === 0 ? '' : b < 0 ? `−${Math.abs(b)}` : `+${b}`}`
}
function statText(group, e) {
  if (group === 'shields') return `+${e.acBonus.value} AC · Hardness ${e.hardness} · HP ${e.hp} · BT ${e.bt}`
  if (group === 'armor') return `AC ${e.acTotal.value}`
  return ''
}
</script>

<template>
  <div class="q-pt-md" data-testid="cc-screen-gear">
    <div class="row items-center no-wrap" data-testid="cc-bulk">
      <CritcrafterTapStat :text="bulkLine(sheet.gear.bulk)" class="text-left" @tap="openStat('Bulk', sheet.gear.bulk, true)" />
    </div>
    <div v-if="groups.length === 0" class="text-body2 cc-muted" data-testid="cc-empty">No gear in this build</div>
    <q-expansion-item v-for="g in groups" :key="g.id" default-opened :label="g.label" :caption="String(g.count)" header-class="cc-group" data-testid="cc-gear-group">
      <CritcrafterEntryRow
        v-for="e in g.entries"
        :key="e.key"
        :entry="e"
        :qty="e.qty"
        :stat-text="statText(g.id, e)"
        :show-cost="false"
        @open="openEntry(e)"
      >
        <template v-if="g.id === 'weapons'" #stats>
          <div class="row items-center q-gutter-x-md">
            <CritcrafterTapStat :text="signed(e.attack.value)" data-chip="attack" @tap="openStat(`${e.name} attack`, e.attack)" />
            <CritcrafterTapStat :text="damageText(e)" data-chip="damage" @tap="openStat(`${e.name} damage`, e.damage.bonus)" />
          </div>
        </template>
        <!-- #504 hook point: equip toggles (weapons, shields, armor), raise shield and consumed boxes (consumables). -->
        <template #controls />
      </CritcrafterEntryRow>
    </q-expansion-item>
    <CritcrafterEntrySheet v-model="entryOpen" :entry="entry" />
    <CritcrafterStatSheet v-model="statOpen" :title="stat.title" :stat="stat.stat" :plain="stat.plain" />
  </div>
</template>

<style scoped>
.cc-muted {
  color: var(--q-secondary);
}
:deep(.cc-group) {
  min-height: 52px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 12px;
}
</style>
