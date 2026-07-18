/**
 * Prioritized minimum-cost multi-commodity trade clearing.
 * Domain: world-builder/CONTEXT.md — trade clearing, survival allocation, survival
 * comfort, material prosperity, off-map trade, mutual credit, port toll, credit limit.
 */

import { cargoLbPerUnit } from '../commodityCatalog.js'
import { emptyCommodityAmounts, FISH_CURING_SALT_PER_FISH_LB } from '../productionAccounting.js'
import { computeConnectedMarketPrices } from '../localPrices.js'
import {
  PROSPERITY_COMMODITIES,
  comfortFoodDemandLb,
  exportableSurplusValueCp,
  prosperityDemandUnits,
  survivalFoodDemandLb,
  survivalSaltDemandLb,
} from './allocationTiers.js'
import { findMinCostPath } from './pathSearch.js'
import { clearOffMapTrade } from './offMapTrade.js'
import { creditLimitCp } from '../ledgers/creditLimit.js'
import { createEmptyTradeAccounts, applyObligation } from '../ledgers/bilateralObligations.js'

/**
 * @typedef {import('../commodityCatalog.js').CommodityId} CommodityId
 * @typedef {import('../tradeGraph/buildCandidateRoutes.js').CandidateTradeGraph} CandidateTradeGraph
 * @typedef {import('../tradeGraph/buildCandidateRoutes.js').TradeRouteEdge} TradeRouteEdge
 * @typedef {import('../tradeGraph/routeEconomics.js').TradeRouteMode} TradeRouteMode
 */

/** @typedef {'neither' | 'import' | 'export' | 'both'} CommodityTradeRole */

/** Baseline port toll: 5% of full local price. */
export const PORT_TOLL_RATE = 0.05

const EPSILON = 1e-6

/**
 * @typedef {Object} TradeFlow
 * @property {string} edgeId
 * @property {string} fromSettlementId
 * @property {string} toSettlementId
 * @property {CommodityId} commodityId
 * @property {number} amount
 * @property {TradeRouteMode} mode
 */

/**
 * @typedef {Object} ObligationDelta
 * @property {string} fromSettlementId Debtor (importer / toll payer).
 * @property {string} toSettlementId Creditor (exporter / toll collector).
 * @property {number} amountCp
 * @property {'goods' | 'toll'} kind
 */

/**
 * @typedef {Object} OffMapTrade
 * @property {string} settlementId Port trading off-map.
 * @property {CommodityId} commodityId
 * @property {'import' | 'export'} direction
 * @property {number} amount Catalog units.
 * @property {number} unitPriceCp Discounted/inflated off-map unit price.
 */

/**
 * @typedef {Object} TradeClearingResult
 * @property {TradeFlow[]} flows
 * @property {Record<string, Record<CommodityId, CommodityTradeRole>>} settlementCommodityRoles
 * @property {Record<string, Record<CommodityId, number>>} localPricesBySettlementId
 * @property {ObligationDelta[]} obligationDeltas
 * @property {Record<string, number>} externalAccountDeltas
 * @property {Record<string, { foodLb: number, saltLb: number }>} effectiveDelivered
 * @property {Record<string, number>} realmBalancesCp Net mutual-credit balance per realm (sum ≈ 0).
 * @property {OffMapTrade[]} offMapTrades
 * @property {import('../ledgers/bilateralObligations.js').BilateralObligation[]} nettedObligations
 */

/**
 * @typedef {ReturnType<typeof createClearingState>} ClearingState
 */

/**
 * @typedef {Object} TradeClearingHooks
 * @property {(payload: {
 *   type: 'substep-start' | 'substep-complete' | 'substep-item',
 *   substepIndex: number,
 *   substepId: string,
 *   itemIndex?: number,
 *   itemCount?: number,
 * }) => void} [onTradeSubstep]
 */

/**
 * @typedef {Object} TradeClearingOptions
 * @property {TradeClearingHooks} [hooks]
 * @property {() => Promise<void>} [yieldToUi]
 */

/**
 * @param {{
 *   settlements?: Array<{ id: string, population?: number, maritimeRole?: string }>,
 *   graph?: CandidateTradeGraph,
 *   production?: Record<string, Partial<Record<CommodityId, number>>>,
 *   offMapShippingCost?: number,
 *   priorRealizedIncomeCp?: Record<string, number>,
 *   externalAccountsCp?: Record<string, number>,
 * }} [params]
 * @param {TradeClearingOptions} [options]
 * @returns {Promise<TradeClearingResult>}
 */
