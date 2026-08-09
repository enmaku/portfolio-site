/**
 * Build a pure clearing DTO for realm trade from colonization state.
 * Keeps colonization deps (living filter, maritime roles, fish production, trade graph)
 * out of economy.
 */

import { livingSettlements } from './expeditions/expeditionConstants.js'
import { refreshSettlementMaritimeRoles } from './refreshSettlementMaritimeRoles.js'
import { sumFishProductionOnCells } from './fish/sumFishProductionOnCells.js'
import { computeSettlementProduction } from '../economy/productionAccounting.js'
import { TRADE_ACTIVATION_MIN_SETTLEMENTS } from '../economy/tradeClearing/clearRealmTrade.js'
import { buildCandidateTradeGraph } from './tradeGraph/buildCandidateRoutes.js'

/**
 * @typedef {import('../economy/commodityCatalog.js').CommodityId} CommodityId
 * @typedef {import('./createDefaultColonizationSlice.js').ColonizationSlice} ColonizationSlice
 * @typedef {import('../types.js').WorldDocument} WorldDocument
 * @typedef {import('../economy/tradeClearing/clearRealmTrade.js').RealmTradeClearingInput} RealmTradeClearingInput
 */

/**
 * @param {{
 *   slice: ColonizationSlice,
 *   worldDocument: WorldDocument,
 *   primaryClaim: Record<string, Array<{ x: number, y: number }>>,
 * }} params
 * @param {{
 *   hooks?: import('../economy/tradeClearing/runTradeClearing.js').TradeClearingHooks,
 *   yieldToUi?: () => Promise<void>,
 * }} [options]
 * @returns {Promise<RealmTradeClearingInput>}
 */
export async function buildRealmTradeClearingInput(params, options = {}) {
  const { slice, worldDocument, primaryClaim } = params
  const { hooks, yieldToUi } = options
  refreshSettlementMaritimeRoles(slice, worldDocument)
  const living = livingSettlements(slice.settlements)
  const gridWidth = worldDocument.gridWidth
  const gridHeight = worldDocument.gridHeight
  const elevation = worldDocument.fields?.elevation ?? null

  /** @type {Record<string, Record<CommodityId, number>>} */
  const production = {}
  /** @type {RealmTradeClearingInput['settlements']} */
  const settlements = []

  if (living.length >= TRADE_ACTIVATION_MIN_SETTLEMENTS) {
    hooks?.onTradeSubstep?.({
      type: 'substep-start',
      substepId: 'production',
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

    settlements.push({
      id: settlement.id,
      x: settlement.x,
      y: settlement.y,
      population: settlement.population,
      maritimeRole: settlement.maritimeRole ?? 'none',
    })

    if (living.length >= TRADE_ACTIVATION_MIN_SETTLEMENTS && (index + 1) % 4 === 0) {
      hooks?.onTradeSubstep?.({
        type: 'substep-item',
        substepId: 'production',
        itemIndex: index + 1,
        itemCount: living.length,
      })
      await yieldToUi?.()
    }
  }

  if (living.length >= TRADE_ACTIVATION_MIN_SETTLEMENTS) {
    hooks?.onTradeSubstep?.({
      type: 'substep-complete',
      substepId: 'production',
    })
    await yieldToUi?.()
  }

  /** @type {import('./tradeGraph/buildCandidateRoutes.js').CandidateTradeGraph | null} */
  let graph = null
  if (living.length >= TRADE_ACTIVATION_MIN_SETTLEMENTS) {
    const graphSettlements = settlements.map((settlement) => ({
      id: settlement.id,
      x: settlement.x,
      y: settlement.y,
      population: settlement.population,
      status: 'living',
      maritimeRole: settlement.maritimeRole ?? 'none',
    }))
    const threeDayHaulDistance = slice.colonistSettings.threeDayHaulDistance
    graph = buildCandidateTradeGraph({
      settlements: graphSettlements,
      gridWidth,
      gridHeight,
      threeDayHaulDistance,
      inlandSailExpeditionRange:
        slice.colonistSettings.inlandSailExpeditionRange * threeDayHaulDistance,
      movementCost: worldDocument.movementCost,
      elevation,
      roads: slice.roads,
      lakeMask: worldDocument.lakeMask,
      riverCorridorMask: worldDocument.riverCorridorMask,
    })
    await yieldToUi?.()
  }

  return {
    settlements,
    production,
    graph,
    tradeAccounts: slice.tradeAccounts,
    externalTradeAccounts: slice.externalTradeAccounts,
    priorRealizedIncomeCp: slice.priorRealizedIncomeCp,
    lastTradeEpochResult: slice.lastTradeEpochResult ?? null,
    lastOnMapGoodsBilateralCpByPair: slice.lastOnMapGoodsBilateralCpByPair ?? {},
    tradeRouteState: slice.tradeRouteState,
    belligerentTradeBlocks: slice.belligerentTradeBlocks ?? [],
    factionIdBySettlementId: Object.fromEntries(
      living.map((settlement) => [settlement.id, settlement.factionId ?? null]),
    ),
  }
}
