import {
  connectNearbyRiverCorridors,
  riverAttractionRadiusForGrid,
} from './connectNearbyRiverCorridors.js'
import {
  refineRiverNetworkFromSketch,
  riverSettlementStepsForGrid,
} from './refineRiverNetwork.js'

/**
 * Contract routing for legacy meander heuristics. Each stage maps to one hydrology substep
 * and is opt-in via world-generation options.
 */
export const RIVER_LEGACY_MEANDER_STAGES = {
  corridorAttraction: {
    substepId: 'hydrologyRoute',
    optionKey: 'riverAttractionRadiusScale',
  },
  meanderRefine: {
    substepId: 'hydrologyRefine',
    optionKey: 'enableMeanderRefine',
  },
}

/**
 * @param {number} gridSize
 * @param {number} radiusScale
 */
export function isCorridorAttractionEnabled(gridSize, radiusScale) {
  return riverAttractionRadiusForGrid(gridSize, radiusScale) > 0
}

/**
 * @param {import('../types.js').WorldGenerationOptions} options
 */
export function isMeanderRefineEnabled(options) {
  return Boolean(options.enableMeanderRefine)
}

/**
 * hydrologyRoute: optional corridor bridging between nearby sketch components.
 * @param {Object} params
 * @param {Uint8Array} params.baseRiverNetworkMask
 * @param {Float32Array} params.elevation
 * @param {boolean[]} params.ocean
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.geographySeed
 * @param {Int16Array} params.flowDirection
 * @param {number} params.riverAttractionRadiusScale
 * @returns {Uint8Array}
 */
export function applyRouteStageCorridorAttraction({
  baseRiverNetworkMask,
  elevation,
  ocean,
  width,
  height,
  geographySeed,
  flowDirection,
  riverAttractionRadiusScale,
}) {
  const attractionRadius = riverAttractionRadiusForGrid(width, riverAttractionRadiusScale)
  if (attractionRadius <= 0) {
    return baseRiverNetworkMask
  }
  return connectNearbyRiverCorridors({
    riverNetworkMask: baseRiverNetworkMask,
    elevation,
    ocean,
    width,
    height,
    geographySeed,
    flowDirection,
    attractionRadius,
  })
}

/**
 * hydrologyRefine: optional A* meander presentation mask from settled centerline sketch.
 * @param {Object} params
 * @param {Uint8Array} params.sketchMask
 * @param {Float32Array} params.elevation
 * @param {boolean[]} params.ocean
 * @param {Int16Array} params.flowDirection
 * @param {Float32Array} params.flowAccumulation
 * @param {Uint8Array} params.lakeMask
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.geographySeed
 * @param {import('../types.js').WorldGenerationOptions} params.options
 * @returns {{ riverNetworkMask: Uint8Array, elevation: Float32Array }}
 */
export function applyRefineStageMeanderPresentation({
  sketchMask,
  elevation,
  ocean,
  flowDirection,
  flowAccumulation,
  lakeMask,
  width,
  height,
  geographySeed,
  options,
}) {
  return refineRiverNetworkFromSketch({
    sketchMask,
    elevation,
    ocean,
    flowDirection,
    flowAccumulation,
    lakeMask,
    width,
    height,
    geographySeed,
    meanderStrength: options.riverMeanderStrength,
    settlementStepCount: riverSettlementStepsForGrid(width, options.riverSettlementSteps),
    mergeStrength: options.riverMergeStrength,
    channelWear: options.erosionChannelWear,
    seaLevel: options.seaLevel,
    navigableFlowCutoffScale: options.navigableFlowCutoffScale,
  })
}
