import { applyPopulationCollapse } from './applyPopulationCollapse.js'
import { applyExpeditionNetworkPhase } from './expeditions/expeditionScheduler.js'
import { applyRuinTransitions } from './applyRuin.js'
import { recomputePrimaryClaims, serializeClaimMap } from './computePrimaryClaimMap.js'
import { DEFAULT_ROAD_MOVEMENT_MULTIPLIER } from './roads/roadNetwork.js'
import { applySurvivalResolveToSettlement } from './resolveSurvivalTriad.js'
import { settlementTierFromPopulation } from './settlementTierFromPopulation.js'
import { clearRealmTrade } from '../economy/tradeClearing/clearRealmTrade.js'
import { buildRealmTradeClearingInput } from './buildRealmTradeClearingInput.js'
import { combinedSettlementWealthCp } from '../economy/ledgers/combinedSettlementWealthCp.js'
import { applyFactionTax } from '../economy/ledgers/applyFactionTax.js'
import { runColonizationEpochPhases } from './runColonizationEpochPhases.js'
import { applyPoliticsPhase } from './politics/applyPoliticsPhase.js'

/**
 * @typedef {Object} ColonizationEpochContext
 * @property {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @property {import('../types.js').WorldDocument} worldDocument
 * @property {object[]} events
 * @property {Record<string, Array<{ x: number, y: number }>>} primaryClaim
 * @property {(string | null)[] | undefined} ownerByCell
 * @property {Record<string, import('./resolveSurvivalTriad.js').SurvivalTriadResult>} survivalBySettlementId
 * @property {Record<string, { foodLb: number, saltLb: number }>} effectiveDeliveredBySettlementId
 * @property {Record<string, number>} taxAssessmentIncomeCp Prior income for faction tax (pre-clear stash).
 * @property {boolean} tradeClearingActive Whether pairwise trade cleared this epoch.
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
    taxAssessmentIncomeCp: {},
    tradeClearingActive: false,
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
 * @param {{ trade?: { hooks?: import('../economy/tradeClearing/runTradeClearing.js').TradeClearingHooks, yieldToUi?: () => Promise<void> } }} [options]
 * @returns {Promise<void>}
 */
export async function runColonizationEpochTradePhase(ctx, options = {}) {
  ctx.taxAssessmentIncomeCp = { ...(ctx.slice.priorRealizedIncomeCp ?? {}) }

  const input = await buildRealmTradeClearingInput(
    {
      slice: ctx.slice,
      worldDocument: ctx.worldDocument,
      primaryClaim: ctx.primaryClaim,
    },
    options.trade,
  )
  const trade = await clearRealmTrade(input, options.trade)

  ctx.tradeClearingActive = trade.active === true
  ctx.effectiveDeliveredBySettlementId = trade.effectiveDeliveredBySettlementId
  ctx.slice = {
    ...ctx.slice,
    tradeAccounts: trade.tradeAccounts,
    externalTradeAccounts: trade.externalTradeAccounts,
    priorRealizedIncomeCp: trade.priorRealizedIncomeCp,
    tradeRouteState: trade.tradeRouteState,
    lastTradeEpochResult: trade.lastTradeEpochResult,
  }
}

/**
 * Faction tax after active trade clearing, before survival.
 *
 * @param {ColonizationEpochContext} ctx
 * @param {object} [options]
 */
