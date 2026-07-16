import { applyPopulationCollapse } from './applyPopulationCollapse.js'
import { applyExpeditionNetworkPhase } from './expeditions/expeditionScheduler.js'
import { applyRuinTransitions } from './applyRuin.js'
import { recomputePrimaryClaims, serializeClaimMap } from './computePrimaryClaimMap.js'
import { DEFAULT_ROAD_MOVEMENT_MULTIPLIER } from './roads/roadNetwork.js'
import { applySurvivalResolveToSettlement } from './resolveSurvivalTriad.js'
import { settlementTierFromPopulation } from './settlementTierFromPopulation.js'
import { clearRealmTrade } from '../economy/tradeClearing/clearRealmTrade.js'
import { runColonizationEpochPhases } from './runColonizationEpochPhases.js'

/**
 * @typedef {Object} ColonizationEpochContext
 * @property {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @property {import('../types.js').WorldDocument} worldDocument
 * @property {object[]} events
 * @property {Record<string, Array<{ x: number, y: number }>>} primaryClaim
 * @property {(string | null)[] | undefined} ownerByCell
 * @property {Record<string, import('./resolveSurvivalTriad.js').SurvivalTriadResult>} survivalBySettlementId
 * @property {Record<string, { foodLb: number, saltLb: number }>} effectiveDeliveredBySettlementId
 */

/**
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../types.js').WorldDocument} worldDocument
 * @returns {ColonizationEpochContext}
 */
export function createColonizationEpochContext(slice, worldDocument) {
  return {
    slice,
    worldDocument,
    events: [],
    primaryClaim: {},
    ownerByCell: undefined,
    survivalBySettlementId: {},
    effectiveDeliveredBySettlementId: {},
  }
}

/**
 * @param {ColonizationEpochContext} ctx
 * @param {{ network?: import('./expeditions/expeditionScheduler.js').ExpeditionNetworkPhaseOptions }} [options]
 * @returns {Promise<void>}
 */
export async function runColonizationEpochNetworkPhase(ctx, options = {}) {
  const network = await applyExpeditionNetworkPhase(ctx.slice, ctx.worldDocument, options.network)
  ctx.slice = network.slice
  ctx.worldDocument = network.worldDocument
  ctx.events.push(...network.foundingEvents)
}

/**
 * @param {ColonizationEpochContext} ctx
 */
export function runColonizationEpochClaimsPhase(ctx) {
  const claimMap = recomputePrimaryClaims({
    settlements: ctx.slice.settlements,
    colonistSettings: ctx.slice.colonistSettings,
    gridWidth: ctx.worldDocument.gridWidth,
    gridHeight: ctx.worldDocument.gridHeight,
    movementCost: ctx.worldDocument.movementCost,
    roadMultiplier: DEFAULT_ROAD_MOVEMENT_MULTIPLIER,
    roads: ctx.worldDocument.roads,
  })
  ctx.ownerByCell = claimMap.ownerByCell
  ctx.primaryClaim = serializeClaimMap(claimMap)
}

/**
 * Trade phase: clear pairwise + off-map trade (when ≥ 2 living settlements) and persist
 * the ledgers, route flows, and inspect payload. The food/salt each settlement holds after
 * trade is stashed on the context for the survival phase.
 *
 * @param {ColonizationEpochContext} ctx
 */
export function runColonizationEpochTradePhase(ctx) {
  const trade = clearRealmTrade({
    slice: ctx.slice,
    worldDocument: ctx.worldDocument,
    primaryClaim: ctx.primaryClaim,
  })

  ctx.effectiveDeliveredBySettlementId = trade.effectiveDeliveredBySettlementId
  ctx.slice = {
    ...ctx.slice,
    tradeAccounts: trade.tradeAccounts,
    externalTradeAccounts: trade.externalTradeAccounts,
    tradeRouteState: trade.tradeRouteState,
    lastTradeEpochResult: trade.lastTradeEpochResult,
  }
}

/**
 * @param {ColonizationEpochContext} ctx
 * @param {object} [options]
 */
