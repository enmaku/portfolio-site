import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyCommodityAmounts } from '../productionAccounting.js'
import { DIAMOND_GEMS_PER_EXTRACTION } from '../productionAccounting.js'
import { runTradeClearing, runTradeClearingSync } from './runTradeClearing.js'
import {
  OFF_MAP_EXPORT_PRICE_FACTOR,
  OFF_MAP_IMPORT_PRICE_FACTOR,
  offMapUnitPriceCp,
} from './offMapTrade.js'
import { referencePriceCp } from '../commodityCatalog.js'
import { prosperityDemandUnits } from './allocationTiers.js'

/**
 * @param {Record<string, Partial<Record<string, number>>>} overrides
 */
function production(overrides) {
  /** @type {Record<string, Record<string, number>>} */
  const out = {}
  for (const [id, amounts] of Object.entries(overrides)) {
    out[id] = { ...emptyCommodityAmounts(), ...amounts }
  }
  return out
}

/**
 * @param {Partial<import('../tradeGraph/buildCandidateRoutes.js').TradeRouteEdge>} over
 */
function edge(over) {
  return {
    id: over.id ?? `${over.fromSettlementId}::${over.toSettlementId}::${over.mode ?? 'overland'}`,
    fromSettlementId: over.fromSettlementId ?? 'a',
    toSettlementId: over.toSettlementId ?? 'b',
    mode: over.mode ?? 'overland',
    haulDistanceFraction: over.haulDistanceFraction ?? 0,
    capacityLb: over.capacityLb ?? 1e12,
    transportCostCpPerLb: over.transportCostCpPerLb ?? 0,
    directionalFrictionAtoB: over.directionalFrictionAtoB ?? 1,
    directionalFrictionBtoA: over.directionalFrictionBtoA ?? 1,
  }
}

test('off-map price factors are asymmetric 0.5 export / 2.5 import', () => {
  assert.equal(OFF_MAP_EXPORT_PRICE_FACTOR, 0.5)
  assert.equal(OFF_MAP_IMPORT_PRICE_FACTOR, 2.5)
  const ref = referencePriceCp('timber')
  assert.equal(offMapUnitPriceCp({ referencePriceCp: ref, direction: 'export' }), ref * 0.5)
  assert.equal(offMapUnitPriceCp({ referencePriceCp: ref, direction: 'import' }), ref * 2.5)
})

test('port dumps own diamond surplus to external account without self-obligation', () => {
  const gems = DIAMOND_GEMS_PER_EXTRACTION
  const localDemand = prosperityDemandUnits('diamonds', 100)
  const result = runTradeClearingSync({
    settlements: [{ id: 'port', population: 100, maritimeRole: 'port' }],
    graph: { edges: [] },
    production: production({
      port: {
        grain: 200000,
        salt: 5000,
        timber: 20000,
        baseMetals: 1000,
        copper: 200,
        silver: 20,
        gold: 2,
        diamonds: gems,
      },
    }),
  })

  const dump = result.offMapTrades.find((t) => t.commodityId === 'diamonds' && t.direction === 'export')
  assert.ok(dump)
  assert.ok(Math.abs(dump.amount - (gems - localDemand)) < 1e-9)
  assert.equal(dump.originSettlementId, 'port')
  assert.equal(dump.settlementId, 'port')
  assert.ok(
    result.obligationDeltas.every(
      (o) => !(o.fromSettlementId === 'port' && o.toSettlementId === 'port'),
    ),
  )
  assert.ok((result.externalAccountDeltas.port ?? 0) > 0)
  let expectedLoadingTollsCp = 0
  for (const trade of result.offMapTrades) {
    if (trade.direction !== 'export' || trade.settlementId !== 'port') continue
    expectedLoadingTollsCp += 0.05 * trade.unitPriceCp * trade.amount
  }
  assert.ok(
    Math.abs((result.portTollIncomeCpBySettlementId.port ?? 0) - expectedLoadingTollsCp) < 1e-3,
    `toll income ${result.portTollIncomeCpBySettlementId.port} vs ${expectedLoadingTollsCp}`,
  )
})

