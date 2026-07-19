/**
 * Realm-wide annual trade clearing wired into the colonization epoch.
 * Builds per-settlement production, clears pairwise + off-map trade when the realm
 * has enough living settlements, and reports the food/salt each settlement effectively
 * holds after trade for the survival triad.
 * Domain: world-builder/CONTEXT.md — trade clearing, population ceiling, salt fulfillment.
 */

import { computeSettlementProduction } from '../productionAccounting.js'
import { sumFishProductionOnCells } from '../../colonization/fish/sumFishProductionOnCells.js'
import { classifySettlementMaritimeRole } from '../../colonization/expeditions/classifySettlementMaritimeRole.js'
import { livingSettlements } from '../../colonization/expeditions/expeditionConstants.js'
import { recomputeBalances } from '../ledgers/bilateralObligations.js'
import { buildCandidateTradeGraph } from '../tradeGraph/buildCandidateRoutes.js'
import { runTradeClearing } from './runTradeClearing.js'

/**
 * @typedef {import('../commodityCatalog.js').CommodityId} CommodityId
 * @typedef {import('../ledgers/bilateralObligations.js').TradeAccountsState} TradeAccountsState
 * @typedef {import('../tradeGraph/buildCandidateRoutes.js').TradeRouteEdge} TradeRouteEdge
 */

/** Living-settlement count at which pairwise trade activates. */
export const TRADE_ACTIVATION_MIN_SETTLEMENTS = 2

/**
 * @typedef {Object} RealmTradeResult
 * @property {boolean} active Whether pairwise clearing ran this epoch.
 * @property {Record<string, { foodLb: number, saltLb: number }>} effectiveDeliveredBySettlementId
 * @property {TradeAccountsState} tradeAccounts Netted realm obligations + balances.
 * @property {Record<string, number>} externalTradeAccounts Port off-map credit (≥ 0).
 * @property {{ candidates: TradeRouteEdge[], activeFlows: import('./runTradeClearing.js').TradeFlow[] }} tradeRouteState
 * @property {import('./runTradeClearing.js').TradeClearingResult | null} lastTradeEpochResult
 */

/**
 * @param {{
 *   slice: import('../../colonization/createDefaultColonizationSlice.js').ColonizationSlice,
 *   worldDocument: import('../../types.js').WorldDocument,
 *   primaryClaim: Record<string, Array<{ x: number, y: number }>>,
 * }} params
 * @param {{
 *   hooks?: import('./runTradeClearing.js').TradeClearingHooks,
 *   yieldToUi?: () => Promise<void>,
 * }} [options]
 * @returns {Promise<RealmTradeResult>}
 */
