<template>
  <div data-testid="world-builder-realm-economy">
    <q-list
      dense
      class="realm-economy-sections"
    >
      <q-expansion-item
        label="Realm economy"
        dense
        default-opened
        header-class="text-caption text-weight-medium"
      >
        <div class="realm-economy-rows">
          <div
            v-if="economy.wealthiest && economy.poorest"
            class="realm-economy-row"
            data-testid="world-builder-realm-economy-wealth"
          >
            <div class="row items-center no-wrap q-gutter-xs">
              <MoneyBagIcon />
              <span class="text-body2">Wealth</span>
            </div>
            <div class="row items-center q-col-gutter-xs q-mt-xs">
              <div class="col-6">
                <q-btn
                  class="full-width realm-economy-extreme-btn"
                  dense
                  outline
                  no-caps
                  color="white"
                  size="sm"
                  data-testid="world-builder-realm-economy-wealthiest"
                  :label="`Highest: ${formatMoneyCp(economy.wealthiest.valueCp, { compact: true })}`"
                  @click="
                    $emit('focus-settlement', {
                      settlementId: economy.wealthiest.settlementId,
                      focusKey: 'wealth:wealthiest',
                    })
                  "
                />
              </div>
              <div class="col-6">
                <q-btn
                  class="full-width realm-economy-extreme-btn"
                  dense
                  outline
                  no-caps
                  color="white"
                  size="sm"
                  data-testid="world-builder-realm-economy-poorest"
                  :label="`Lowest: ${formatMoneyCp(economy.poorest.valueCp, { compact: true })}`"
                  @click="
                    $emit('focus-settlement', {
                      settlementId: economy.poorest.settlementId,
                      focusKey: 'wealth:poorest',
                    })
                  "
                />
              </div>
            </div>
          </div>
          <div
            v-if="economy.highestTolls && economy.lowestTolls"
            class="realm-economy-row"
            data-testid="world-builder-realm-economy-tolls"
          >
            <div class="row items-center no-wrap q-gutter-xs">
              <PortTollsIcon />
              <span class="text-body2">Tolls</span>
            </div>
            <div class="row items-center q-col-gutter-xs q-mt-xs">
              <div class="col-6">
                <q-btn
                  class="full-width realm-economy-extreme-btn"
                  dense
                  outline
                  no-caps
                  color="white"
                  size="sm"
                  data-testid="world-builder-realm-economy-tolls-highest"
                  :label="`Highest: ${formatMoneyCp(economy.highestTolls.valueCp, { compact: true })}`"
                  @click="
                    $emit('focus-settlement', {
                      settlementId: economy.highestTolls.settlementId,
                      focusKey: 'tolls:highest',
                    })
                  "
                />
              </div>
              <div class="col-6">
                <q-btn
                  class="full-width realm-economy-extreme-btn"
                  dense
                  outline
                  no-caps
                  color="white"
                  size="sm"
                  data-testid="world-builder-realm-economy-tolls-lowest"
                  :label="`Lowest: ${formatMoneyCp(economy.lowestTolls.valueCp, { compact: true })}`"
                  @click="
                    $emit('focus-settlement', {
                      settlementId: economy.lowestTolls.settlementId,
                      focusKey: 'tolls:lowest',
                    })
                  "
                />
              </div>
            </div>
          </div>
          <div
            v-if="economy.highestFactionTax && economy.lowestFactionTax"
            class="realm-economy-row"
            data-testid="world-builder-realm-economy-faction-tax"
          >
            <div class="row items-center no-wrap q-gutter-xs">
              <FactionTaxIcon />
              <span class="text-body2">Tax</span>
            </div>
            <div class="row items-center q-col-gutter-xs q-mt-xs">
              <div class="col-6">
                <q-btn
                  class="full-width realm-economy-extreme-btn"
                  dense
                  outline
                  no-caps
                  color="white"
                  size="sm"
                  data-testid="world-builder-realm-economy-faction-tax-highest"
                  :label="`Highest: ${formatMoneyCp(economy.highestFactionTax.valueCp, { compact: true })}`"
                  @click="
                    $emit('focus-settlement', {
                      settlementId: economy.highestFactionTax.settlementId,
                      focusKey: 'faction-tax:highest',
                    })
                  "
                />
              </div>
              <div class="col-6">
                <q-btn
                  class="full-width realm-economy-extreme-btn"
                  dense
                  outline
                  no-caps
                  color="white"
                  size="sm"
                  data-testid="world-builder-realm-economy-faction-tax-lowest"
                  :label="`Lowest: ${formatMoneyCp(economy.lowestFactionTax.valueCp, { compact: true })}`"
                  @click="
                    $emit('focus-settlement', {
                      settlementId: economy.lowestFactionTax.settlementId,
                      focusKey: 'faction-tax:lowest',
                    })
                  "
                />
              </div>
            </div>
          </div>
          <div
            class="realm-economy-commodity-list"
            data-testid="world-builder-realm-economy-commodities"
          >
            <div
              v-for="row in economy.commodities"
              :key="row.commodityId"
              class="realm-economy-row"
              :data-testid="`world-builder-realm-economy-commodity-${row.commodityId}`"
            >
              <div class="row items-center no-wrap q-gutter-xs">
                <CommodityIcon :commodity-id="row.commodityId" />
                <span class="text-body2">{{ commodityName(row.commodityId) }}</span>
              </div>
              <div
                v-if="row.highest && row.lowest"
                class="row items-center q-col-gutter-xs q-mt-xs"
              >
                <div class="col-6">
                  <q-btn
                    class="full-width realm-economy-extreme-btn"
                    dense
                    outline
                    no-caps
                    color="white"
                    size="sm"
                    :data-testid="`world-builder-realm-economy-${row.commodityId}-highest`"
                    :label="`Highest: ${formatCommodityPriceCp(row.highest.valueCp, row.commodityId, { compact: true })}`"
                    @click="
                      $emit('focus-settlement', {
                        settlementId: row.highest.settlementId,
                        focusKey: `commodity:${row.commodityId}:highest`,
                      })
                    "
                  />
                </div>
                <div class="col-6">
                  <q-btn
                    class="full-width realm-economy-extreme-btn"
                    dense
                    outline
                    no-caps
                    color="white"
                    size="sm"
                    :data-testid="`world-builder-realm-economy-${row.commodityId}-lowest`"
                    :label="`Lowest: ${formatCommodityPriceCp(row.lowest.valueCp, row.commodityId, { compact: true })}`"
                    @click="
                      $emit('focus-settlement', {
                        settlementId: row.lowest.settlementId,
                        focusKey: `commodity:${row.commodityId}:lowest`,
                      })
                    "
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </q-expansion-item>
    </q-list>
  </div>
</template>

<script setup>
import { formatCommodityPriceCp, formatMoneyCp } from '../../../world-builder/core/economy/formatMoneyCp.js'
import {
  COMMODITY_ACCESSIBLE_NAMES,
  COMMODITY_ICONS,
  factionTaxIcon,
  moneyBagIcon,
  portTollsIcon,
} from './settlementTradeTooltipIcons.js'

defineProps({
  economy: {
    type: Object,
    required: true,
  },
})

defineEmits(['focus-settlement'])

const MoneyBagIcon = {
  setup() {
    return () => moneyBagIcon()
  },
}

const PortTollsIcon = {
  setup() {
    return () => portTollsIcon()
  },
}

const FactionTaxIcon = {
  setup() {
    return () => factionTaxIcon()
  },
}

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

<style scoped>
.realm-economy-sections :deep(.q-expansion-item__content) {
  padding: 0 16px 4px;
}

.realm-economy-rows,
.realm-economy-commodity-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.realm-economy-extreme-btn {
  white-space: nowrap;
}
</style>