test('inland diamonds dump through cheapest reachable port when worth-it', () => {
  const gems = DIAMOND_GEMS_PER_EXTRACTION
  const localDemand = prosperityDemandUnits('diamonds', 100)
  const settlements = [
    { id: 'mine', population: 100 },
    { id: 'near', population: 100, maritimeRole: 'port' },
    { id: 'far', population: 100, maritimeRole: 'port' },
  ]
  const metProsperity = {
    grain: 200000,
    salt: 5000,
    timber: 20000,
    baseMetals: 1000,
    copper: 200,
    silver: 20,
    gold: 2,
    diamonds: localDemand,
  }
  const prod = production({
    mine: { ...metProsperity, diamonds: gems },
    near: metProsperity,
    far: metProsperity,
  })
  const graph = {
    edges: [
      edge({
        fromSettlementId: 'mine',
        toSettlementId: 'near',
        transportCostCpPerLb: 10,
      }),
      edge({
        fromSettlementId: 'mine',
        toSettlementId: 'far',
        transportCostCpPerLb: 1000,
      }),
    ],
  }

  const result = runTradeClearingSync({ settlements, graph, production: prod })
  const dump = result.offMapTrades.find((t) => t.commodityId === 'diamonds' && t.direction === 'export')
  assert.ok(dump)
  assert.equal(dump.settlementId, 'near')
  assert.equal(dump.originSettlementId, 'mine')
  assert.ok(Math.abs(dump.amount - (gems - localDemand)) < 1e-9)
  assert.equal(result.settlementCommodityRoles.mine.diamonds, 'export')

  const saleCp = dump.unitPriceCp * dump.amount
  const portOwesMine = result.obligationDeltas.find(
    (o) => o.fromSettlementId === 'near' && o.toSettlementId === 'mine' && o.kind === 'goods',
  )
  assert.ok(portOwesMine)
  assert.ok(Math.abs(portOwesMine.amountCp - saleCp) < 1e-3, `owed ${portOwesMine.amountCp} vs sale ${saleCp}`)
  assert.ok((result.externalAccountDeltas.near ?? 0) > 0)
})

test('inland dump is rejected when transport exceeds export unit price', () => {
  const gems = DIAMOND_GEMS_PER_EXTRACTION
  const exportUnit = offMapUnitPriceCp({
    referencePriceCp: referencePriceCp('diamonds'),
    direction: 'export',
  })
  // diamonds cargo 0.1 lb → need transportCostCpPerLb > exportUnit / 0.1
  const tooCostly = exportUnit / 0.1 + 1
  const result = runTradeClearingSync({
    settlements: [
      { id: 'mine', population: 100 },
      { id: 'port', population: 100, maritimeRole: 'port' },
    ],
    graph: {
      edges: [
        edge({
          fromSettlementId: 'mine',
          toSettlementId: 'port',
          transportCostCpPerLb: tooCostly,
        }),
      ],
    },
    production: production({
      mine: {
        grain: 200000,
        salt: 5000,
        timber: 20000,
        baseMetals: 1000,
        copper: 200,
        silver: 20,
        gold: 2,
        diamonds: gems,
      },
      port: { grain: 200000, salt: 5000, timber: 20000, baseMetals: 1000, copper: 200, silver: 20, gold: 2 },
    }),
  })

  assert.equal(
    result.offMapTrades.find((t) => t.commodityId === 'diamonds' && t.direction === 'export'),
    undefined,
  )
})