export async function runTradeClearing(params = {}, options = {}) {
  const { hooks, yieldToUi } = options

  emitTradeSubstep(hooks, 'substep-start', 0, 'localPrices')
  await yieldToUi?.()
  const state = createClearingState(params)
  emitTradeSubstep(hooks, 'substep-complete', 0, 'localPrices')
  await yieldToUi?.()

  emitTradeSubstep(hooks, 'substep-start', 1, 'survival')
  await yieldToUi?.()
  clearFoodTier(state, survivalFoodDemandLb)
  clearSaltTier(state, survivalSaltDemandLb)
  emitTradeSubstep(hooks, 'substep-complete', 1, 'survival')
  await yieldToUi?.()

  emitTradeSubstep(hooks, 'substep-start', 2, 'comfort')
  await yieldToUi?.()
  clearFoodTier(state, comfortFoodDemandLb)
  emitTradeSubstep(hooks, 'substep-complete', 2, 'comfort')
  await yieldToUi?.()

  emitTradeSubstep(hooks, 'substep-start', 3, 'prosperity')
  await yieldToUi?.()
  const prosperityCount = PROSPERITY_COMMODITIES.length
  for (let index = 0; index < prosperityCount; index += 1) {
    emitTradeSubstep(hooks, 'substep-item', 3, 'prosperity', index + 1, prosperityCount)
    await yieldToUi?.()
    clearProsperityCommodity(state, PROSPERITY_COMMODITIES[index])
  }
  emitTradeSubstep(hooks, 'substep-complete', 3, 'prosperity')
  await yieldToUi?.()

  emitTradeSubstep(hooks, 'substep-start', 4, 'offMap')
  await yieldToUi?.()
  clearOffMapTrade(state)
  emitTradeSubstep(hooks, 'substep-complete', 4, 'offMap')
  await yieldToUi?.()

  return buildResult(state)
}

/**
 * Synchronous clearing for call sites that cannot await (founding commit).
 * Prefer {@link runTradeClearing} everywhere else.
 *
 * @param {Parameters<typeof runTradeClearing>[0]} [params]
 * @returns {TradeClearingResult}
 */
export function runTradeClearingSync(params = {}) {
  const state = createClearingState(params)

  clearFoodTier(state, survivalFoodDemandLb)
  clearSaltTier(state, survivalSaltDemandLb)
  clearFoodTier(state, comfortFoodDemandLb)
  for (const commodityId of PROSPERITY_COMMODITIES) {
    clearProsperityCommodity(state, commodityId)
  }
  clearOffMapTrade(state)

  return buildResult(state)
}

/**
 * @param {TradeClearingHooks | undefined} hooks
 * @param {'substep-start' | 'substep-complete' | 'substep-item'} type
 * @param {number} substepIndex
 * @param {string} substepId
 * @param {number} [itemIndex]
 * @param {number} [itemCount]
 */
function emitTradeSubstep(hooks, type, substepIndex, substepId, itemIndex, itemCount) {
  hooks?.onTradeSubstep?.({
    type,
    substepIndex,
    substepId,
    ...(typeof itemIndex === 'number' ? { itemIndex } : {}),
    ...(typeof itemCount === 'number' ? { itemCount } : {}),
  })
}

/**
 * @param {Parameters<typeof runTradeClearing>[0]} params
 */
