/**
 * Prioritized minimum-cost multi-commodity trade clearing.
 * Domain: world-builder/CONTEXT.md — trade clearing, survival allocation, survival
 * comfort, material prosperity, off-map trade, mutual credit, port toll, credit limit.
 */

import { COLONIZATION_TRADE_SUBSTEPS } from '../../colonization/colonizationEpochSteps.js'
import { FISH_CURING_SALT_PER_FISH_LB } from '../productionAccounting.js'
import {
  PROSPERITY_COMMODITIES,
  comfortFoodDemandLb,
  prosperityDemandUnits,
  survivalFoodDemandLb,
  survivalSaltDemandLb,
} from './allocationTiers.js'
import { findMinCostPath } from './pathSearch.js'
import { clearOffMapTrade, clearOffMapTradeSync } from './offMapTrade.js'
import { creditRoomCpForImport } from '../ledgers/creditRoom.js'
import { roundMoneyCp } from '../formatMoneyCp.js'
import { realizedPortTollIncomeCpBySettlementId } from '../ledgers/realizedIncome.js'
import { applyObligation } from '../ledgers/bilateralObligations.js'
import { PORT_TOLL_RATE } from './tradeConstants.js'
import { addObligation, markRole } from './clearingMutators.js'
import { applyPathCapacityFlows } from './applyPathCapacityFlows.js'
import { createClearingState } from './clearingState.js'

/**
 * @typedef {import('../commodityCatalog.js').CommodityId} CommodityId
 * @typedef {import('./clearingState.js').ClearingState} ClearingState
 * @typedef {import('./clearingState.js').TradeFlow} TradeFlow
 * @typedef {import('./clearingState.js').ObligationDelta} ObligationDelta
 * @typedef {import('./clearingState.js').OffMapTrade} OffMapTrade
 * @typedef {import('./clearingState.js').CommodityTradeRole} CommodityTradeRole
 */

const EPSILON = 1e-6
/** Yield / progress cadence for deficit attempts inside survival/comfort clearing. */
const CLEAR_RESOURCE_YIELD_EVERY = 8

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
 * @property {Record<string, number>} portTollIncomeCpBySettlementId Last-epoch collected
 *   port tolls (on-map obligations + off-map external credits) per collecting settlement.
 * @property {import('../ledgers/bilateralObligations.js').BilateralObligation[]} nettedObligations
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
 * @param {import('../../colonization/colonizationEpochSteps.js').ColonizationTradeSubstepId} id
 * @returns {number}
 */
function tradeSubstepIndex(id) {
  const index = COLONIZATION_TRADE_SUBSTEPS.findIndex((step) => step.id === id)
  if (index < 0) throw new Error(`unknown trade substep: ${id}`)
  return index
}

/** Indices aligned with COLONIZATION_TRADE_SUBSTEPS (production = 0 in clearRealmTrade). */
const TRADE_SUBSTEP = Object.freeze({
  localPrices: tradeSubstepIndex('localPrices'),
  survival: tradeSubstepIndex('survival'),
  comfort: tradeSubstepIndex('comfort'),
  prosperity: tradeSubstepIndex('prosperity'),
  offMap: tradeSubstepIndex('offMap'),
})

/** Exported for coupling tests against COLONIZATION_TRADE_SUBSTEPS. */
export { TRADE_SUBSTEP }

/**
 * @param {Parameters<typeof createClearingState>[0]} [params]
 * @param {TradeClearingOptions} [options]
 * @returns {Promise<TradeClearingResult>}
 */
