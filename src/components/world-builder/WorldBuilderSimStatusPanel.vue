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
          <q-item-label caption>Ruins</q-item-label>
          <q-item-label data-testid="world-builder-sim-status-ruins">{{
            status.ruinCount
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
          <q-item-label caption>Road segments</q-item-label>
          <q-item-label data-testid="world-builder-sim-status-roads">{{
            status.roadSegmentCount
          }}</q-item-label>
        </q-item-section>
      </q-item>
      <q-item>
        <q-item-section>
          <q-item-label caption>On-map trade flows</q-item-label>
          <q-item-label data-testid="world-builder-sim-status-trade-flows">{{
            status.activeTradeFlowCount
          }}</q-item-label>
        </q-item-section>
      </q-item>
      <q-item>
        <q-item-section>
          <q-item-label caption>Off-map trades</q-item-label>
          <q-item-label data-testid="world-builder-sim-status-off-map-trades">{{
            status.offMapTradeCount
          }}</q-item-label>
        </q-item-section>
      </q-item>
      <q-item>
        <q-item-section>
          <q-item-label caption>Total population</q-item-label>
          <q-item-label data-testid="world-builder-sim-status-population">{{
            formatPopulation(status.totalPopulation)
          }}</q-item-label>
        </q-item-section>
      </q-item>
      <q-item v-if="status.highestPopulation && status.lowestPopulation">
        <q-item-section>
          <q-item-label caption>Population</q-item-label>
          <div class="row items-center q-gutter-xs q-mt-xs">
            <q-btn
              dense
              flat
              no-caps
              color="primary"
              data-testid="world-builder-sim-status-pop-highest"
              :label="`Highest: ${formatPopulation(status.highestPopulation.value)}`"
              @click="
                $emit('focus-settlement', {
                  settlementId: status.highestPopulation.settlementId,
                  focusKey: 'population:highest',
                })
              "
            />
            <q-btn
              dense
              flat
              no-caps
              color="primary"
              data-testid="world-builder-sim-status-pop-lowest"
              :label="`Lowest: ${formatPopulation(status.lowestPopulation.value)}`"
              @click="
                $emit('focus-settlement', {
                  settlementId: status.lowestPopulation.settlementId,
                  focusKey: 'population:lowest',
                })
              "
            />
          </div>
        </q-item-section>
      </q-item>
    </q-list>
    <div
      v-if="status.resourceClaims?.length"
      class="q-mt-md"
      data-testid="world-builder-sim-status-resource-claims"
    >
      <div class="text-caption q-mb-xs">Resource claims</div>
      <q-markup-table
        dense
        flat
        bordered
        wrap-cells
      >
        <thead>
          <tr>
            <th class="text-left">Resource</th>
            <th class="text-right">Claimed</th>
            <th class="text-right">World</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in status.resourceClaims"
            :key="row.key"
            :data-testid="`world-builder-sim-status-resource-${row.key}`"
          >
            <td>{{ resourceLabel(row.key) }}</td>
            <td class="text-right">{{ row.claimed }}</td>
            <td class="text-right">{{ row.total }}</td>
          </tr>
        </tbody>
      </q-markup-table>
    </div>
  </div>
</template>

<script setup>
defineProps({
  status: {
    type: Object,
    required: true,
  },
})

defineEmits(['focus-settlement'])

/**
 * @param {number} value
 * @returns {string}
 */
function formatPopulation(value) {
  return Number(value || 0).toLocaleString('en-US')
}

/**
 * @param {string} key
 * @returns {string}
 */
function resourceLabel(key) {
  if (key === 'diamonds') return 'Diamonds'
  if (key === 'salt') return 'Salt'
  if (key === 'copper') return 'Copper'
  if (key === 'silver') return 'Silver'
  if (key === 'gold') return 'Gold'
  return key
}
</script>
