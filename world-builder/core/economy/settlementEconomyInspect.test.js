import assert from 'node:assert/strict'
import test from 'node:test'
import { referencePriceCp } from './commodityCatalog.js'
import { buildSettlementEconomyInspect } from './settlementEconomyInspect.js'

function docWith(overrides = {}) {
  return {
    settlements: [{ id: 'a', maritimeRole: 'none', population: 100 }],
    lastTradeEpochResult: null,
    externalTradeAccounts: {},
    ...overrides,
  }
}

test('returns null for an unknown settlement', () => {
  assert.strictEqual(buildSettlementEconomyInspect(docWith(), 'missing'), null)
})

test('lists always-present commodities and omits absent pin commodities', () => {
  const tooltip = buildSettlementEconomyInspect(docWith(), 'a')
  assert.ok(tooltip)
  assert.strictEqual(tooltip.population, 100)
  assert.deepStrictEqual(
    tooltip.commodities.map((entry) => entry.commodityId),
    ['grain', 'fish', 'timber', 'baseMetals'],
  )
})

test('includes salt and mineral pin commodities when pins exist', () => {
  const tooltip = buildSettlementEconomyInspect(
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
  const tooltip = buildSettlementEconomyInspect(
    docWith({
      settlements: [{ id: 'a', population: 12345.7 }],
    }),
    'a',
  )
  assert.strictEqual(tooltip.population, 12345)
})

test('reads realm balance and roles from the last clearing result', () => {
  const tooltip = buildSettlementEconomyInspect(
    docWith({
      saltNodes: [{ id: 's1', x: 0, y: 0, score: 1 }],
      tradeAccounts: { balancesBySettlementId: { a: 1234 } },
      lastTradeEpochResult: {
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
  const tooltip = buildSettlementEconomyInspect(
    docWith({
      settlements: [{ id: 'a', maritimeRole: 'none', production: { grain: 999999 } }],
      tradeAccounts: { balancesBySettlementId: { a: 0 } },
      lastTradeEpochResult: {
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
  const tooltip = buildSettlementEconomyInspect(docWith(), 'a')
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
  const tooltip = buildSettlementEconomyInspect(
    docWith({
      saltNodes: [{ id: 's1', x: 0, y: 0, score: 1 }],
      metalNodes: [
        { id: 'c1', x: 0, y: 0, score: 1, kind: 'copper' },
        { id: 's1', x: 1, y: 0, score: 1, kind: 'silver' },
        { id: 'g1', x: 2, y: 0, score: 1, kind: 'gold' },
      ],
      tradeAccounts: { balancesBySettlementId: { a: 0 } },
      lastTradeEpochResult: {
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
  const port = buildSettlementEconomyInspect(
    docWith({
      settlements: [{ id: 'a', maritimeRole: 'port' }],
      tradeAccounts: { balancesBySettlementId: { a: -200 } },
      lastTradeEpochResult: {
        settlementCommodityRoles: {},
        localPricesBySettlementId: {},
      },
      externalTradeAccounts: { a: 500 },
    }),
    'a',
  )
  assert.strictEqual(port.balanceCp, 300)

  const inland = buildSettlementEconomyInspect(
    docWith({
      tradeAccounts: { balancesBySettlementId: { a: 40 } },
      lastTradeEpochResult: {
        settlementCommodityRoles: {},
        localPricesBySettlementId: {},
      },
    }),
    'a',
  )
  assert.strictEqual(inland.balanceCp, 40)
})

test('port settlements always expose last-epoch port tolls; inland omits the field', () => {
  const port = buildSettlementEconomyInspect(
    docWith({
      settlements: [{ id: 'a', maritimeRole: 'port', population: 100 }],
      tradeAccounts: { balancesBySettlementId: { a: 0 } },
      lastTradeEpochResult: {
        settlementCommodityRoles: {},
        localPricesBySettlementId: {},
        portTollIncomeCpBySettlementId: { a: 250 },
      },
    }),
    'a',
  )
  assert.strictEqual(port.portTollsCp, 250)

  const idlePort = buildSettlementEconomyInspect(
    docWith({
      settlements: [{ id: 'a', maritimeRole: 'port', population: 100 }],
    }),
    'a',
  )
  assert.strictEqual(idlePort.portTollsCp, 0)

  const inland = buildSettlementEconomyInspect(
    docWith({
      settlements: [{ id: 'a', maritimeRole: 'none', population: 100 }],
      tradeAccounts: { balancesBySettlementId: { a: 0 } },
      lastTradeEpochResult: {
        settlementCommodityRoles: {},
        localPricesBySettlementId: {},
        portTollIncomeCpBySettlementId: { a: 99 },
      },
    }),
    'a',
  )
  assert.strictEqual(inland.portTollsCp, null)
})

test('living settlements always expose signed faction tax net including zero', () => {
  const taxed = buildSettlementEconomyInspect(
    docWith({
      settlements: [{ id: 'a', maritimeRole: 'none', population: 100 }],
      lastTradeEpochResult: {
        settlementCommodityRoles: {},
        localPricesBySettlementId: {},
        factionTaxNetCpBySettlementId: { a: -40 },
      },
    }),
    'a',
  )
  assert.strictEqual(taxed.factionTaxCp, -40)

  const idle = buildSettlementEconomyInspect(
    docWith({
      settlements: [{ id: 'a', maritimeRole: 'none', population: 100 }],
    }),
    'a',
  )
  assert.strictEqual(idle.factionTaxCp, 0)
})

test('missing portTollIncomeCpBySettlementId is honest zero', () => {
  const tooltip = buildSettlementEconomyInspect(
    docWith({
      settlements: [{ id: 'a', maritimeRole: 'port', population: 100 }],
      tradeAccounts: { balancesBySettlementId: { a: 0 } },
      lastTradeEpochResult: {
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
  assert.strictEqual(tooltip.portTollsCp, 0)
})

test('reads mapped port toll income when present', () => {
  const tooltip = buildSettlementEconomyInspect(
    docWith({
      settlements: [{ id: 'a', maritimeRole: 'port', population: 100 }],
      tradeAccounts: { balancesBySettlementId: { a: 0 } },
      lastTradeEpochResult: {
        settlementCommodityRoles: {},
        localPricesBySettlementId: {},
        portTollIncomeCpBySettlementId: { a: 40 },
      },
    }),
    'a',
  )
  assert.strictEqual(tooltip.portTollsCp, 40)
})