export function runColonizationEpochTaxPhase(ctx, options = {}) {
  void options
  if (!ctx.tradeClearingActive) {
    return
  }

  const goodsTollIncomeCp = { ...(ctx.slice.priorRealizedIncomeCp ?? {}) }
  const taxed = applyFactionTax({
    settlements: ctx.slice.settlements,
    factions: ctx.slice.factions,
    tradeAccounts: ctx.slice.tradeAccounts,
    taxAssessmentIncomeCp: ctx.taxAssessmentIncomeCp,
  })

  /** @type {Record<string, number>} */
  const priorRealizedIncomeCp = { ...goodsTollIncomeCp }
  for (const [id, amount] of Object.entries(taxed.taxIncomeCpBySettlementId)) {
    priorRealizedIncomeCp[id] = (priorRealizedIncomeCp[id] ?? 0) + amount
  }

  const priorSnapshot = ctx.slice.lastTradeEpochResult
  const lastTradeEpochResult = priorSnapshot
    ? {
        ...priorSnapshot,
        factionTaxNetCpBySettlementId: { ...taxed.factionTaxNetCpBySettlementId },
        realmBalancesCp: { ...taxed.tradeAccounts.balancesBySettlementId },
      }
    : null

  ctx.slice = {
    ...ctx.slice,
    tradeAccounts: taxed.tradeAccounts,
    priorRealizedIncomeCp,
    lastTradeEpochResult,
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
    const realmWealthCp = combinedSettlementWealthCp({
      settlementId: settlement.id,
      balancesBySettlementId: ctx.slice.tradeAccounts?.balancesBySettlementId,
      externalTradeAccounts: ctx.slice.externalTradeAccounts,
    })

    const { settlement: resolved, survival } = applySurvivalResolveToSettlement({
      settlement,
      claimedCells,
      colonistSettings: ctx.slice.colonistSettings,
      worldDocument: ctx.worldDocument,
      deliveredFoodLb: delivered.foodLb,
      deliveredSaltLb: delivered.saltLb,
      realmWealthCp,
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
    population = applyMarginalWealthAttrition(population, realmWealthCp)

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
 * Politics after survival/ruin/collapse: latch, sticky membership, absorption.
 *
 * @param {ColonizationEpochContext} ctx
 * @param {{
 *   warOutcomes?: Array<{ loserFactionId: string, winnerFactionId: string }>,
 *   politics?: {
 *     hooks?: import('./politics/applyPoliticsPhase.js').PoliticsPhaseHooks,
 *     yieldToUi?: () => Promise<void>,
 *   },
 * }} [options]
 */
export async function runColonizationEpochPoliticsPhase(ctx, options = {}) {
  const politics = await applyPoliticsPhase(
    {
      slice: ctx.slice,
      worldDocument: ctx.worldDocument,
      primaryClaim: ctx.primaryClaim,
      survivalBySettlementId: ctx.survivalBySettlementId,
      warOutcomes: options.warOutcomes,
    },
    {
      hooks: options.politics?.hooks,
      yieldToUi: options.politics?.yieldToUi,
    },
  )
  ctx.slice = politics.slice
  ctx.events.push(...politics.events)
}

/**
 * Annual colonization tick order:
 * network → claims → trade → survival → ruin → collapse → politics.
 *
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../types.js').WorldDocument} worldDocument
 * @param {{
 *   network?: import('./expeditions/expeditionScheduler.js').ExpeditionNetworkPhaseOptions,
 *   trade?: { hooks?: import('../economy/tradeClearing/runTradeClearing.js').TradeClearingHooks, yieldToUi?: () => Promise<void> },
 *   collapse?: { hooks?: import('./collapsePopulation.js').CollapsePopulationHooks, yieldToUi?: () => Promise<void> },
 *   politics?: { hooks?: import('./politics/applyPoliticsPhase.js').PoliticsPhaseHooks, yieldToUi?: () => Promise<void> },
 *   warOutcomes?: Array<{ loserFactionId: string, winnerFactionId: string }>,
 * }} [options]
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
 * Fraction of food surplus (people-units) converted to headcount change per epoch.
 * 0.1 filled large haul-shed ceilings in a handful of years; 0.02 keeps early epochs
 * in village/town bands under calibrated packing constants.
 */
export const SURPLUS_POPULATION_GROWTH_FRACTION = 0.02

/** Fraction of headcount that leaves the map each epoch when combined wealth ≤ 0. */
export const MARGINAL_WEALTH_ATTRITION_RATE = 0.5

/** Floor on leavers per marginal-wealth attrition pass (avoids endless half-rounding residue). */
export const MARGINAL_WEALTH_ATTRITION_MIN_LEAVERS = 5

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
    next = population + Math.max(1, Math.floor(foodSurplus * SURPLUS_POPULATION_GROWTH_FRACTION))
  } else if (foodSurplus < 0) {
    next =
      population - Math.max(1, Math.floor(Math.abs(foodSurplus) * SURPLUS_POPULATION_GROWTH_FRACTION))
  }
  return Math.max(0, Math.min(Math.floor(next), populationCeiling))
}

/**
 * Off-map attrition for marginal/broke settlements (wealth overlay orange/red: ≤ 0 cp).
 * Leavers exit the realm entirely — not transferred to another pin.
 * Each pass removes the larger of half the headcount or
 * {@link MARGINAL_WEALTH_ATTRITION_MIN_LEAVERS} people (capped by headcount).
 *
 * @param {number} population
 * @param {number} realmWealthCp Combined realm + external wealth (tooltip / overlay figure).
 * @returns {number}
 */
export function applyMarginalWealthAttrition(population, realmWealthCp) {
  const headcount = Math.max(0, Math.floor(Number(population) || 0))
  if (!(headcount > 0)) return 0
  if (!(Number.isFinite(realmWealthCp) && realmWealthCp <= 0)) return headcount
  const leavers = Math.min(
    headcount,
    Math.max(
      Math.floor(headcount * MARGINAL_WEALTH_ATTRITION_RATE),
      MARGINAL_WEALTH_ATTRITION_MIN_LEAVERS,
    ),
  )
  return headcount - leavers
}