function createClearingState(params = {}) {
  const settlements = (params.settlements ?? []).map((s) => ({
    id: s.id,
    population: Math.max(0, Number(s.population) || 0),
    isPort: s.maritimeRole === 'port',
  }))
  const edges = params.graph?.edges ?? []
  const production = params.production ?? {}
  const offMapShippingCost = Math.max(1, Number(params.offMapShippingCost) || 2)

  const localPrices = computeConnectedMarketPrices({
    settlements: settlements.map((s) => ({ id: s.id, population: s.population })),
    edges,
    production,
  })

  /** @type {Map<string, { id: string, population: number, isPort: boolean }>} */
  const byId = new Map(settlements.map((s) => [s.id, s]))
  /** @type {Map<string, Record<CommodityId, number>>} */
  const held = new Map()
  /** @type {Record<string, Record<CommodityId, CommodityTradeRole>>} */
  const roles = {}
  for (const s of settlements) {
    held.set(s.id, { ...emptyCommodityAmounts(), ...(production[s.id] ?? {}) })
    roles[s.id] = /** @type {Record<CommodityId, CommodityTradeRole>} */ ({ ...neutralRoles() })
  }

  /** @type {Map<string, number>} */
  const remainingCapLbByEdgeId = new Map()
  for (const edge of edges) remainingCapLbByEdgeId.set(edge.id, Math.max(0, edge.capacityLb))

  const creditLimit = new Map(
    settlements.map((s) => [
      s.id,
      creditLimitCp({
        priorRealizedNetExportTollIncomeCp: params.priorRealizedIncomeCp?.[s.id] ?? 0,
        exportableSurplusAfterSurvivalReservationCp: exportableSurplusValueCp({
          population: s.population,
          production: production[s.id] ?? {},
          prices: localPrices[s.id] ?? {},
        }),
      }),
    ]),
  )

  /** @type {Map<string, number>} netOwed: debits − credits (positive = owes) */
  const netOwed = new Map(settlements.map((s) => [s.id, 0]))
  /** @type {Map<string, number>} absolute external balances (cannot go negative) */
  const externalAccounts = new Map(
    settlements.map((s) => [s.id, Math.max(0, params.externalAccountsCp?.[s.id] ?? 0)]),
  )
  const externalInitial = new Map(externalAccounts)

  return {
    settlements,
    edges,
    byId,
    held,
    roles,
    localPrices,
    offMapShippingCost,
    remainingCapLbByEdgeId,
    creditLimit,
    netOwed,
    externalAccounts,
    externalInitial,
    /** @type {TradeFlow[]} */
    flows: [],
    /** @type {ObligationDelta[]} */
    obligationDeltas: [],
    /** @type {OffMapTrade[]} */
    offMapTrades: [],
    isPort: (/** @type {string} */ id) => byId.get(id)?.isPort === true,
  }
}

/** @returns {Record<CommodityId, CommodityTradeRole>} */
function neutralRoles() {
  return /** @type {Record<CommodityId, CommodityTradeRole>} */ ({
    grain: 'neither',
    fish: 'neither',
    salt: 'neither',
    timber: 'neither',
    baseMetals: 'neither',
    copper: 'neither',
    silver: 'neither',
    gold: 'neither',
    diamonds: 'neither',
  })
}

/**
 * Food tier: fulfillment counts grain + fish; ships grain first, then cured fish.
 *
 * @param {ReturnType<typeof createClearingState>} state
 * @param {(pop: number) => number} targetFn
 */
function clearFoodTier(state, targetFn) {
  clearResource(state, {
    commodities: ['grain', 'fish'],
    targetOf: (s) => targetFn(s.population),
    heldResource: (id) => {
      const bag = state.held.get(id)
      return (bag?.grain ?? 0) + (bag?.fish ?? 0)
    },
    resourceKind: 'food',
  })
}

/**
 * @param {ReturnType<typeof createClearingState>} state
 * @param {(pop: number) => number} targetFn
 */
function clearSaltTier(state, targetFn) {
  clearResource(state, {
    commodities: ['salt'],
    targetOf: (s) => targetFn(s.population),
    heldResource: (id) => state.held.get(id)?.salt ?? 0,
    resourceKind: 'salt',
  })
}

/**
 * @param {ReturnType<typeof createClearingState>} state
 * @param {CommodityId} commodityId
 */
function clearProsperityCommodity(state, commodityId) {
  clearResource(state, {
    commodities: [commodityId],
    targetOf: (s) => prosperityDemandUnits(commodityId, s.population),
    heldResource: (id) => state.held.get(id)?.[commodityId] ?? 0,
    resourceKind: 'prosperity',
  })
}

/**
 * Max-min fair clearing of one resource: raise every settlement's lowest fulfillment
 * ratio before any climbs higher, subject to capacity, credit, profitability, and
 * (for fish) curing salt.
 *
 * @param {ReturnType<typeof createClearingState>} state
 * @param {{
 *   commodities: CommodityId[],
 *   targetOf: (s: { population: number }) => number,
 *   heldResource: (id: string) => number,
 *   resourceKind: 'food' | 'salt' | 'prosperity',
 * }} spec
 */
