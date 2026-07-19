<template>
  <div data-testid="world-builder-realm-economy">
    <div class="text-subtitle2 q-mb-sm">Realm economy</div>
    <q-list
      dense
      bordered
      separator
      class="q-mb-md"
    >
      <q-item
        v-if="economy.wealthiest && economy.poorest"
        data-testid="world-builder-realm-economy-wealth"
      >
        <q-item-section>
          <q-item-label caption>Wealth</q-item-label>
          <div class="row items-center q-gutter-xs q-mt-xs">
            <q-btn
              dense
              flat
              no-caps
              color="primary"
              data-testid="world-builder-realm-economy-wealthiest"
              :label="`Wealthiest: ${formatMoneyCp(economy.wealthiest.valueCp)}`"
              @click="
                $emit('focus-settlement', {
                  settlementId: economy.wealthiest.settlementId,
                  focusKey: 'wealth:wealthiest',
                })
              "
            />
            <q-btn
              dense
              flat
              no-caps
              color="primary"
              data-testid="world-builder-realm-economy-poorest"
              :label="`Poorest: ${formatMoneyCp(economy.poorest.valueCp)}`"
              @click="
                $emit('focus-settlement', {
                  settlementId: economy.poorest.settlementId,
                  focusKey: 'wealth:poorest',
                })
              "
            />
          </div>
        </q-item-section>
      </q-item>
    </q-list>
    <q-list
      dense
      bordered
      separator
      data-testid="world-builder-realm-economy-commodities"
    >
      <q-item
        v-for="row in economy.commodities"
        :key="row.commodityId"
        :data-testid="`world-builder-realm-economy-commodity-${row.commodityId}`"
      >
        <q-item-section avatar>
          <CommodityIcon :commodity-id="row.commodityId" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ commodityName(row.commodityId) }}</q-item-label>
          <div
            v-if="row.highest && row.lowest"
            class="row items-center q-gutter-xs q-mt-xs"
          >
            <q-btn
              dense
              flat
              no-caps
              color="primary"
              :data-testid="`world-builder-realm-economy-${row.commodityId}-highest`"
              :label="`Highest: ${formatMoneyCp(row.highest.valueCp)}`"
              @click="
                $emit('focus-settlement', {
                  settlementId: row.highest.settlementId,
                  focusKey: `commodity:${row.commodityId}:highest`,
                })
              "
            />
            <q-btn
              dense
              flat
              no-caps
              color="primary"
              :data-testid="`world-builder-realm-economy-${row.commodityId}-lowest`"
              :label="`Lowest: ${formatMoneyCp(row.lowest.valueCp)}`"
              @click="
                $emit('focus-settlement', {
                  settlementId: row.lowest.settlementId,
                  focusKey: `commodity:${row.commodityId}:lowest`,
                })
              "
            />
          </div>
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<script setup>
import { formatMoneyCp } from '../../../world-builder/core/economy/formatMoneyCp.js'
import {
  COMMODITY_ACCESSIBLE_NAMES,
  COMMODITY_ICONS,
} from './settlementTradeTooltipIcons.js'

defineProps({
  economy: {
    type: Object,
    required: true,
  },
})

defineEmits(['focus-settlement'])

const CommodityIcon = {
  props: {
    commodityId: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    return () => COMMODITY_ICONS[props.commodityId]?.() ?? null
  },
}

/**
 * @param {string} commodityId
 * @returns {string}
 */
function commodityName(commodityId) {
  return COMMODITY_ACCESSIBLE_NAMES[commodityId] ?? commodityId
}
</script>