export async function clearRealmTrade(params, options = {}) {
  const { slice, worldDocument, primaryClaim } = params
  const { hooks, yieldToUi } = options
  const living = livingSettlements(slice.settlements)
  const gridWidth = worldDocument.gridWidth
  const gridHeight = worldDocument.gridHeight
  const elevation = worldDocument.fields?.elevation ?? null

  /** @type {Record<string, Record<CommodityId, number>>} */
  const production = {}
  /** @type {Array<{ id: string, x: number, y: number, population: number, status: 'living', maritimeRole: string }>} */
  const graphSettlements = []
  /** @type {Array<{ id: string, population: number, maritimeRole: string }>} */
  const clearingSettlements = []

  if (living.length >= TRADE_ACTIVATION_MIN_SETTLEMENTS) {
    hooks?.onTradeSubstep?.({
      type: 'substep-start',
      substepIndex: 0,
      substepId: 'localPrices',
    })
    await yieldToUi?.()
  }

  for (let index = 0; index < living.length; index += 1) {
    const settlement = living[index]
    const claimedCells = primaryClaim[settlement.id] ?? []
    const fishProductivity = sumFishProductionOnCells({
      claimedCells,
      gridWidth,
      gridHeight,
      elevation,
      lakeMask: worldDocument.lakeMask,
      riverCorridorMask: worldDocument.riverCorridorMask,
    })
    const { amounts } = computeSettlementProduction({
      settlementId: settlement.id,
      claimedCells,
      gridWidth,
      arableRaster: worldDocument.arableRaster,
      timberRaster: worldDocument.timberRaster,
      metalsRaster: worldDocument.metalsRaster,
      yieldModifier: slice.colonistSettings.yieldModifier,
      populationDensity: slice.colonistSettings.populationDensity,
      fishProductivity,
      saltNodes: worldDocument.saltNodes,
      metalNodes: worldDocument.metalNodes,
    })
    production[settlement.id] = amounts

    const maritimeRole = classifySettlementMaritimeRole(worldDocument, {
      x: settlement.x,
      y: settlement.y,
    })
    graphSettlements.push({
      id: settlement.id,
      x: settlement.x,
      y: settlement.y,
      population: settlement.population,
      status: 'living',
      maritimeRole,
    })
    clearingSettlements.push({ id: settlement.id, population: settlement.population, maritimeRole })

    if (living.length >= TRADE_ACTIVATION_MIN_SETTLEMENTS && (index + 1) % 4 === 0) {
      hooks?.onTradeSubstep?.({
        type: 'substep-item',
        substepIndex: 0,
        substepId: 'localPrices',
        itemIndex: index + 1,
        itemCount: living.length,
      })
      await yieldToUi?.()
    }
  }

  if (living.length < TRADE_ACTIVATION_MIN_SETTLEMENTS) {
    return {
      active: false,
      effectiveDeliveredBySettlementId: localDelivered(production),
      tradeAccounts: { obligations: [], balancesBySettlementId: {} },
      externalTradeAccounts: { ...slice.externalTradeAccounts },
      tradeRouteState: { candidates: [], activeFlows: [] },
      lastTradeEpochResult: null,
    }
  }

  const haulDistance = slice.colonistSettings.threeDayHaulDistance
  const graph = buildCandidateTradeGraph({
    settlements: graphSettlements,
    gridWidth,
    gridHeight,
    threeDayHaulDistance: haulDistance,
    inlandSailExpeditionRange: slice.colonistSettings.inlandSailExpeditionRange * haulDistance,
    movementCost: worldDocument.movementCost,
    elevation,
    roads: slice.roads,
    lakeMask: worldDocument.lakeMask,
    riverCorridorMask: worldDocument.riverCorridorMask,
  })
  await yieldToUi?.()

  const result = await runTradeClearing(
    {
      settlements: clearingSettlements,
      graph,
      production,
      externalAccountsCp: slice.externalTradeAccounts,
    },
    options,
  )
  /** @type {Record<string, number>} */
  const externalTradeAccounts = { ...slice.externalTradeAccounts }
  for (const [id, delta] of Object.entries(result.externalAccountDeltas)) {
    externalTradeAccounts[id] = Math.max(0, (externalTradeAccounts[id] ?? 0) + delta)
  }

  /** @type {TradeAccountsState} */
  const tradeAccounts = {
    obligations: result.nettedObligations.map((row) => ({ ...row })),
    balancesBySettlementId: {},
  }
  recomputeBalances(tradeAccounts)

  return {
    active: true,
    effectiveDeliveredBySettlementId: result.effectiveDelivered,
    tradeAccounts,
    externalTradeAccounts,
    tradeRouteState: { candidates: graph.edges, activeFlows: result.flows },
    lastTradeEpochResult: result,
  }
}

/**
 * Effective food/salt with no pairwise trade: each settlement holds only its own output.
 *
 * @param {Record<string, Record<CommodityId, number>>} production
 * @returns {Record<string, { foodLb: number, saltLb: number }>}
 */
function localDelivered(production) {
  /** @type {Record<string, { foodLb: number, saltLb: number }>} */
  const delivered = {}
  for (const [id, amounts] of Object.entries(production)) {
    delivered[id] = {
      foodLb: (amounts.grain ?? 0) + (amounts.fish ?? 0),
      saltLb: amounts.salt ?? 0,
    }
  }
  return delivered
}