export async function runTradeClearing(params = {}, options = {}) {
  const { hooks, yieldToUi } = options

  emitTradeSubstep(hooks, 'substep-start', TRADE_SUBSTEP.localPrices, 'localPrices')
  await yieldToUi?.()
  const state = createClearingState(params)
  emitTradeSubstep(hooks, 'substep-complete', TRADE_SUBSTEP.localPrices, 'localPrices')
  await yieldToUi?.()

  emitTradeSubstep(hooks, 'substep-start', TRADE_SUBSTEP.survival, 'survival')
  await yieldToUi?.()
  await clearSurvivalFoodTiersCore(state, {
    hooks,
    yieldToUi,
    substepIndex: TRADE_SUBSTEP.survival,
    substepId: 'survival',
  })
  emitTradeSubstep(hooks, 'substep-complete', TRADE_SUBSTEP.survival, 'survival')
  await yieldToUi?.()

  emitTradeSubstep(hooks, 'substep-start', TRADE_SUBSTEP.comfort, 'comfort')
  await yieldToUi?.()
  await clearComfortFoodTiers(state, {
    hooks,
    yieldToUi,
    substepIndex: TRADE_SUBSTEP.comfort,
    substepId: 'comfort',
  })
  emitTradeSubstep(hooks, 'substep-complete', TRADE_SUBSTEP.comfort, 'comfort')
  await yieldToUi?.()

  emitTradeSubstep(hooks, 'substep-start', TRADE_SUBSTEP.prosperity, 'prosperity')
  await yieldToUi?.()
  const prosperityCount = PROSPERITY_COMMODITIES.length
  for (let index = 0; index < prosperityCount; index += 1) {
    emitTradeSubstep(
      hooks,
      'substep-item',
      TRADE_SUBSTEP.prosperity,
      'prosperity',
      index + 1,
      prosperityCount,
    )
    await yieldToUi?.()
    clearProsperityCommodity(state, PROSPERITY_COMMODITIES[index])
  }
  emitTradeSubstep(hooks, 'substep-complete', TRADE_SUBSTEP.prosperity, 'prosperity')
  await yieldToUi?.()

  emitTradeSubstep(hooks, 'substep-start', TRADE_SUBSTEP.offMap, 'offMap')
  await yieldToUi?.()
  await clearOffMapTrade(state, {
    onItem: (itemIndex, itemCount) => {
      emitTradeSubstep(hooks, 'substep-item', TRADE_SUBSTEP.offMap, 'offMap', itemIndex, itemCount)
    },
    yieldToUi,
  })
  emitTradeSubstep(hooks, 'substep-complete', TRADE_SUBSTEP.offMap, 'offMap')
  await yieldToUi?.()

  return buildResult(state)
}

/**
 * Synchronous clearing for call sites that cannot await (founding commit).
 * Prefer {@link runTradeClearing} everywhere else.
 *
 * @param {Parameters<typeof createClearingState>[0]} [params]
 * @returns {TradeClearingResult}
 */
export function runTradeClearingSync(params = {}) {
  const state = createClearingState(params)
  runOnMapClearingTiers(state)
  clearOffMapTradeSync(state)
  return buildResult(state)
}

/**
 * On-map allocation tiers only (no off-map). Shared by sync orchestrator.
 *
 * @param {ClearingState} state
 */
function runOnMapClearingTiers(state) {
  clearSurvivalFoodTiersCoreSync(state)
  clearComfortFoodTiersSync(state)
  for (const commodityId of PROSPERITY_COMMODITIES) {
    clearProsperityCommodity(state, commodityId)
  }
}

/**
 * @typedef {{
 *   hooks?: TradeClearingHooks,
 *   yieldToUi?: () => Promise<void>,
 *   substepIndex: number,
 *   substepId: string,
 * }} ClearResourceProgress
 */

/**
 * @param {ClearingState} state
 * @param {ClearResourceProgress} [progress]
 */
async function clearSurvivalFoodTiersCore(state, progress) {
  await clearFoodTier(state, survivalFoodDemandLb, 'survival', progress)
  await clearSaltTier(state, survivalSaltDemandLb, progress)
}

/** @param {ClearingState} state */
function clearSurvivalFoodTiersCoreSync(state) {
  clearFoodTierSync(state, survivalFoodDemandLb, 'survival')
  clearSaltTierSync(state, survivalSaltDemandLb)
}

/**
 * @param {ClearingState} state
 * @param {ClearResourceProgress} [progress]
 */
async function clearComfortFoodTiers(state, progress) {
  await clearFoodTier(state, comfortFoodDemandLb, 'comfort', progress)
}

