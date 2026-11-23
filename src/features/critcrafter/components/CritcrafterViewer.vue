<script setup>
/**
 * Loaded viewer: pinned topper, scrolling screen area, floating bottom bar.
 * Extension points: SCREENS in ../screens/index.js (one component per tab key, each takes `sheet`),
 * and the `topper-extra` slot of CritcrafterTopper (shield row, live AC, HP keypad: #503/#504).
 */
import { computed, ref, watch } from 'vue'
import CritcrafterTopper from './CritcrafterTopper.vue'
import CritcrafterBottomBar from './CritcrafterBottomBar.vue'
import CritcrafterSheetHost from '../detail/CritcrafterSheetHost.vue'
import { SCREENS } from '../screens/index.js'
import { visibleTabs } from '../viewer/viewerModel.js'

const props = defineProps({ sheet: { type: Object, required: true } })

const tabs = computed(() => visibleTabs(props.sheet))
const tab = ref('stats')
watch(tabs, (t) => {
  if (!t.some((x) => x.key === tab.value)) tab.value = 'stats'
})
const screen = computed(() => SCREENS[tab.value])
</script>

<template>
  <div class="cc-viewer column no-wrap col" data-testid="cc-viewer">
    <CritcrafterTopper :sheet="sheet" />
    <div class="cc-scroll col scroll q-px-md q-pb-md" data-testid="cc-screen">
      <component :is="screen" :sheet="sheet" />
    </div>
    <CritcrafterBottomBar v-model="tab" :tabs="tabs" />
    <CritcrafterSheetHost />
  </div>
</template>

<style scoped>
.cc-viewer {
  min-height: 0;
}
.cc-scroll {
  min-height: 0;
}
</style>
