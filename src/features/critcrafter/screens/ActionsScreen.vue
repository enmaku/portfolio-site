<script setup>
/** Actions: groups by source in sheet order, sorted by cost, defaultOpen from the sheet (first five open, last three collapsed). */
import { computed } from 'vue'
import CritcrafterEntryRow from '../components/CritcrafterEntryRow.vue'
import { openDetail } from '../detail/sheetStack.js'
import { actionGroupsView } from '../viewer/screenModel.js'

const props = defineProps({ sheet: { type: Object, required: true } })
const groups = computed(() => actionGroupsView(props.sheet.actions))

</script>

<template>
  <div data-testid="cc-screen-actions">
    <div v-if="groups.length === 0" class="text-body2 cc-muted" data-testid="cc-empty">No actions in this build</div>
    <q-expansion-item v-for="g in groups" :key="g.id" :default-opened="g.defaultOpen" dark expand-separator class="cc-exp" header-class="cc-exp-head" :label="g.label" data-testid="cc-action-group">
      <CritcrafterEntryRow v-for="e in g.entries" :key="e.key" :entry="e" bold @open="openDetail(e)" />
    </q-expansion-item>
  </div>
</template>

<style scoped>
.cc-muted {
  color: var(--q-secondary);
}
</style>
