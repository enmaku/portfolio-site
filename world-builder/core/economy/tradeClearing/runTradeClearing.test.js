import assert from 'node:assert/strict'
import test from 'node:test'
import { runTradeClearing, runTradeClearingSync } from './runTradeClearing.js'
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

  const result = runTradeClearingSync({
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
  const expectedCp = (prices.b.grain - 0.1) * 36500
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

  const result = runTradeClearingSync({
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

  const result = runTradeClearingSync({
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
  const expectedCp = (prices.b.timber - 0.01) * timberTarget
  const obligation = result.obligationDeltas.find(
    (o) => o.fromSettlementId === 'b' && o.toSettlementId === 'a' && o.kind === 'goods',
  )
  assert.ok(obligation)
  assert.ok(Math.abs(obligation.amountCp - expectedCp) < 1e-6)
})

test('a haul costlier than the arbitrage gap carries nothing', () => {
  const settlements = [
    { id: 'a', population: 100 },
    { id: 'b', population: 100 },
  ]
  const prod = production({ a: { grain: 200000 }, b: {} })
  // Max price gap is 1.5 cp/lb (2 − 0.5); a 5 cp/lb haul cannot pay.
  const graph = {
    edges: [edge({ fromSettlementId: 'a', toSettlementId: 'b', transportCostCpPerLb: 5 })],
  }

  const result = runTradeClearingSync({
    settlements,
    graph,
    production: prod,
    priorRealizedIncomeCp: { b: 1_000_000_000 },
  })

  assert.strictEqual(result.flows.length, 0)
  assert.strictEqual(result.effectiveDelivered.b.foodLb, 0)
  assert.strictEqual(result.obligationDeltas.length, 0)
})

test('goods move only when importer local price exceeds exporter price by more than haul', () => {
  const settlements = [
    { id: 'a', population: 100 },
    { id: 'b', population: 100 },
  ]
  // Matched grain so both sit near the same local price; a small haul still has no wedge.
  const prod = production({
    a: { grain: 43800, salt: 500 },
    b: { grain: 43800, salt: 500 },
  })
  const graph = {
    edges: [edge({ fromSettlementId: 'a', toSettlementId: 'b', transportCostCpPerLb: 0.1 })],
  }

  const result = runTradeClearingSync({
    settlements,
    graph,
    production: prod,
    priorRealizedIncomeCp: { a: 1_000_000, b: 1_000_000 },
  })

  assert.strictEqual(
    result.flows.filter((f) => f.commodityId === 'grain').length,
    0,
  )
})

test('mode choice follows the cheaper delivered cost between parallel road and water edges', () => {
  const settlements = [
    { id: 'a', population: 100 },
    { id: 'b', population: 100 },
  ]
  const prod = production({ a: { grain: 73000 }, b: {} })

  const runWith = (roadCost, waterCost) =>
    runTradeClearingSync({
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

  const result = runTradeClearingSync({
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

  const result = runTradeClearingSync({
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
  const prices = computeConnectedMarketPrices({ settlements, edges: graph.edges, production: prod })
  assert.ok(Math.abs(goodsCp - (prices.b.grain - 0.1) * 43800) < 1e-6)
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

  const result = runTradeClearingSync({
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
  const expectedTollCp = 0.05 * prices.b.grain * 36500
  assert.ok(Math.abs(tolls[0].amountCp - expectedTollCp) < 1e-6)
  assert.ok(Math.abs((result.portTollIncomeCpBySettlementId.a ?? 0) - expectedTollCp) < 1e-6)
  assert.strictEqual(result.portTollIncomeCpBySettlementId.b, undefined)

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
  const netUnit = prices.b.grain - 0.1

  const capped = runTradeClearingSync({
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

  const funded = runTradeClearingSync({
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
    p: { grain: 200000, salt: 500, baseMetals: 1000, copper: 200, silver: 20, gold: 2, diamonds: 0.01 },
  })

  const result = runTradeClearingSync({ settlements, graph: { edges: [] }, production: prod })

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
  assert.strictEqual(timberImport.unitPriceCp, 1.25)

  // Export earnings + loading toll minus the import spend, staying positive.
  const loadingToll = 0.05 * 0.5 * 156200
  const earnings = 156200 * 0.5 + loadingToll
  const timberSpend = 20000 * 1.25
  assert.ok(Math.abs(result.externalAccountDeltas.p - (earnings - timberSpend)) < 1e-6)
  assert.ok(result.externalAccountDeltas.p > 0)
  assert.ok(Math.abs((result.portTollIncomeCpBySettlementId.p ?? 0) - loadingToll) < 1e-6)
})

test('off-map imports cannot drive the external account negative', () => {
  const settlements = [{ id: 'p', population: 100, maritimeRole: 'port' }]
  // Only a tiny grain surplus, so timber imports are throttled by external earnings.
  const prod = production({ p: { grain: 44800, salt: 500 } })

  const result = runTradeClearingSync({ settlements, graph: { edges: [] }, production: prod })

  const earnings = 1000 * 0.5 + 0.05 * 0.5 * 1000
  const timberImport = result.offMapTrades.find(
    (t) => t.commodityId === 'timber' && t.direction === 'import',
  )
  assert.ok(timberImport)
  // Import is capped at what earnings can buy (earnings / 1.25 cp per lb), never more.
  assert.ok(Math.abs(timberImport.amount - earnings / 1.25) < 1e-6)
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

  const result = runTradeClearingSync({
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
    priorRealizedIncomeCp: { harbor: 5_000_000, vale: 5_000_000, ridge: 5_000_000 },
  }

  const first = runTradeClearingSync(args)
  const second = runTradeClearingSync(args)
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

test('runTradeClearing reports trade substep indices in order and matches sync without yields', async () => {
  const settlements = [
    { id: 'a', population: 100 },
    { id: 'b', population: 100 },
  ]
  const prod = production({ a: { grain: 73000 }, b: {} })
  const graph = {
    edges: [edge({ fromSettlementId: 'a', toSettlementId: 'b', transportCostCpPerLb: 0.1 })],
  }
  const params = {
    settlements,
    graph,
    production: prod,
    priorRealizedIncomeCp: { b: 1_000_000 },
  }

  /** @type {Array<{ type: string, substepIndex: number, substepId: string }>} */
  const events = []
  const withYields = await runTradeClearing(params, {
    yieldToUi: async () => {},
    hooks: {
      onTradeSubstep(payload) {
        events.push({
          type: payload.type,
          substepIndex: payload.substepIndex,
          substepId: payload.substepId,
        })
      },
    },
  })
  const bare = await runTradeClearing(params)
  const sync = runTradeClearingSync(params)

  assert.deepStrictEqual(withYields, bare)
  assert.deepStrictEqual(withYields, sync)
  assert.deepStrictEqual(
    events.map((e) => `${e.type}:${e.substepIndex}:${e.substepId}`),
    [
      'substep-start:0:localPrices',
      'substep-complete:0:localPrices',
      'substep-start:1:survival',
      'substep-complete:1:survival',
      'substep-start:2:comfort',
      'substep-complete:2:comfort',
      'substep-start:3:prosperity',
      'substep-item:3:prosperity',
      'substep-item:3:prosperity',
      'substep-item:3:prosperity',
      'substep-item:3:prosperity',
      'substep-item:3:prosperity',
      'substep-item:3:prosperity',
      'substep-complete:3:prosperity',
      'substep-start:4:offMap',
      'substep-item:4:offMap',
      'substep-item:4:offMap',
      'substep-item:4:offMap',
      'substep-item:4:offMap',
      'substep-complete:4:offMap',
    ],
  )
})

test('prior trade accounts seed net owed so debt carries into the next clear', () => {
  const settlements = [
    { id: 'a', population: 100 },
    { id: 'b', population: 100 },
  ]
  const prod = production({
    a: { grain: 200000, salt: 200000, timber: 5_000_000 },
    b: { grain: 200000, salt: 200000 },
  })
  const graph = {
    edges: [edge({ fromSettlementId: 'a', toSettlementId: 'b', transportCostCpPerLb: 0.01 })],
  }

  const first = runTradeClearingSync({
    settlements,
    graph,
    production: prod,
    priorRealizedIncomeCp: { a: 1_000_000, b: 1_000_000 },
  })
  assert.ok((first.realmBalancesCp.b ?? 0) < 0)

  const second = runTradeClearingSync({
    settlements,
    graph,
    production: prod,
    priorRealizedIncomeCp: { a: 1_000_000, b: 1_000_000 },
    priorTradeAccounts: {
      obligations: first.nettedObligations,
      balancesBySettlementId: first.realmBalancesCp,
    },
  })

  assert.ok(
    (second.realmBalancesCp.b ?? 0) <= (first.realmBalancesCp.b ?? 0) + 1e-6,
    'carried debt should not reset',
  )
  assert.ok(second.nettedObligations.some((o) => o.debtorSettlementId === 'b' && o.amountCp > 0))
})

test('opening over the credit limit freezes prosperity even after same-epoch earnings', () => {
  const settlements = [
    { id: 'a', population: 100 },
    { id: 'b', population: 100 },
  ]
  const prod = production({
    a: { grain: 500000, salt: 500000, timber: 5_000_000 },
    b: { grain: 0, salt: 0, timber: 0 },
  })
  const graph = {
    edges: [edge({ fromSettlementId: 'a', toSettlementId: 'b', transportCostCpPerLb: 0.01 })],
  }

  const result = runTradeClearingSync({
    settlements,
    graph,
    production: prod,
    priorRealizedIncomeCp: { b: 1000 },
    priorTradeAccounts: {
      obligations: [{ creditorSettlementId: 'a', debtorSettlementId: 'b', amountCp: 500_000 }],
      balancesBySettlementId: { a: 500_000, b: -500_000 },
    },
  })

  assert.equal(
    result.flows.some((f) => f.commodityId === 'timber' && f.toSettlementId === 'b'),
    false,
    'prosperity imports should stay frozen',
  )
  assert.ok((result.realmBalancesCp.b ?? 0) >= -500_000 - 1e-3, 'debt must not deepen past opening')
})