function clearResource(state, spec) {
  const { commodities, targetOf, heldResource } = spec
  /** @type {Set<string>} */
  const blocked = new Set()

  for (let guard = 0; guard < 100000; guard += 1) {
    const ranked = state.settlements
      .map((s) => ({ s, target: targetOf(s), held: heldResource(s.id) }))
      .filter((row) => row.target > EPSILON)
      .map((row) => ({ ...row, ratio: row.held / row.target }))
      .sort((a, b) => a.ratio - b.ratio || (a.s.id < b.s.id ? -1 : 1))

    const deficits = ranked.filter((row) => row.held < row.target - EPSILON && !blocked.has(row.s.id))
    if (deficits.length === 0) break

    const target = deficits[0]
    const secondRatio = ranked.find((row) => row.s.id !== target.s.id && row.ratio > target.ratio)?.ratio
    const capRatio = Math.min(1, secondRatio ?? 1)
    let raiseUnits = target.target * capRatio - target.held
    if (raiseUnits <= EPSILON) raiseUnits = target.target - target.held

    const move = planBestMove(state, { spec, targetId: target.s.id, commodities })
    if (!move) {
      blocked.add(target.s.id)
      continue
    }
    const applied = applyMove(state, {
      move,
      maxUnits: raiseUnits,
      resourceKind: spec.resourceKind,
    })
    if (applied <= EPSILON) blocked.add(target.s.id)
  }
}

/**
 * Choose the cheapest profitable source+commodity path delivering to the target.
 *
 * @param {ReturnType<typeof createClearingState>} state
 * @param {{
 *   spec: { targetOf: (s: { population: number }) => number },
 *   targetId: string,
 *   commodities: CommodityId[],
 * }} params
 * @returns {{
 *   commodityId: CommodityId,
 *   path: import('./pathSearch.js').FoundPath,
 *   netUnitValueCp: number,
 *   importerUnitCostCp: number,
 * } | null}
 */
function planBestMove(state, params) {
  const { targetId, commodities } = params
  let best = null
  for (const commodityId of commodities) {
    const priceAtDest = state.localPrices[targetId]?.[commodityId] ?? 0
    const unitTollCp = PORT_TOLL_RATE * priceAtDest
    const sources = state.settlements.filter(
      (s) => s.id !== targetId && exportableUnits(state, s, params.spec, commodityId) > EPSILON,
    )
    for (const source of sources) {
      const path = findMinCostPath({
        edges: state.edges,
        remainingCapLbByEdgeId: state.remainingCapLbByEdgeId,
        sourceIds: [source.id],
        targetId,
        commodityId,
        isPort: state.isPort,
        unitTollCp,
      })
      if (!path) continue

      const priceAtOrigin = state.localPrices[path.originId]?.[commodityId] ?? 0
      const tollUnitCp = path.tollEvents.reduce((sum, e) => sum + e.unitTollCp, 0)
      const arbitrageGapCp = priceAtDest - priceAtOrigin - path.transportUnitCp - tollUnitCp
      if (arbitrageGapCp <= EPSILON) continue

      const netUnitValueCp = priceAtDest - path.transportUnitCp
      if (netUnitValueCp <= EPSILON) continue

      const importerUnitCostCp = netUnitValueCp + tollUnitCp
      const candidate = {
        commodityId,
        path,
        netUnitValueCp,
        importerUnitCostCp,
        arbitrageGapCp,
      }
      if (
        !best ||
        candidate.arbitrageGapCp > best.arbitrageGapCp + 1e-9 ||
        (Math.abs(candidate.arbitrageGapCp - best.arbitrageGapCp) <= 1e-9 &&
          candidate.path.totalUnitCp < best.path.totalUnitCp - 1e-9)
      ) {
        best = candidate
      }
    }
  }
  return best
}

/**
 * @param {ReturnType<typeof createClearingState>} state
 * @param {{ id: string }} source
 * @param {{ targetOf: (s: { population: number }) => number }} spec
 * @param {CommodityId} commodityId
 * @returns {number}
 */
function exportableUnits(state, source, spec, commodityId) {
  const settlement = state.byId.get(source.id)
  if (!settlement) return 0
  const bag = state.held.get(source.id)
  if (!bag) return 0
  const target = spec.targetOf(settlement)
  if (commodityId === 'grain' || commodityId === 'fish') {
    const food = (bag.grain ?? 0) + (bag.fish ?? 0)
    const exportableFood = Math.max(0, food - target)
    return Math.min(bag[commodityId] ?? 0, exportableFood)
  }
  return Math.max(0, (bag[commodityId] ?? 0) - target)
}

/**
 * @param {ReturnType<typeof createClearingState>} state
 * @param {{
 *   move: NonNullable<ReturnType<typeof planBestMove>>,
 *   maxUnits: number,
 *   resourceKind: 'food' | 'salt' | 'prosperity',
 * }} params
 * @returns {number} units actually moved
 */
