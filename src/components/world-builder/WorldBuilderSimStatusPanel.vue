<template>
  <div
    data-testid="world-builder-sim-status"
    class="q-mb-md"
  >
    <div class="text-subtitle2 q-mb-sm">Sim status</div>
    <q-list
      dense
      bordered
      separator
    >
      <q-item>
        <q-item-section>
          <q-item-label caption>Epoch</q-item-label>
          <q-item-label data-testid="world-builder-sim-status-epoch">{{ status.epoch }}</q-item-label>
        </q-item-section>
      </q-item>
      <q-item>
        <q-item-section>
          <q-item-label caption>Living settlements</q-item-label>
          <q-item-label data-testid="world-builder-sim-status-settlements">{{
            status.livingSettlementCount
          }}</q-item-label>
        </q-item-section>
      </q-item>
      <q-item>
        <q-item-section>
          <q-item-label caption>Active expeditions</q-item-label>
          <q-item-label data-testid="world-builder-sim-status-expeditions">{{
            status.activeExpeditionCount
          }}</q-item-label>
        </q-item-section>
      </q-item>
      <q-item>
        <q-item-section>
          <q-item-label caption>Frontier exhausted</q-item-label>
          <q-item-label data-testid="world-builder-sim-status-frontier">{{
            status.frontierExhausted
          }}</q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
  </div>
  <div
    data-testid="world-builder-founding-chronicle"
    class="q-mb-md"
  >
    <div class="text-subtitle2 q-mb-sm">Founding chronicle</div>
    <q-list
      dense
      bordered
      separator
    >
      <q-item
        v-for="(entry, index) in chronicle"
        :key="`${entry.kind}-${entry.epoch}-${index}`"
        :data-testid="`world-builder-chronicle-entry-${index}`"
      >
        <q-item-section>
          <q-item-label>{{ entry.kind }}</q-item-label>
          <q-item-label caption>epoch {{ entry.epoch }}</q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<script setup>
defineProps({
  status: {
    type: Object,
    required: true,
  },
  chronicle: {
    type: Array,
    required: true,
  },
})
</script>