export function runColonizationEpochSurvivalPhase(ctx, options = {}) {
  void options
  /** @type {object[]} */
  const nextSettlements = []
  /** @type {Record<string, import('./resolveSurvivalTriad.js').SurvivalTriadResult>} */
  const survivalBySettlementId = {}

  for (const settlement of ctx.slice.settlements) {
    if (settlement.status === 'ruin') {
      nextSettlements.push({ ...settlement })
      continue
    }

    const claimedCells = ctx.primaryClaim[settlement.id] ?? []
    const delivered = ctx.effectiveDeliveredBySettlementId[settlement.id] ?? {
      foodLb: 0,
      saltLb: 0,
    }

    const { settlement: resolved, survival } = applySurvivalResolveToSettlement({
      settlement,
      claimedCells,
      colonistSettings: ctx.slice.colonistSettings,
      worldDocument: ctx.worldDocument,
      deliveredFoodLb: delivered.foodLb,
      deliveredSaltLb: delivered.saltLb,
    })

    survivalBySettlementId[settlement.id] = survival

    let population = resolved.population
    if (survival.hasFreshwater) {
      population = applySurplusPopulationDelta(
        population,
        survival.foodSurplus,
        survival.populationCeiling,
      )
    } else {
      population = 0
    }

    nextSettlements.push({
      ...resolved,
      population,
      tier: settlementTierFromPopulation(population),
    })
  }

  ctx.survivalBySettlementId = survivalBySettlementId
  ctx.slice = {
    ...ctx.slice,
    settlements: nextSettlements,
  }
}

/**
 * @param {ColonizationEpochContext} ctx
 */
export function runColonizationEpochRuinPhase(ctx) {
  const nextEpoch = ctx.slice.epoch + 1
  const ruined = applyRuinTransitions({
    settlements: ctx.slice.settlements,
    primaryClaim: ctx.primaryClaim,
    historyLog: ctx.slice.historyLog,
    epoch: nextEpoch,
    tradeAccounts: ctx.slice.tradeAccounts,
    externalTradeAccounts: ctx.slice.externalTradeAccounts,
  })

  applyPoliticsPhaseNoop()

  ctx.slice = {
    ...ctx.slice,
    epoch: nextEpoch,
    settlements: ruined.settlements,
    primaryClaim: ruined.primaryClaim,
    historyLog: ruined.historyLog,
    tradeAccounts: ruined.tradeAccounts,
    externalTradeAccounts: ruined.externalTradeAccounts,
  }
  ctx.events.push(...ruined.events)
}

/**
 * @param {ColonizationEpochContext} ctx
 * @param {{ collapse?: { hooks?: import('./collapsePopulation.js').CollapsePopulationHooks, yieldToUi?: () => Promise<void> } }} [options]
 * @returns {Promise<void>}
 */
export async function runColonizationEpochCollapsePhase(ctx, options = {}) {
  const withClaims = {
    ...ctx.slice,
    visitedCells: ctx.slice.visitedCells,
    expeditions: ctx.slice.expeditions,
    frontierExhausted: ctx.slice.frontierExhausted,
    roads: ctx.slice.roads,
    logisticsNodeSurvey: ctx.slice.logisticsNodeSurvey,
  }
  const { slice: collapsed } = await applyPopulationCollapse(withClaims, ctx.worldDocument, {
    hooks: options.collapse?.hooks,
    yieldToUi: options.collapse?.yieldToUi,
  })
  ctx.slice = collapsed
}

/**
 * Annual colonization tick order:
 * network → claims → trade → survival → ruin → collapse.
 *
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../types.js').WorldDocument} worldDocument
 * @param {{ network?: import('./expeditions/expeditionScheduler.js').ExpeditionNetworkPhaseOptions }} [options]
 * @returns {Promise<{
 *   slice: import('./createDefaultColonizationSlice.js').ColonizationSlice,
 *   events: object[],
 * }>}
 */
export async function applyColonizationEpoch(slice, worldDocument, options = {}) {
  if (slice.colonizationPhase !== 'running') {
    return { slice, events: [] }
  }

  const ctx = createColonizationEpochContext(slice, worldDocument)
  await runColonizationEpochPhases(ctx, options)

  return {
    slice: ctx.slice,
    events: ctx.events,
  }
}

/**
 * Surplus-driven population change in people-units, clamped by ceiling.
 *
 * @param {number} population
 * @param {number} foodSurplus
 * @param {number} populationCeiling
 * @returns {number}
 */
export function applySurplusPopulationDelta(population, foodSurplus, populationCeiling) {
  let next = population
  if (foodSurplus > 0) {
    next = population + Math.max(1, Math.floor(foodSurplus * 0.1))
  } else if (foodSurplus < 0) {
    next = population - Math.max(1, Math.floor(Math.abs(foodSurplus) * 0.1))
  }
  return Math.max(0, Math.min(Math.floor(next), populationCeiling))
}

function applyPoliticsPhaseNoop() {}