function applyMove(state, params) {
  const { move, maxUnits } = params
  const { commodityId, path, netUnitValueCp, importerUnitCostCp } = move
  const importerId = path.legs.length > 0 ? path.legs[path.legs.length - 1].to : move.path.originId
  const originId = path.originId

  const originBag = state.held.get(originId)
  const importerBag = state.held.get(importerId)
  if (!originBag || !importerBag) return 0

  let limit = Math.min(maxUnits, path.bottleneckUnits, Math.max(0, originBag[commodityId] ?? 0))

  const room = (state.creditLimit.get(importerId) ?? 0) - (state.netOwed.get(importerId) ?? 0)
  if (importerUnitCostCp > EPSILON) limit = Math.min(limit, Math.max(0, room) / importerUnitCostCp)

  if (commodityId === 'fish') {
    const availableSalt = originBag.salt ?? 0
    const maxFishByCuring = availableSalt * FISH_CURING_SALT_PER_FISH_LB
    limit = Math.min(limit, maxFishByCuring)
  }

  if (!(limit > EPSILON)) return 0

  originBag[commodityId] -= limit
  importerBag[commodityId] += limit
  if (commodityId === 'fish') {
    originBag.salt -= limit / FISH_CURING_SALT_PER_FISH_LB
  }

  const cargoLb = cargoLbPerUnit(commodityId)
  for (const leg of path.legs) {
    state.remainingCapLbByEdgeId.set(
      leg.edgeId,
      (state.remainingCapLbByEdgeId.get(leg.edgeId) ?? 0) - limit * cargoLb,
    )
    state.flows.push({
      edgeId: leg.edgeId,
      fromSettlementId: leg.from,
      toSettlementId: leg.to,
      commodityId,
      amount: limit,
      mode: leg.mode,
    })
  }

  addObligation(state, {
    fromSettlementId: importerId,
    toSettlementId: originId,
    amountCp: netUnitValueCp * limit,
    kind: 'goods',
  })
  for (const event of path.tollEvents) {
    addObligation(state, {
      fromSettlementId: importerId,
      toSettlementId: event.portId,
      amountCp: event.unitTollCp * limit,
      kind: 'toll',
    })
  }

  markRole(state, originId, commodityId, 'export')
  markRole(state, importerId, commodityId, 'import')
  return limit
}

/**
 * @param {ReturnType<typeof createClearingState>} state
 * @param {import('./runTradeClearing.js').ObligationDelta} delta
 */
export function addObligation(state, delta) {
  if (delta.fromSettlementId === delta.toSettlementId) return
  if (!(delta.amountCp > EPSILON)) return
  state.obligationDeltas.push(delta)
  state.netOwed.set(delta.fromSettlementId, (state.netOwed.get(delta.fromSettlementId) ?? 0) + delta.amountCp)
  state.netOwed.set(delta.toSettlementId, (state.netOwed.get(delta.toSettlementId) ?? 0) - delta.amountCp)
}

/**
 * @param {ReturnType<typeof createClearingState>} state
 * @param {string} id
 * @param {CommodityId} commodityId
 * @param {'import' | 'export'} direction
 */
export function markRole(state, id, commodityId, direction) {
  const current = state.roles[id]?.[commodityId]
  if (!current) return
  if (current === 'neither') state.roles[id][commodityId] = direction
  else if (current !== direction) state.roles[id][commodityId] = 'both'
}

/**
 * @param {ReturnType<typeof createClearingState>} state
 * @returns {TradeClearingResult}
 */
function buildResult(state) {
  /** @type {Record<string, { foodLb: number, saltLb: number }>} */
  const effectiveDelivered = {}
  /** @type {Record<string, number>} */
  const realmBalancesCp = {}
  for (const s of state.settlements) {
    const bag = state.held.get(s.id)
    effectiveDelivered[s.id] = {
      foodLb: (bag?.grain ?? 0) + (bag?.fish ?? 0),
      saltLb: bag?.salt ?? 0,
    }
    realmBalancesCp[s.id] = -(state.netOwed.get(s.id) ?? 0)
  }

  /** @type {Record<string, number>} */
  const externalAccountDeltas = {}
  for (const s of state.settlements) {
    const delta = (state.externalAccounts.get(s.id) ?? 0) - (state.externalInitial.get(s.id) ?? 0)
    if (Math.abs(delta) > EPSILON) externalAccountDeltas[s.id] = delta
  }

  let accounts = createEmptyTradeAccounts()
  for (const delta of state.obligationDeltas) accounts = applyObligation(accounts, delta)

  return {
    flows: state.flows,
    settlementCommodityRoles: state.roles,
    localPricesBySettlementId: state.localPrices,
    obligationDeltas: state.obligationDeltas,
    externalAccountDeltas,
    effectiveDelivered,
    realmBalancesCp,
    offMapTrades: state.offMapTrades,
    nettedObligations: accounts.obligations,
  }
}
