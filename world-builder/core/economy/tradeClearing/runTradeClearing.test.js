import assert from 'node:assert/strict'
import test from 'node:test'
import { runTradeClearing } from './runTradeClearing.js'
import { emptyCommodityAmounts } from '../productionAccounting.js'
import { computeConnectedMarketPrices } from '../localPrices.js'

/**
 * @param {Record<string, Partial<import('../commodityCatalog.js').CommodityId extends string ? Record<string, number> : never>>} overrides
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
 * @returns {import('../tradeGraph/buildCandidateRoutes.js').TradeRouteEdge}
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

test('survival: grain surplus flows over a single overland edge to a starving neighbor', () => {
  const settlements = [
    { id: 'a', population: 100 },
    { id: 'b', population: 100 },
  ]
  // a has exactly its own survival floor plus b's survival floor — no comfort surplus.
  const prod = production({ a: { grain: 73000 }, b: {} })
  const graph = {
    edges: [edge({ fromSettlementId: 'a', toSettlementId: 'b', transportCostCpPerLb: 0.1 })],
  }

  const result = runTradeClearing({
    settlements,
    graph,
    production: prod,
    priorRealizedIncomeCp: { b: 1_000_000 },
  })

  const flow = result.flows.find((f) => f.commodityId === 'grain')
  assert.ok(flow, 'expected a grain flow')
  assert.strictEqual(flow.fromSettlementId, 'a')
  assert.strictEqual(flow.toSettlementId, 'b')
  assert.strictEqual(flow.amount, 36500)
  assert.strictEqual(flow.mode, 'overland')

  assert.strictEqual(result.effectiveDelivered.b.foodLb, 36500)

  const prices = computeConnectedMarketPrices({ settlements, edges: graph.edges, production: prod })
  const expectedCp = (prices.a.grain - 0.1) * 36500
  const obligation = result.obligationDeltas.find(
    (o) => o.fromSettlementId === 'b' && o.toSettlementId === 'a',
  )
  assert.ok(obligation, 'expected b to owe a')
  assert.ok(Math.abs(obligation.amountCp - expectedCp) < 1e-6)

  assert.strictEqual(result.settlementCommodityRoles.a.grain, 'export')
  assert.strictEqual(result.settlementCommodityRoles.b.grain, 'import')
})

test('comfort raises food to 120% of survival while salt stays at 100%', () => {
  const settlements = [
    { id: 'a', population: 100 },
    { id: 'b', population: 100 },
  ]
  const prod = production({ a: { grain: 2_000_000, salt: 2_000_000 }, b: {} })
  const graph = {
    edges: [edge({ fromSettlementId: 'a', toSettlementId: 'b', transportCostCpPerLb: 0.01 })],
  }

  const result = runTradeClearing({
    settlements,
    graph,
    production: prod,
    priorRealizedIncomeCp: { b: 1_000_000_000 },
  })

  // Food climbs to 120% of the 36500 survival floor; salt holds at the 100% floor.
  assert.strictEqual(result.effectiveDelivered.b.foodLb, 43800)
  assert.strictEqual(result.effectiveDelivered.b.saltLb, 500)
})

test('prosperity fills each commodity to the 1 gp/person reference target at local price', () => {
  const settlements = [
    { id: 'a', population: 100 },
    { id: 'b', population: 100 },
  ]
  // Both self-sufficient in food/salt; only timber (a prosperity good) is scarce at b.
  const prod = production({
    a: { grain: 200000, salt: 200000, timber: 5_000_000 },
    b: { grain: 200000, salt: 200000 },
  })
  const graph = {
    edges: [edge({ fromSettlementId: 'a', toSettlementId: 'b', transportCostCpPerLb: 0.01 })],
  }

  const result = runTradeClearing({
    settlements,
    graph,
    production: prod,
    priorRealizedIncomeCp: { b: 1_000_000_000 },
  })

  // 1 gp/person at 0.5 cp/lb reference = (100 × 100) / 0.5 = 20000 lb timber.
  const timberTarget = 20000
  const timberFlow = result.flows.find((f) => f.commodityId === 'timber')
  assert.ok(timberFlow)
  assert.strictEqual(timberFlow.amount, timberTarget)

  const prices = computeConnectedMarketPrices({ settlements, edges: graph.edges, production: prod })
  const expectedCp = (prices.a.timber - 0.01) * timberTarget
  const obligation = result.obligationDeltas.find(
    (o) => o.fromSettlementId === 'b' && o.toSettlementId === 'a' && o.kind === 'goods',
  )
  assert.ok(obligation)
  assert.ok(Math.abs(obligation.amountCp - expectedCp) < 1e-6)
})

test('a haul costlier than the delivered value carries nothing', () => {
  const settlements = [
    { id: 'a', population: 100 },
    { id: 'b', population: 100 },
  ]
  const prod = production({ a: { grain: 200000 }, b: {} })
  // Grain local price caps at 2 cp/lb; a 5 cp/lb haul can never pay.
  const graph = {
    edges: [edge({ fromSettlementId: 'a', toSettlementId: 'b', transportCostCpPerLb: 5 })],
  }

  const result = runTradeClearing({
    settlements,
    graph,
    production: prod,
    priorRealizedIncomeCp: { b: 1_000_000_000 },
  })

  assert.strictEqual(result.flows.length, 0)
  assert.strictEqual(result.effectiveDelivered.b.foodLb, 0)
  assert.strictEqual(result.obligationDeltas.length, 0)
})

test('mode choice follows the cheaper delivered cost between parallel road and water edges', () => {
  const settlements = [
    { id: 'a', population: 100 },
    { id: 'b', population: 100 },
  ]
  const prod = production({ a: { grain: 73000 }, b: {} })

  const runWith = (roadCost, waterCost) =>
    runTradeClearing({
      settlements,
      production: prod,
      priorRealizedIncomeCp: { b: 1_000_000_000 },
      graph: {
        edges: [
          edge({ fromSettlementId: 'a', toSettlementId: 'b', mode: 'road', transportCostCpPerLb: roadCost }),
          edge({
            fromSettlementId: 'a',
            toSettlementId: 'b',
            mode: 'inlandWater',
            transportCostCpPerLb: waterCost,
          }),
        ],
      },
    })

  const waterCheaper = runWith(0.5, 0.2).flows.find((f) => f.commodityId === 'grain')
  assert.strictEqual(waterCheaper?.mode, 'inlandWater')

  const roadCheaper = runWith(0.1, 0.4).flows.find((f) => f.commodityId === 'grain')
  assert.strictEqual(roadCheaper?.mode, 'road')
})

test('overflow spills onto the next paying mode when the cheaper edge saturates', () => {
  const settlements = [
    { id: 'a', population: 100 },
    { id: 'b', population: 100 },
  ]
  const prod = production({ a: { grain: 2_000_000 }, b: {} })
  const graph = {
    edges: [
      edge({
        fromSettlementId: 'a',
        toSettlementId: 'b',
        mode: 'inlandWater',
        transportCostCpPerLb: 0.05,
        capacityLb: 10000,
      }),
      edge({
        fromSettlementId: 'a',
        toSettlementId: 'b',
        mode: 'road',
        transportCostCpPerLb: 0.2,
        capacityLb: 1e12,
      }),
    ],
  }

  const result = runTradeClearing({
    settlements,
    graph,
    production: prod,
    priorRealizedIncomeCp: { b: 1_000_000_000 },
  })

  const sumByMode = (mode) =>
    result.flows
      .filter((f) => f.commodityId === 'grain' && f.mode === mode)
      .reduce((sum, f) => sum + f.amount, 0)

  // Cheaper water fills to its 10000 capacity; the rest of comfort demand spills to road.
  assert.strictEqual(sumByMode('inlandWater'), 10000)
  assert.strictEqual(sumByMode('road'), 43800 - 10000)
  assert.strictEqual(result.effectiveDelivered.b.foodLb, 43800)
})

test('transshipment moves goods through an intermediate that neither buys nor resells', () => {
  const settlements = [
    { id: 'a', population: 100 },
    { id: 'm', population: 0 },
    { id: 'b', population: 100 },
  ]
  const prod = production({ a: { grain: 2_000_000 }, m: {}, b: {} })
  const graph = {
    edges: [
      edge({ fromSettlementId: 'a', toSettlementId: 'm', transportCostCpPerLb: 0.05 }),
      edge({ fromSettlementId: 'm', toSettlementId: 'b', transportCostCpPerLb: 0.05 }),
    ],
  }

  const result = runTradeClearing({
    settlements,
    graph,
    production: prod,
    priorRealizedIncomeCp: { b: 1_000_000_000 },
  })

  const legAM = result.flows
    .filter((f) => f.fromSettlementId === 'a' && f.toSettlementId === 'm')
    .reduce((s, f) => s + f.amount, 0)
  const legMB = result.flows
    .filter((f) => f.fromSettlementId === 'm' && f.toSettlementId === 'b')
    .reduce((s, f) => s + f.amount, 0)
  assert.strictEqual(legAM, 43800)
  assert.strictEqual(legMB, 43800)

  // The intermediate holds no cargo and takes on no goods obligation.
  assert.strictEqual(result.effectiveDelivered.m.foodLb, 0)
  const mInvolved = result.obligationDeltas.filter(
    (o) => o.fromSettlementId === 'm' || o.toSettlementId === 'm',
  )
  assert.strictEqual(mInvolved.length, 0)

  const goodsCp = result.obligationDeltas
    .filter((o) => o.fromSettlementId === 'b' && o.toSettlementId === 'a' && o.kind === 'goods')
    .reduce((s, o) => s + o.amountCp, 0)
  assert.ok(Math.abs(goodsCp - (0.5 - 0.1) * 43800) < 1e-6)
})

test('sea shipment tolls the importer at the loading port; the unload self-toll nets to zero', () => {
  const settlements = [
    { id: 'a', population: 100, maritimeRole: 'port' },
    { id: 'b', population: 100, maritimeRole: 'port' },
  ]
  const prod = production({ a: { grain: 73000 }, b: {} })
  const graph = {
    edges: [
      edge({ fromSettlementId: 'a', toSettlementId: 'b', mode: 'openSea', transportCostCpPerLb: 0.01 }),
    ],
  }

  const result = runTradeClearing({
    settlements,
    graph,
    production: prod,
    priorRealizedIncomeCp: { b: 1_000_000_000 },
  })

  const tolls = result.obligationDeltas.filter((o) => o.kind === 'toll')
  // Only the load toll at a survives; the unload toll at b (the importer) is self and omitted.
  assert.strictEqual(tolls.length, 1)
  assert.strictEqual(tolls[0].fromSettlementId, 'b')
  assert.strictEqual(tolls[0].toSettlementId, 'a')

  const prices = computeConnectedMarketPrices({ settlements, edges: graph.edges, production: prod })
  const expectedTollCp = 0.05 * prices.a.grain * 36500
  assert.ok(Math.abs(tolls[0].amountCp - expectedTollCp) < 1e-6)

  // No obligation is ever a settlement owing itself.
  assert.ok(result.obligationDeltas.every((o) => o.fromSettlementId !== o.toSettlementId))
})

test('credit limit caps imports at a settlement without collateral or income', () => {
  const settlements = [
    { id: 'a', population: 100 },
    { id: 'b', population: 100 },
  ]
  const prod = production({ a: { grain: 73000 }, b: {} })
  const graph = {
    edges: [edge({ fromSettlementId: 'a', toSettlementId: 'b', transportCostCpPerLb: 0.1 })],
  }
  const prices = computeConnectedMarketPrices({ settlements, edges: graph.edges, production: prod })
  const netUnit = prices.a.grain - 0.1

  const capped = runTradeClearing({
    settlements,
    graph,
    production: prod,
    priorRealizedIncomeCp: { b: 18000 },
  })
  // Import stops once b's 18000 cp credit is spent, short of the 36500 survival floor.
  assert.ok(capped.effectiveDelivered.b.foodLb > 0)
  assert.ok(capped.effectiveDelivered.b.foodLb < 36500)
  const bDebt = capped.obligationDeltas
    .filter((o) => o.fromSettlementId === 'b')
    .reduce((s, o) => s + o.amountCp, 0)
  assert.ok(Math.abs(bDebt - 18000) < 1e-3)
  assert.ok(Math.abs(capped.effectiveDelivered.b.foodLb - 18000 / netUnit) < 1e-6)

  const funded = runTradeClearing({
    settlements,
    graph,
    production: prod,
    priorRealizedIncomeCp: { b: 1_000_000_000 },
  })
  assert.strictEqual(funded.effectiveDelivered.b.foodLb, 36500)
})

test('off-map exports clear before imports so earnings fund the purchase', () => {
  const settlements = [{ id: 'p', population: 100, maritimeRole: 'port' }]
  // Grain surplus to export; every prosperity good but timber met locally at its target.
  const prod = production({
    p: { grain: 200000, salt: 500, baseMetals: 1000, copper: 200, silver: 20, gold: 2, diamonds: 0.02 },
  })

  const result = runTradeClearing({ settlements, graph: { edges: [] }, production: prod })

  const grainExport = result.offMapTrades.find(
    (t) => t.commodityId === 'grain' && t.direction === 'export',
  )
  assert.ok(grainExport)
  assert.strictEqual(grainExport.amount, 200000 - 43800)
  assert.strictEqual(grainExport.unitPriceCp, 0.5)

  const timberImport = result.offMapTrades.find(
    (t) => t.commodityId === 'timber' && t.direction === 'import',
  )
  assert.ok(timberImport)
  assert.strictEqual(timberImport.amount, 20000)
  assert.strictEqual(timberImport.unitPriceCp, 1)

  // Export earnings + loading toll minus the import spend, staying positive.
  const earnings = 156200 * 0.5 + 0.05 * 0.5 * 156200
  assert.ok(Math.abs(result.externalAccountDeltas.p - (earnings - 20000)) < 1e-6)
  assert.ok(result.externalAccountDeltas.p > 0)
})

test('off-map imports cannot drive the external account negative', () => {
  const settlements = [{ id: 'p', population: 100, maritimeRole: 'port' }]
  // Only a tiny grain surplus, so timber imports are throttled by external earnings.
  const prod = production({ p: { grain: 44800, salt: 500 } })

  const result = runTradeClearing({ settlements, graph: { edges: [] }, production: prod })

  const earnings = 1000 * 0.5 + 0.05 * 0.5 * 1000
  const timberImport = result.offMapTrades.find(
    (t) => t.commodityId === 'timber' && t.direction === 'import',
  )
  assert.ok(timberImport)
  // Import is capped at what earnings can buy (earnings / 1 cp per lb), never more.
  assert.ok(Math.abs(timberImport.amount - earnings) < 1e-6)
  assert.ok((result.externalAccountDeltas.p ?? 0) >= -1e-9)
})

test('mutual credit nets opposing pair obligations and realm balances sum to zero', () => {
  const settlements = [
    { id: 'a', population: 100 },
    { id: 'b', population: 100 },
  ]
  // a sells copper to b; b sells timber to a — opposing obligations on the same pair.
  const prod = production({
    a: { grain: 200000, salt: 200000, copper: 5000 },
    b: { grain: 200000, salt: 200000, timber: 5_000_000 },
  })
  const graph = {
    edges: [edge({ fromSettlementId: 'a', toSettlementId: 'b', transportCostCpPerLb: 0.01 })],
  }

  const result = runTradeClearing({
    settlements,
    graph,
    production: prod,
    priorRealizedIncomeCp: { a: 1_000_000_000, b: 1_000_000_000 },
  })

  // Both directions traded.
  assert.ok(result.flows.some((f) => f.commodityId === 'copper' && f.toSettlementId === 'b'))
  assert.ok(result.flows.some((f) => f.commodityId === 'timber' && f.toSettlementId === 'a'))

  // Pair netting collapses the two opposing obligations into a single edge.
  const abObligations = result.nettedObligations.filter(
    (o) =>
      (o.creditorSettlementId === 'a' && o.debtorSettlementId === 'b') ||
      (o.creditorSettlementId === 'b' && o.debtorSettlementId === 'a'),
  )
  assert.strictEqual(abObligations.length, 1)

  const balanceSum = Object.values(result.realmBalancesCp).reduce((s, v) => s + v, 0)
  assert.ok(Math.abs(balanceSum) < 1e-6)
})

test('a fixed three-settlement fixture clears deterministically', () => {
  const settlements = [
    { id: 'harbor', population: 200, maritimeRole: 'port' },
    { id: 'vale', population: 100 },
    { id: 'ridge', population: 150 },
  ]
  const prod = production({
    harbor: { grain: 400000, fish: 200000, salt: 400000 },
    vale: { timber: 3_000_000, grain: 20000 },
    ridge: { baseMetals: 100000, copper: 4000, grain: 30000 },
  })
  const graph = {
    edges: [
      edge({ fromSettlementId: 'harbor', toSettlementId: 'vale', transportCostCpPerLb: 0.05 }),
      edge({ fromSettlementId: 'vale', toSettlementId: 'ridge', transportCostCpPerLb: 0.05 }),
      edge({
        fromSettlementId: 'harbor',
        toSettlementId: 'ridge',
        mode: 'road',
        transportCostCpPerLb: 0.08,
      }),
    ],
  }
  const args = {
    settlements,
    graph,
    production: prod,
    offMapShippingCost: 2,
    priorRealizedIncomeCp: { harbor: 5_000_000, vale: 5_000_000, ridge: 5_000_000 },
  }

  const first = runTradeClearing(args)
  const second = runTradeClearing(args)
  assert.deepStrictEqual(first, second)

  // Zero-sum mutual credit and no self-obligations hold on the fixture.
  const balanceSum = Object.values(first.realmBalancesCp).reduce((s, v) => s + v, 0)
  assert.ok(Math.abs(balanceSum) < 1e-6)
  assert.ok(first.obligationDeltas.every((o) => o.fromSettlementId !== o.toSettlementId))

  // Survival food is met everywhere the market can reach it.
  for (const s of settlements) {
    assert.ok(first.effectiveDelivered[s.id].foodLb >= 365 * s.population - 1e-6)
  }
})
