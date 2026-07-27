import assert from 'node:assert/strict'
import test from 'node:test'
import {
  campaignKitCommodityLabel,
  campaignKitInteger,
  campaignKitResourceMapLegend,
  formatCampaignKitCommodityAmount,
  formatCampaignKitCommodityPriceCp,
  formatCampaignKitHistoryKind,
  formatCampaignKitMoneyCp,
  presentCampaignKitProduction,
} from './campaignKitFormat.js'
import { CP_PER_GP, CP_PER_SP } from '../economy/commodityCatalog.js'

test('campaignKitCommodityLabel uses author-facing names', () => {
  assert.equal(campaignKitCommodityLabel('baseMetals'), 'base metals')
  assert.equal(campaignKitCommodityLabel('grain'), 'grain')
})

test('campaign kit quantities and money round to integers', () => {
  assert.equal(campaignKitInteger(0.144355774), 0)
  assert.equal(campaignKitInteger(12.6), 13)
  assert.equal(formatCampaignKitCommodityAmount(0.144, 'grain').display, '0 lb')
  assert.equal(formatCampaignKitCommodityAmount(12.4, 'grain').display, '12 lb')
  assert.equal(formatCampaignKitCommodityAmount(1.2, 'diamonds').display, '1 gem')
  assert.equal(formatCampaignKitMoneyCp(1.4), '1 cp')
  assert.equal(formatCampaignKitMoneyCp(CP_PER_SP + 0.4), '1 sp')
  assert.equal(formatCampaignKitMoneyCp(1.5 * CP_PER_GP), '2 gp')
  assert.equal(formatCampaignKitCommodityPriceCp(1.4, 'grain'), '1 cp/lb')
})

test('formatCampaignKitHistoryKind replaces underscores with spaces', () => {
  assert.equal(formatCampaignKitHistoryKind('settlement_founded'), 'settlement founded')
  assert.equal(formatCampaignKitHistoryKind('settlement_abandoned'), 'settlement abandoned')
  assert.equal(formatCampaignKitHistoryKind('founding'), 'founding')
})

test('presentCampaignKitProduction drops sub-unit positives after rounding', () => {
  const rows = presentCampaignKitProduction({
    grain: 0.144,
    timber: 25.6,
    baseMetals: 3.2,
  })
  assert.deepEqual(
    rows.map((row) => ({ commodityId: row.commodityId, display: row.display, label: row.label })),
    [
      { commodityId: 'timber', display: '26 lb', label: 'timber' },
      { commodityId: 'baseMetals', display: '3 lb', label: 'base metals' },
    ],
  )
})

test('campaignKitResourceMapLegend lists raster and node cues', () => {
  const keys = campaignKitResourceMapLegend().map((row) => row.key)
  assert.ok(keys.includes('arable'))
  assert.ok(keys.includes('silver'))
  assert.ok(keys.includes('salt'))
})