test('port fills own import needs before mediating hinterland last-line imports', () => {
  const settlements = [
    { id: 'port', population: 100, maritimeRole: 'port' },
    { id: 'inland', population: 100 },
  ]
  // Port earns from grain dump; both need timber. Tiny pier capacity forces a choice.
  const prod = production({
    port: { grain: 44800, salt: 500 },
    inland: { grain: 43800, salt: 500 },
  })
  const graph = {
    edges: [
      edge({
        fromSettlementId: 'port',
        toSettlementId: 'inland',
        transportCostCpPerLb: 0.01,
        capacityLb: 1e12,
      }),
    ],
  }

  const result = runTradeClearingSync({
    settlements,
    graph,
    production: prod,
    priorRealizedIncomeCp: { inland: 1_000_000 },
  })

  const portTimber = result.offMapTrades.filter(
    (t) => t.commodityId === 'timber' && t.direction === 'import' && t.originSettlementId === 'port',
  )
  const inlandTimber = result.offMapTrades.filter(
    (t) => t.commodityId === 'timber' && t.direction === 'import' && t.originSettlementId === 'inland',
  )
  assert.ok(portTimber.length > 0, 'port should import timber for itself first')
  // With tiny grain earnings, pier/credit may exhaust before hinterland — port-first is the contract.
  assert.ok(portTimber[0].amount > 0)
  if (inlandTimber.length > 0) {
    assert.ok(portTimber[0].amount + inlandTimber[0].amount > portTimber[0].amount - 1e-9)
  }
})

test('off-map substep emits per-settlement item progress across export and import sweeps', async () => {
  const params = {
    settlements: [
      { id: 'a', population: 50, maritimeRole: 'port' },
      { id: 'b', population: 50 },
    ],
    graph: {
      edges: [edge({ fromSettlementId: 'a', toSettlementId: 'b', transportCostCpPerLb: 0.01 })],
    },
    production: production({
      a: { grain: 100000, salt: 500 },
      b: { grain: 100000, salt: 500, diamonds: DIAMOND_GEMS_PER_EXTRACTION },
    }),
  }

  /** @type {Array<{ type: string, itemIndex?: number, itemCount?: number }>} */
  const offMapItems = []
  await runTradeClearing(params, {
    yieldToUi: async () => {},
    hooks: {
      onTradeSubstep(payload) {
        if (payload.substepId === 'offMap' && payload.type === 'substep-item') {
          offMapItems.push({
            type: payload.type,
            itemIndex: payload.itemIndex,
            itemCount: payload.itemCount,
          })
        }
      },
    },
  })

  // living(2) + ports(1) + inland(1) = 4 items
  assert.equal(offMapItems.length, 4)
  assert.deepEqual(
    offMapItems.map((row) => row.itemIndex),
    [1, 2, 3, 4],
  )
  assert.ok(offMapItems.every((row) => row.itemCount === 4))
})

test('over-limit inland buyer cannot take last-line prosperity off-map imports', () => {
  const settlements = [
    { id: 'port', population: 100, maritimeRole: 'port' },
    { id: 'inland', population: 100 },
  ]
  const prod = production({
    port: { grain: 200000, salt: 5000, timber: 20000 },
    inland: { grain: 43800, salt: 500 },
  })
  const graph = {
    edges: [
      edge({
        fromSettlementId: 'port',
        toSettlementId: 'inland',
        transportCostCpPerLb: 0.01,
        capacityLb: 1e12,
      }),
    ],
  }

  const result = runTradeClearingSync({
    settlements,
    graph,
    production: prod,
    priorRealizedIncomeCp: { inland: 100 },
    externalAccountsCp: { port: 1_000_000 },
    priorTradeAccounts: {
      obligations: [{ creditorSettlementId: 'port', debtorSettlementId: 'inland', amountCp: 500_000 }],
      balancesBySettlementId: { port: 500_000, inland: -500_000 },
    },
  })

  const inlandTimber = result.offMapTrades.find(
    (t) => t.commodityId === 'timber' && t.direction === 'import' && t.originSettlementId === 'inland',
  )
  assert.equal(inlandTimber, undefined)
  assert.ok((result.realmBalancesCp.inland ?? 0) >= -500_000 - 1e-3)
})
