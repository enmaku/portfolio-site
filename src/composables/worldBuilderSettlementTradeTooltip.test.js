import assert from 'node:assert/strict'
import test from 'node:test'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { buildSettlementEconomyInspect } from '../../world-builder/core/economy/settlementEconomyInspect.js'
import WorldBuilderSettlementTradeTooltip from '../components/world-builder/WorldBuilderSettlementTradeTooltip.js'

test('settlement trade tooltip host is absent when tooltip model is null', async () => {
  const html = await renderToString(
    createSSRApp(WorldBuilderSettlementTradeTooltip, {
      tooltip: null,
      position: null,
    }),
  )
  assert.equal(html.includes('data-testid="world-builder-settlement-trade-tooltip"'), false)
})

test('settlement trade tooltip host is present when tooltip model is set', async () => {
  const tooltip = buildSettlementEconomyInspect(
    {
      settlements: [{ id: 's1', maritimeRole: 'port', population: 2500 }],
      saltNodes: [{ id: 'salt1', x: 0, y: 0, score: 1 }],
      tradeAccounts: { balancesBySettlementId: { s1: 42 } },
      lastTradeEpochResult: {
        settlementCommodityRoles: { s1: { grain: 'export', fish: 'import', salt: 'both' } },
        localPricesBySettlementId: { s1: { grain: 5 } },
      },
      externalTradeAccounts: { s1: 10 },
    },
    's1',
  )
  assert.ok(tooltip)

  const html = await renderToString(
    createSSRApp(WorldBuilderSettlementTradeTooltip, {
      tooltip,
      position: { x: 16, y: 24 },
    }),
  )

  assert.equal(html.includes('data-testid="world-builder-settlement-trade-tooltip"'), true)
  assert.equal(
    html.includes('data-testid="world-builder-settlement-trade-tooltip-population"'),
    true,
  )
  assert.equal(
    html.includes('data-testid="world-builder-settlement-trade-tooltip-population-value"'),
    true,
  )
  assert.equal(html.includes('data-testid="world-builder-settlement-trade-tooltip-balance"'), true)
  assert.equal(html.includes('data-testid="world-builder-settlement-trade-tooltip-balance-label"'), true)
  assert.equal(html.includes('data-testid="world-builder-settlement-trade-tooltip-balance-value"'), true)
  assert.equal(
    html.includes('data-testid="world-builder-settlement-trade-tooltip-port-tolls"'),
    true,
  )
  assert.equal(
    html.includes('data-testid="world-builder-settlement-trade-tooltip-port-credit"'),
    false,
  )
  assert.equal(html.includes('data-testid="world-builder-settlement-trade-tooltip-commodities"'), true)
  assert.equal(
    html.includes('data-testid="world-builder-settlement-trade-tooltip-commodity-grain"'),
    true,
  )
  assert.equal(
    html.includes('data-testid="world-builder-settlement-trade-tooltip-commodity-grain-label"'),
    true,
  )
  assert.equal(
    html.includes('data-testid="world-builder-settlement-trade-tooltip-commodity-grain-direction"'),
    true,
  )
  assert.equal(
    html.includes('data-testid="world-builder-settlement-trade-tooltip-commodity-grain-price"'),
    true,
  )
  assert.equal(html.includes('data-trade-role="export"'), true)
  assert.equal(html.includes('data-trade-role="import"'), true)
  assert.equal(html.includes('data-trade-role="both"'), true)
  assert.equal(html.includes('data-price-vs-reference="above"'), true)
  assert.equal(html.includes('<svg'), true)
})

test('settlement trade tooltip omits port tolls row for inland settlements', async () => {
  const tooltip = buildSettlementEconomyInspect(
    {
      settlements: [{ id: 's1', maritimeRole: 'none', population: 100 }],
      tradeAccounts: { balancesBySettlementId: { s1: 0 } },
      lastTradeEpochResult: {
        settlementCommodityRoles: {},
        localPricesBySettlementId: {},
      },
      externalTradeAccounts: {},
    },
    's1',
  )
  assert.ok(tooltip)
  assert.strictEqual(tooltip.portTollsCp, null)

  const html = await renderToString(
    createSSRApp(WorldBuilderSettlementTradeTooltip, {
      tooltip,
      position: { x: 16, y: 24 },
    }),
  )
  assert.equal(
    html.includes('data-testid="world-builder-settlement-trade-tooltip-port-tolls"'),
    false,
  )
})
