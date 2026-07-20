import assert from 'node:assert/strict'
import test from 'node:test'
import { referencePriceCp } from './commodityCatalog.js'
import { buildSettlementTradeTooltip } from './settlementTradeTooltip.js'

function docWith(overrides = {}) {
  return {
    settlements: [{ id: 'a', maritimeRole: 'none', population: 100 }],
    lastTradeEpochResult: null,
    externalTradeAccounts: {},
    ...overrides,
  }
}

test('returns null for an unknown settlement', () => {
  assert.strictEqual(buildSettlementTradeTooltip(docWith(), 'missing'), null)
})

test('lists always-present commodities and omits absent pin commodities', () => {
  const tooltip = buildSettlementTradeTooltip(docWith(), 'a')
  assert.ok(tooltip)
  assert.strictEqual(tooltip.population, 100)
  assert.deepStrictEqual(
    tooltip.commodities.map((entry) => entry.commodityId),
    ['grain', 'fish', 'timber', 'baseMetals'],
  )
})

test('includes salt and mineral pin commodities when pins exist', () => {
  const tooltip = buildSettlementTradeTooltip(
    docWith({
      saltNodes: [{ id: 's1', x: 0, y: 0, score: 1 }],
      metalNodes: [
        { id: 'c1', x: 1, y: 0, score: 1, kind: 'copper' },
        { id: 'g1', x: 2, y: 0, score: 1, kind: 'gold' },
      ],
    }),
    'a',
  )
  assert.deepStrictEqual(
    tooltip.commodities.map((entry) => entry.commodityId),
    ['grain', 'fish', 'salt', 'timber', 'baseMetals', 'copper', 'gold'],
  )
})

test('reads population from the settlement record', () => {
  const tooltip = buildSettlementTradeTooltip(
    docWith({
      settlements: [{ id: 'a', population: 12345.7 }],
    }),
    'a',
  )
  assert.strictEqual(tooltip.population, 12345)
})

test('reads realm balance and roles from the last clearing result', () => {
  const tooltip = buildSettlementTradeTooltip(
    docWith({
      saltNodes: [{ id: 's1', x: 0, y: 0, score: 1 }],
      lastTradeEpochResult: {
        realmBalancesCp: { a: 1234 },
        settlementCommodityRoles: { a: { grain: 'export', salt: 'import', fish: 'both' } },
        localPricesBySettlementId: { a: { grain: 3 } },
      },
    }),
    'a',
  )
  assert.ok(tooltip)
  assert.strictEqual(tooltip.balanceCp, 1234)

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

test('priceVsReference uses a ±10% deadzone around catalog reference', () => {
  const grainRef = referencePriceCp('grain')
  const fishRef = referencePriceCp('fish')
  const saltRef = referencePriceCp('salt')
  const timberRef = referencePriceCp('timber')
  const tooltip = buildSettlementTradeTooltip(
    docWith({
      saltNodes: [{ id: 's1', x: 0, y: 0, score: 1 }],
      metalNodes: [
        { id: 'c1', x: 0, y: 0, score: 1, kind: 'copper' },
        { id: 's1', x: 1, y: 0, score: 1, kind: 'silver' },
        { id: 'g1', x: 2, y: 0, score: 1, kind: 'gold' },
      ],
      lastTradeEpochResult: {
        realmBalancesCp: { a: 0 },
        settlementCommodityRoles: {},
        localPricesBySettlementId: {
          a: {
            grain: grainRef * 2,
            fish: fishRef * 0.5,
            salt: saltRef,
            timber: timberRef * 1.1,
            copper: referencePriceCp('copper') * 0.9,
            silver: referencePriceCp('silver') * 1.11,
            gold: referencePriceCp('gold') * 0.89,
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
  assert.strictEqual(
    tooltip.commodities.find((entry) => entry.commodityId === 'timber').priceVsReference,
    'equal',
  )
  assert.strictEqual(
    tooltip.commodities.find((entry) => entry.commodityId === 'copper').priceVsReference,
    'equal',
  )
  assert.strictEqual(
    tooltip.commodities.find((entry) => entry.commodityId === 'silver').priceVsReference,
    'above',
  )
  assert.strictEqual(
    tooltip.commodities.find((entry) => entry.commodityId === 'gold').priceVsReference,
    'below',
  )
})

test('display balance combines realm mutual credit and external trade credit', () => {
  const port = buildSettlementTradeTooltip(
    docWith({
      settlements: [{ id: 'a', maritimeRole: 'port' }],
      lastTradeEpochResult: {
        realmBalancesCp: { a: -200 },
        settlementCommodityRoles: {},
        localPricesBySettlementId: {},
      },
      externalTradeAccounts: { a: 500 },
    }),
    'a',
  )
  assert.strictEqual(port.balanceCp, 300)

  const inland = buildSettlementTradeTooltip(
    docWith({
      lastTradeEpochResult: {
        realmBalancesCp: { a: 40 },
        settlementCommodityRoles: {},
        localPricesBySettlementId: {},
      },
    }),
    'a',
  )
  assert.strictEqual(inland.balanceCp, 40)
})

test('port settlements always expose last-epoch port tolls; inland omits the field', () => {
  const port = buildSettlementTradeTooltip(
    docWith({
      settlements: [{ id: 'a', maritimeRole: 'port', population: 100 }],
      lastTradeEpochResult: {
        realmBalancesCp: { a: 0 },
        settlementCommodityRoles: {},
        localPricesBySettlementId: {},
        portTollIncomeCpBySettlementId: { a: 250 },
      },
    }),
    'a',
  )
  assert.strictEqual(port.portTollsCp, 250)

  const idlePort = buildSettlementTradeTooltip(
    docWith({
      settlements: [{ id: 'a', maritimeRole: 'port', population: 100 }],
    }),
    'a',
  )
  assert.strictEqual(idlePort.portTollsCp, 0)

  const inland = buildSettlementTradeTooltip(
    docWith({
      settlements: [{ id: 'a', maritimeRole: 'none', population: 100 }],
      lastTradeEpochResult: {
        realmBalancesCp: { a: 0 },
        settlementCommodityRoles: {},
        localPricesBySettlementId: {},
        portTollIncomeCpBySettlementId: { a: 99 },
      },
    }),
    'a',
  )
  assert.strictEqual(inland.portTollsCp, null)
})

test('recovers on-map tolls from obligation deltas when aggregated field is missing', () => {
  const tooltip = buildSettlementTradeTooltip(
    docWith({
      settlements: [{ id: 'a', maritimeRole: 'port', population: 100 }],
      lastTradeEpochResult: {
        realmBalancesCp: { a: 0 },
        settlementCommodityRoles: {},
        localPricesBySettlementId: {},
        obligationDeltas: [
          { fromSettlementId: 'b', toSettlementId: 'a', amountCp: 40, kind: 'toll' },
          { fromSettlementId: 'b', toSettlementId: 'a', amountCp: 10, kind: 'goods' },
        ],
      },
    }),
    'a',
  )
  assert.strictEqual(tooltip.portTollsCp, 40)
})
