import assert from 'node:assert/strict'
import test from 'node:test'
import { COMMODITY_IDS, referencePriceCp } from './commodityCatalog.js'
import { buildSettlementTradeTooltip } from './settlementTradeTooltip.js'

function docWith(overrides = {}) {
  return {
    settlements: [{ id: 'a', maritimeRole: 'none' }],
    lastTradeEpochResult: null,
    externalTradeAccounts: {},
    ...overrides,
  }
}

test('returns null for an unknown settlement', () => {
  assert.strictEqual(buildSettlementTradeTooltip(docWith(), 'missing'), null)
})

test('lists every catalog commodity in catalog order', () => {
  const tooltip = buildSettlementTradeTooltip(docWith(), 'a')
  assert.ok(tooltip)
  assert.deepStrictEqual(
    tooltip.commodities.map((entry) => entry.commodityId),
    [...COMMODITY_IDS],
  )
})

test('reads realm balance and roles from the last clearing result', () => {
  const tooltip = buildSettlementTradeTooltip(
    docWith({
      lastTradeEpochResult: {
        realmBalancesCp: { a: 1234 },
        settlementCommodityRoles: { a: { grain: 'export', salt: 'import', fish: 'both' } },
        localPricesBySettlementId: { a: { grain: 3 } },
      },
    }),
    'a',
  )
  assert.ok(tooltip)
  assert.strictEqual(tooltip.realmBalanceCp, 1234)

  const grain = tooltip.commodities.find((entry) => entry.commodityId === 'grain')
  const salt = tooltip.commodities.find((entry) => entry.commodityId === 'salt')
  const fish = tooltip.commodities.find((entry) => entry.commodityId === 'fish')
  assert.deepStrictEqual({ role: grain.role, imports: grain.imports, exports: grain.exports }, {
    role: 'export',
    imports: false,
    exports: true,
  })
  assert.deepStrictEqual({ role: salt.role, imports: salt.imports, exports: salt.exports }, {
    role: 'import',
    imports: true,
    exports: false,
  })
  assert.deepStrictEqual({ role: fish.role, imports: fish.imports, exports: fish.exports }, {
    role: 'both',
    imports: true,
    exports: true,
  })
})

test('does not present local production as export without realized movement', () => {
  const tooltip = buildSettlementTradeTooltip(
    docWith({
      settlements: [{ id: 'a', maritimeRole: 'none', production: { grain: 999999 } }],
      lastTradeEpochResult: {
        realmBalancesCp: { a: 0 },
        settlementCommodityRoles: { a: { grain: 'neither' } },
        localPricesBySettlementId: { a: {} },
      },
    }),
    'a',
  )
  const grain = tooltip.commodities.find((entry) => entry.commodityId === 'grain')
  assert.strictEqual(grain.role, 'neither')
  assert.strictEqual(grain.exports, false)
})

test('defaults roles to neither and prices to reference when no clearing result', () => {
  const tooltip = buildSettlementTradeTooltip(docWith(), 'a')
  for (const entry of tooltip.commodities) {
    assert.strictEqual(entry.role, 'neither')
    assert.strictEqual(entry.localPriceCp, referencePriceCp(entry.commodityId))
    assert.strictEqual(entry.priceVsReference, 'equal')
  }
})

test('priceVsReference compares local price to catalog reference', () => {
  const grainRef = referencePriceCp('grain')
  const tooltip = buildSettlementTradeTooltip(
    docWith({
      lastTradeEpochResult: {
        realmBalancesCp: { a: 0 },
        settlementCommodityRoles: {},
        localPricesBySettlementId: {
          a: {
            grain: grainRef * 2,
            fish: referencePriceCp('fish') * 0.5,
            salt: referencePriceCp('salt'),
          },
        },
      },
    }),
    'a',
  )
  assert.strictEqual(
    tooltip.commodities.find((entry) => entry.commodityId === 'grain').priceVsReference,
    'above',
  )
  assert.strictEqual(
    tooltip.commodities.find((entry) => entry.commodityId === 'fish').priceVsReference,
    'below',
  )
  assert.strictEqual(
    tooltip.commodities.find((entry) => entry.commodityId === 'salt').priceVsReference,
    'equal',
  )
})

test('port off-map credit is present for ports and null for inland settlements', () => {
  const port = buildSettlementTradeTooltip(
    docWith({
      settlements: [{ id: 'a', maritimeRole: 'port' }],
      externalTradeAccounts: { a: 500 },
    }),
    'a',
  )
  assert.strictEqual(port.isPort, true)
  assert.strictEqual(port.portOffMapCreditCp, 500)

  const inland = buildSettlementTradeTooltip(docWith(), 'a')
  assert.strictEqual(inland.isPort, false)
  assert.strictEqual(inland.portOffMapCreditCp, null)
})
