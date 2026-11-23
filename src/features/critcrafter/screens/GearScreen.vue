<script setup>
/**
 * Gear: tappable "Bulk n / limit", then Weapons, Shields, Armor, Consumables, Gear groups. Equip, grip,
 * raise and consumed controls live in the row `controls` slot and drive the table store (#504); weapon
 * attack and damage chips open breakdowns, the rest of a row opens item detail (shared sheet host).
 */
import { computed } from 'vue'
import { useQuasar } from 'quasar'
import { useCritcrafterTableStore } from '../../../stores/critcrafterTable.js'
import CritcrafterEntryRow from '../components/CritcrafterEntryRow.vue'
import CritcrafterUsageBoxes from '../components/CritcrafterUsageBoxes.vue'
import StatNumber from '../detail/StatNumber.vue'
import { openDetail } from '../detail/sheetStack.js'
import { armorControl, consumableUsage, handsLabel, shieldControl, weaponControl } from '../table/tableView.js'
import { bulkLine, damageText, gearGroupsView, signed } from '../viewer/screenModel.js'

const props = defineProps({ sheet: { type: Object, required: true } })

const $q = useQuasar()
const table = useCritcrafterTableStore()
const groups = computed(() => gearGroupsView(props.sheet.gear))
const state = computed(() => table.table)
const ready = computed(() => table.sheet === props.sheet && state.value !== null)

const caption = (g) => (g.id === 'weapons' && ready.value ? `${g.count} · ${handsLabel(props.sheet, state.value)}` : String(g.count))
const weapon = (e) => weaponControl(props.sheet, state.value, e.key)
const armor = (e) => armorControl(state.value, e.key)
const shield = (e) => shieldControl(state.value, e.key)
const usage = (e) => consumableUsage(props.sheet, state.value, e.key)

/** Run a store action and toast whatever it moved ("Put away sword"). */
function act(fn) {
  for (const message of fn()) $q.notify({ message, icon: 'backpack', timeout: 1800 })
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
      <StatNumber :target="{ label: 'Bulk', stat: sheet.gear.bulk, signed: false }">{{ bulkLine(sheet.gear.bulk) }}</StatNumber>
    </div>
    <div v-if="groups.length === 0" class="text-body2 cc-muted" data-testid="cc-empty">No gear in this build</div>
    <q-expansion-item v-for="g in groups" :key="g.id" default-opened :label="g.label" :caption="caption(g)" header-class="cc-group" data-testid="cc-gear-group">
      <CritcrafterEntryRow
        v-for="e in g.entries"
        :key="e.key"
        :entry="e"
        :qty="e.qty"
        :stat-text="statText(g.id, e)"
        :show-cost="false"
        @open="openDetail(e)"
      >
        <template v-if="g.id === 'weapons'" #stats>
          <div class="row items-center q-gutter-x-md">
            <StatNumber :target="{ label: `${e.name} attack`, stat: e.attack }" data-chip="attack">{{ signed(e.attack.value) }}</StatNumber>
            <StatNumber :target="{ label: `${e.name} damage`, stat: e.damage.bonus }" data-chip="damage">{{ damageText(e) }}</StatNumber>
          </div>
        </template>
        <template v-if="ready" #controls>
          <template v-if="g.id === 'weapons'">
            <q-btn
              v-if="weapon(e).versatile"
              flat
              dense
              no-caps
              icon-right="swap_horiz"
              :label="`${weapon(e).hands}h`"
              class="cc-ctl cc-grip"
              :aria-label="`${e.name}: ${weapon(e).hands} hands, tap to switch grip`"
              data-testid="cc-grip"
              @click.stop="act(() => table.toggleGrip(e.key))"
            />
            <span v-else class="cc-hands" data-testid="cc-hands">{{ weapon(e).hands }}h</span>
            <q-btn
              flat
              round
              icon="gavel"
              class="cc-ctl"
              :class="{ 'cc-off': !weapon(e).held }"
              :aria-pressed="weapon(e).held"
              :aria-label="`${weapon(e).held ? 'Put away' : 'Hold'} ${e.name}`"
              data-testid="cc-hold"
              @click.stop="act(() => table.toggleWeapon(e.key))"
            />
          </template>
          <template v-else-if="g.id === 'shields'">
            <q-btn
              flat
              round
              icon="front_hand"
              class="cc-ctl"
              :class="{ 'cc-off': !shield(e).raised }"
              :disable="!shield(e).canRaise"
              :aria-pressed="shield(e).raised"
              :aria-label="`${shield(e).raised ? 'Lower' : 'Raise'} ${e.name}`"
              data-testid="cc-raise"
              @click.stop="act(() => table.setShieldRaised(!shield(e).raised))"
            />
            <q-btn
              flat
              round
              icon="shield"
              class="cc-ctl"
              :class="{ 'cc-off': !shield(e).equipped }"
              :aria-pressed="shield(e).equipped"
              :aria-label="`${shield(e).equipped ? 'Unequip' : 'Equip'} ${e.name}`"
              data-testid="cc-equip-shield"
              @click.stop="act(() => table.toggleShield(e.key))"
            />
          </template>
          <q-btn
            v-else-if="g.id === 'armor'"
            flat
            round
            icon="checkroom"
            class="cc-ctl"
            :class="{ 'cc-off': !armor(e).worn }"
            :aria-pressed="armor(e).worn"
            :aria-label="`${armor(e).worn ? 'Take off' : 'Wear'} ${e.name}`"
            data-testid="cc-wear"
            @click.stop="act(() => table.toggleArmor(e.key))"
          />
          <CritcrafterUsageBoxes
            v-else-if="g.id === 'consumables'"
            :used="usage(e).used"
            :max="usage(e).max"
            label="consumed"
            @cycle="act(() => table.cycleConsumable(e.key))"
          />
        </template>
      </CritcrafterEntryRow>
    </q-expansion-item>
  </div>
</template>

<style scoped>
.cc-muted {
  color: var(--q-secondary);
}
.cc-ctl {
  min-width: 48px;
  min-height: 48px;
}
.cc-off {
  opacity: 0.4;
}
.cc-hands {
  font-size: 12px;
  color: var(--q-secondary);
}
:deep(.cc-group) {
  min-height: 52px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 12px;
}
</style>
