import { collapsePopulation, collapsePopulationSync } from './collapsePopulation.js'

/**
 * @typedef {Object} ApplyPopulationCollapseOptions
 * @property {import('./collapsePopulation.js').CollapsePopulationHooks} [hooks]
 * @property {() => Promise<void>} [yieldToUi]
 */

/**
 * Spatial population collapse seam: maps post-tick colonization slice + geography
 * into an updated slice and the population overlay raster. Optional hooks/yieldToUi
 * report progress between substeps; both are no-ops when omitted.
 *
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../types.js').WorldDocument} worldDocument
 * @param {ApplyPopulationCollapseOptions} [options]
 * @returns {Promise<{
 *   slice: import('./createDefaultColonizationSlice.js').ColonizationSlice,
 *   populationCollapseRaster: Float32Array,
 * }>}
 */
export async function applyPopulationCollapse(slice, worldDocument, options = {}) {
  const populationCollapseRaster = await collapsePopulation(
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

/**
 * Synchronous variant for the handful of production call sites that cannot
 * await (founding commit, legacy session rehydration without a progress
 * model). Prefer {@link applyPopulationCollapse} everywhere else.
 *
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../types.js').WorldDocument} worldDocument
 * @returns {{
 *   slice: import('./createDefaultColonizationSlice.js').ColonizationSlice,
 *   populationCollapseRaster: Float32Array,
 * }}
 */
export function applyPopulationCollapseSync(slice, worldDocument) {
  const populationCollapseRaster = collapsePopulationSync({
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
