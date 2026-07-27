/**
 * Per-epoch commodity production on a settlement's claimed cells, used by founding
 * viability and the begin-colonization off-map commit.
 * Domain: world-builder/CONTEXT.md — annual commodity flow, primary claim.
 */

import { computeSettlementProduction } from '../productionAccounting.js'
import { sumFishProductionOnCells } from '../../colonization/fish/sumFishProductionOnCells.js'

/** @typedef {import('../commodityCatalog.js').CommodityId} CommodityId */

/**
 * @param {{
 *   settlementId?: string,
 *   claimedCells: ReadonlyArray<{ x: number, y: number }>,
 *   worldDocument: import('../../types.js').WorldDocument,
 *   yieldModifier: string,
 *   populationDensity?: number,
 * }} params
 * @returns {Record<CommodityId, number>}
 */
export function computeClaimProduction(params) {
  const {
    settlementId = 'claim',
    claimedCells,
    worldDocument,
    yieldModifier,
    populationDensity,
  } = params
  const fishProductivity = sumFishProductionOnCells({
    claimedCells,
    gridWidth: worldDocument.gridWidth,
    gridHeight: worldDocument.gridHeight,
    elevation: worldDocument.fields?.elevation,
    lakeMask: worldDocument.lakeMask,
    riverCorridorMask: worldDocument.riverCorridorMask,
  })
  return computeSettlementProduction({
    settlementId,
    claimedCells,
    gridWidth: worldDocument.gridWidth,
    arableRaster: worldDocument.arableRaster,
    timberRaster: worldDocument.timberRaster,
    metalsRaster: worldDocument.metalsRaster,
    yieldModifier,
    populationDensity,
    fishProductivity,
    saltNodes: worldDocument.saltNodes,
    metalNodes: worldDocument.metalNodes,
  }).amounts
}
