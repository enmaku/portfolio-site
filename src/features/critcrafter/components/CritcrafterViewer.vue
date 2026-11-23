<script setup>
/**
 * Loaded viewer: pinned topper, scrolling screen area, floating bottom bar.
 * Extension points: SCREENS in ../screens/index.js (one component per tab key, each takes `sheet`),
 * and the `extra` slot of CritcrafterTopper (shield row; HP keypad and live AC from the table store, #504).
 */
import { computed, ref, watch } from 'vue'
import { useCritcrafterTableStore } from '../../../stores/critcrafterTable.js'
import './critcrafter.css'
import CritcrafterAbout from './CritcrafterAbout.vue'
import CritcrafterHpKeypad from './CritcrafterHpKeypad.vue'
import CritcrafterShieldRow from './CritcrafterShieldRow.vue'
import CritcrafterTopper from './CritcrafterTopper.vue'
import CritcrafterBottomBar from './CritcrafterBottomBar.vue'
import CritcrafterSheetHost from '../detail/CritcrafterSheetHost.vue'
import { SCREENS } from '../screens/index.js'
import { visibleTabs } from '../viewer/viewerModel.js'

const props = defineProps({
  sheet: { type: Object, required: true },
  /** Pathbuilder id: keys the table-state store. */
  id: { type: String, default: null },
})

const table = useCritcrafterTableStore()
watch(
  () => [props.sheet, props.id],
  () => table.open(props.id ?? 'local', props.sheet),
  { immediate: true },
)
const keypadOpen = ref(false)
const keypadMode = ref('damage')
function openKeypad(mode = 'damage') {
  keypadMode.value = mode
  keypadOpen.value = true
}
function applyHp(mode, amount) {
  table.applyHp(mode, amount)
}

const tabs = computed(() => visibleTabs(props.sheet))
const tab = ref('stats')
watch(tabs, (t) => {
  if (!t.some((x) => x.key === tab.value)) tab.value = 'stats'
})
const screen = computed(() => SCREENS[tab.value])
</script>

<template>
  <div class="cc-viewer column no-wrap col" data-testid="cc-viewer">
    <CritcrafterTopper :sheet="sheet" :hp="table.hp" :temp-hp="table.tempHp" :ac-stat="table.ac" @open-hp="openKeypad()">
      <template #extra>
        <CritcrafterShieldRow v-if="table.shield" :shield="table.shield" @open="openKeypad('shieldDamage')" />
      </template>
    </CritcrafterTopper>
    <CritcrafterHpKeypad
      v-model="keypadOpen"
      :mode="keypadMode"
      :hp="table.hp"
      :max-hp="table.maxHp"
      :temp-hp="table.tempHp"
      :shield="table.shield"
      @apply="applyHp"
    />
    <div class="cc-scroll col scroll q-px-sm q-pb-sm" data-testid="cc-screen">
      <component :is="screen" :sheet="sheet" />
      <CritcrafterAbout />
    </div>
    <CritcrafterBottomBar v-model="tab" :tabs="tabs" />
    <CritcrafterSheetHost />
  </div>
</template>

<style scoped>
/* Topper and bottom bar are fixed (flex: none); only .cc-scroll, between them, scrolls. */
.cc-viewer {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}
.cc-scroll {
  flex: 1 1 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
</style>
