/**
 * Build a pure clearing DTO for realm trade from colonization state.
 * Keeps colonization deps (living filter, maritime roles, fish production) out of economy.
 */

import { COLONIZATION_TRADE_SUBSTEPS } from './colonizationEpochSteps.js'
import { livingSettlements } from './expeditions/expeditionConstants.js'
import { refreshSettlementMaritimeRoles } from './refreshSettlementMaritimeRoles.js'
import { sumFishProductionOnCells } from './fish/sumFishProductionOnCells.js'
import { computeSettlementProduction } from '../economy/productionAccounting.js'

/** Living-settlement count at which pairwise trade activates (mirrors clearRealmTrade). */
const TRADE_ACTIVATION_MIN_SETTLEMENTS = 2

const PRODUCTION_SUBSTEP_INDEX = COLONIZATION_TRADE_SUBSTEPS.findIndex(
  (step) => step.id === 'production',
)

/**
 * @typedef {import('../economy/commodityCatalog.js').CommodityId} CommodityId
 * @typedef {import('./createDefaultColonizationSlice.js').ColonizationSlice} ColonizationSlice
 * @typedef {import('../types.js').WorldDocument} WorldDocument
 */

/**
 * @typedef {Object} RealmTradeClearingInput
 * @property {Array<{ id: string, x: number, y: number, population: number, maritimeRole: string }>} settlements
 *   Living settlements only, with maritimeRole already refreshed.
 * @property {Record<string, Record<CommodityId, number>>} production
 * @property {number} gridWidth
 * @property {number} gridHeight
 * @property {Float32Array | null} elevation
 * @property {import('../types.js').WorldDocument['movementCost']} movementCost
 * @property {Uint8Array | undefined} lakeMask
 * @property {Uint8Array | undefined} riverCorridorMask
 * @property {ColonizationSlice['roads']} roads
 * @property {number} threeDayHaulDistance
 * @property {number} inlandSailExpeditionRange Colonist setting (multiple of haul distance).
 * @property {ColonizationSlice['tradeAccounts']} tradeAccounts
 * @property {ColonizationSlice['externalTradeAccounts']} externalTradeAccounts
 * @property {ColonizationSlice['priorRealizedIncomeCp']} priorRealizedIncomeCp
 * @property {ColonizationSlice['lastTradeEpochResult']} lastTradeEpochResult
 * @property {ColonizationSlice['tradeRouteState']} tradeRouteState
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
      substepIndex: PRODUCTION_SUBSTEP_INDEX,
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
        substepIndex: PRODUCTION_SUBSTEP_INDEX,
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
      substepIndex: PRODUCTION_SUBSTEP_INDEX,
      substepId: 'production',
    })
    await yieldToUi?.()
  }

  return {
    settlements,
    production,
    gridWidth,
    gridHeight,
    elevation,
    movementCost: worldDocument.movementCost,
    lakeMask: worldDocument.lakeMask,
    riverCorridorMask: worldDocument.riverCorridorMask,
    roads: slice.roads,
    threeDayHaulDistance: slice.colonistSettings.threeDayHaulDistance,
    inlandSailExpeditionRange: slice.colonistSettings.inlandSailExpeditionRange,
    tradeAccounts: slice.tradeAccounts,
    externalTradeAccounts: slice.externalTradeAccounts,
    priorRealizedIncomeCp: slice.priorRealizedIncomeCp,
    lastTradeEpochResult: slice.lastTradeEpochResult ?? null,
    tradeRouteState: slice.tradeRouteState,
  }
}