/** @param {ClearingState} state */
function clearComfortFoodTiersSync(state) {
  clearFoodTierSync(state, comfortFoodDemandLb, 'comfort')
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
 * Food tier: fulfillment counts grain + fish; ships grain first, then cured fish.
 *
 * @param {ClearingState} state
 * @param {(pop: number) => number} targetFn
 * @param {'survival' | 'comfort'} resourceKind
 * @param {ClearResourceProgress} [progress]
 */
async function clearFoodTier(state, targetFn, resourceKind, progress) {
  await clearResource(state, foodClearSpec(state, targetFn, resourceKind), progress)
}

/**
 * @param {ClearingState} state
 * @param {(pop: number) => number} targetFn
 * @param {'survival' | 'comfort'} resourceKind
 */
function clearFoodTierSync(state, targetFn, resourceKind) {
  clearResourceSync(state, foodClearSpec(state, targetFn, resourceKind))
}

/**
 * @param {ClearingState} state
 * @param {(pop: number) => number} targetFn
 * @param {ClearResourceProgress} [progress]
 */
async function clearSaltTier(state, targetFn, progress) {
  await clearResource(state, saltClearSpec(state, targetFn), progress)
}

/**
 * @param {ClearingState} state
 * @param {(pop: number) => number} targetFn
 */
function clearSaltTierSync(state, targetFn) {
  clearResourceSync(state, saltClearSpec(state, targetFn))
}

/**
 * @param {ClearingState} state
 * @param {CommodityId} commodityId
 */
function clearProsperityCommodity(state, commodityId) {
  clearResourceSync(state, {
    commodities: [commodityId],
    targetOf: (s) => prosperityDemandUnits(commodityId, s.population),
    heldResource: (id) => state.held.get(id)?.[commodityId] ?? 0,
    resourceKind: 'prosperity',
  })
}

/**
 * @param {ClearingState} state
 * @param {(pop: number) => number} targetFn
 * @param {'survival' | 'comfort'} resourceKind
 * @returns {ClearResourceSpec}
 */
function foodClearSpec(state, targetFn, resourceKind) {
  return {
    commodities: ['grain', 'fish'],
    targetOf: (s) => targetFn(s.population),
    heldResource: (id) => {
      const bag = state.held.get(id)
      return (bag?.grain ?? 0) + (bag?.fish ?? 0)
    },
    resourceKind,
  }
}

/**
 * @param {ClearingState} state
 * @param {(pop: number) => number} targetFn
 * @returns {ClearResourceSpec}
 */
function saltClearSpec(state, targetFn) {
  return {
    commodities: ['salt'],
    targetOf: (s) => targetFn(s.population),
    heldResource: (id) => state.held.get(id)?.salt ?? 0,
    resourceKind: 'salt',
  }
}

/**
 * @typedef {{
 *   commodities: CommodityId[],
 *   targetOf: (s: { population: number }) => number,
 *   heldResource: (id: string) => number,
 *   resourceKind: 'survival' | 'comfort' | 'salt' | 'prosperity',
 * }} ClearResourceSpec
 */

/**
 * Single max-min body: each yield is one deficit attempt (same pattern as offMapTradeSteps).
 *
 * @param {ClearingState} state
 * @param {ClearResourceSpec} spec
 * @returns {Generator<{ deficitCount: number, run: () => void }>}
 */
function* clearResourceSteps(state, spec) {
  const { commodities, targetOf, heldResource } = spec
  /** @type {Set<string>} */
  const blocked = new Set()
  /** @type {Set<string>} originId::commodityId pairs that applied ≤ ε */
  const excludedMoves = new Set()

  for (let guard = 0; guard < 100000; guard += 1) {
    const ranked = state.settlements
      .map((s) => ({ s, target: targetOf(s), held: heldResource(s.id) }))
      .filter((row) => row.target > EPSILON)
      .map((row) => ({ ...row, ratio: row.held / row.target }))
      .sort((a, b) => a.ratio - b.ratio || (a.s.id < b.s.id ? -1 : 1))

    const deficits = ranked.filter((row) => row.held < row.target - EPSILON && !blocked.has(row.s.id))
    if (deficits.length === 0) return

    const target = deficits[0]
    const secondRatio = ranked.find((row) => row.s.id !== target.s.id && row.ratio > target.ratio)?.ratio
    const capRatio = Math.min(1, secondRatio ?? 1)
    let raiseUnits = target.target * capRatio - target.held
    if (raiseUnits <= EPSILON) raiseUnits = target.target - target.held
    const targetId = target.s.id
    const deficitCount = deficits.length

    yield {
      deficitCount,
      run: () => {
        const move = planBestMove(state, {
          spec,
          targetId,
          commodities,
          excludedMoves,
        })
        if (!move) {
          blocked.add(targetId)
          return
        }
        const applied = applyMove(state, {
          move,
          maxUnits: raiseUnits,
          resourceKind: spec.resourceKind,
        })
        if (applied <= EPSILON) {
          excludedMoves.add(`${move.path.originId}::${move.commodityId}`)
        }
      },
    }
  }
}

/**
 * Max-min fair clearing of one resource with cooperative yields when progress is set.
 *
 * @param {ClearingState} state
 * @param {ClearResourceSpec} spec
 * @param {ClearResourceProgress} [progress]
 */
async function clearResource(state, spec, progress) {
  let attempt = 0
  for (const step of clearResourceSteps(state, spec)) {
    attempt += 1
    if (progress && (attempt === 1 || attempt % CLEAR_RESOURCE_YIELD_EVERY === 0)) {
      emitTradeSubstep(
        progress.hooks,
        'substep-item',
        progress.substepIndex,
        progress.substepId,
        attempt,
        Math.max(attempt, step.deficitCount),
      )
      await progress.yieldToUi?.()
    }
    step.run()
  }
}

/**
 * @param {ClearingState} state
 * @param {ClearResourceSpec} spec
 */
function clearResourceSync(state, spec) {
  for (const step of clearResourceSteps(state, spec)) {
    step.run()
  }
}

/**
 * Choose the cheapest profitable source+commodity path delivering to the target.
 *
 * @param {ClearingState} state
 * @param {{
 *   spec: { targetOf: (s: { population: number }) => number },
 *   targetId: string,
 *   commodities: CommodityId[],
 *   excludedMoves?: Set<string>,
 * }} params
 * @returns {{
 *   commodityId: CommodityId,
 *   path: import('./pathSearch.js').FoundPath,
 *   netUnitValueCp: number,
 *   importerUnitCostCp: number,
 * } | null}
 */
function planBestMove(state, params) {
  const { targetId, commodities, excludedMoves } = params
  let best = null
  for (const commodityId of commodities) {
    const priceAtDest = state.localPrices[targetId]?.[commodityId] ?? 0
    const unitTollCp = PORT_TOLL_RATE * priceAtDest
    const sources = state.settlements.filter(
      (s) =>
        s.id !== targetId &&
        !(excludedMoves?.has(`${s.id}::${commodityId}`)) &&
        exportableUnits(state, s, params.spec, commodityId) > EPSILON,
    )
    if (sources.length === 0) continue

    const path = findMinCostPath({
      edges: state.edges,
      remainingCapLbByEdgeId: state.remainingCapLbByEdgeId,
      sourceIds: sources.map((s) => s.id),
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
  return best
}

/**
 * @param {ClearingState} state
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
    let units = Math.min(bag[commodityId] ?? 0, exportableFood)
    if (commodityId === 'fish') {
      units = Math.min(units, (bag.salt ?? 0) * FISH_CURING_SALT_PER_FISH_LB)
    }
    return units
  }
  return Math.max(0, (bag[commodityId] ?? 0) - target)
}

/**
 * @param {ClearingState} state
 * @param {{
 *   move: NonNullable<ReturnType<typeof planBestMove>>,
 *   maxUnits: number,
 *   resourceKind: 'survival' | 'comfort' | 'salt' | 'prosperity',
 * }} params
 * @returns {number} units actually moved
 */
function applyMove(state, params) {
  const { move, maxUnits, resourceKind } = params
  const { commodityId, path, netUnitValueCp, importerUnitCostCp } = move
  const importerId = path.legs.length > 0 ? path.legs[path.legs.length - 1].to : move.path.originId
  const originId = path.originId

  const originBag = state.held.get(originId)
  const importerBag = state.held.get(importerId)
  if (!originBag || !importerBag) return 0

  let limit = Math.min(maxUnits, path.bottleneckUnits, Math.max(0, originBag[commodityId] ?? 0))

  const room = creditRoomCpForImport(state, importerId, resourceKind)
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

  applyPathCapacityFlows(state, {
    legs: path.legs,
    commodityId,
    amount: limit,
  })

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
 * @param {ClearingState} state
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
    realmBalancesCp[s.id] = roundMoneyCp(-(state.netOwed.get(s.id) ?? 0))
  }

  /** @type {Record<string, number>} */
  const externalAccountDeltas = {}
  for (const s of state.settlements) {
    const delta = roundMoneyCp(
      (state.externalAccounts.get(s.id) ?? 0) - (state.externalInitial.get(s.id) ?? 0),
    )
    if (delta !== 0) externalAccountDeltas[s.id] = delta
  }

  let accounts = {
    obligations: state.priorObligations.map((row) => ({ ...row })),
    balancesBySettlementId: {},
  }
  for (const delta of state.obligationDeltas) accounts = applyObligation(accounts, delta)

  /** @type {Record<string, number>} */
  const offMapPortTollIncomeCp = {}
  for (const [id, amount] of state.offMapPortTollIncomeCp) {
    if (amount > EPSILON) offMapPortTollIncomeCp[id] = amount
  }

  return {
    flows: state.flows,
    settlementCommodityRoles: state.roles,
    localPricesBySettlementId: state.localPrices,
    obligationDeltas: state.obligationDeltas,
    externalAccountDeltas,
    effectiveDelivered,
    realmBalancesCp,
    offMapTrades: state.offMapTrades,
    portTollIncomeCpBySettlementId: realizedPortTollIncomeCpBySettlementId(
      state.obligationDeltas,
      offMapPortTollIncomeCp,
    ),
    nettedObligations: accounts.obligations,
  }
}
