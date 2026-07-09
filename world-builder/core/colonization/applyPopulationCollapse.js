import { collapsePopulation, collapsePopulationAsync } from './collapsePopulation.js'

/**
 * Spatial population collapse seam: maps post-tick colonization slice + geography
 * into an updated slice and the population overlay raster.
 *
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../types.js').WorldDocument} worldDocument
 * @returns {{
 *   slice: import('./createDefaultColonizationSlice.js').ColonizationSlice,
 *   populationCollapseRaster: Float32Array,
 * }}
 */
export function applyPopulationCollapse(slice, worldDocument) {
  const populationCollapseRaster = collapsePopulation({
    settlements: slice.settlements,
    primaryClaim: slice.primaryClaim,
    arableRaster: worldDocument.arableRaster,
    elevation: worldDocument.fields?.elevation,
    lakeMask: worldDocument.lakeMask,
    riverCorridorMask: worldDocument.riverCorridorMask,
    simulationRiverMask: worldDocument.simulationRiverMask,
    biomes: worldDocument.biomes,
    gridWidth: worldDocument.gridWidth,
    gridHeight: worldDocument.gridHeight,
    geographySeed: worldDocument.geographySeed ?? 0,
    epoch: slice.epoch,
  })

  return {
    slice: {
      ...slice,
      populationCollapseRaster,
    },
    populationCollapseRaster,
  }
}

/**
 * @typedef {Object} ApplyPopulationCollapseAsyncOptions
 * @property {import('./collapsePopulation.js').CollapsePopulationHooks} [hooks]
 * @property {() => Promise<void>} [yieldToUi]
 */

/**
 * Async population collapse with progress hooks between substeps.
 *
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../types.js').WorldDocument} worldDocument
 * @param {ApplyPopulationCollapseAsyncOptions} [options]
 * @returns {Promise<{
 *   slice: import('./createDefaultColonizationSlice.js').ColonizationSlice,
 *   populationCollapseRaster: Float32Array,
 * }>}
 */
export async function applyPopulationCollapseAsync(slice, worldDocument, options = {}) {
  const populationCollapseRaster = await collapsePopulationAsync(
    {
      settlements: slice.settlements,
      primaryClaim: slice.primaryClaim,
      arableRaster: worldDocument.arableRaster,
      elevation: worldDocument.fields?.elevation,
      lakeMask: worldDocument.lakeMask,
      riverCorridorMask: worldDocument.riverCorridorMask,
      simulationRiverMask: worldDocument.simulationRiverMask,
      biomes: worldDocument.biomes,
      gridWidth: worldDocument.gridWidth,
      gridHeight: worldDocument.gridHeight,
      geographySeed: worldDocument.geographySeed ?? 0,
      epoch: slice.epoch,
    },
    {
      hooks: options.hooks,
      yieldToUi: options.yieldToUi,
    },
  )

  return {
    slice: {
      ...slice,
      populationCollapseRaster,
    },
    populationCollapseRaster,
  }
}
