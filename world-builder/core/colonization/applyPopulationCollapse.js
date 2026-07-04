import { collapsePopulation } from './collapsePopulation.js'

/**
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../types.js').WorldDocument} worldDocument
 * @returns {import('./createDefaultColonizationSlice.js').ColonizationSlice}
 */
export function applyPopulationCollapse(slice, worldDocument) {
  const populationCollapseRaster = collapsePopulation({
    settlements: slice.settlements,
    primaryClaim: slice.primaryClaim,
    arableRaster: worldDocument.arableRaster,
    elevation: worldDocument.fields?.elevation,
    lakeMask: worldDocument.lakeMask,
    biomes: worldDocument.biomes,
    gridWidth: worldDocument.gridWidth,
    gridHeight: worldDocument.gridHeight,
  })

  return {
    ...slice,
    populationCollapseRaster,
  }
}
