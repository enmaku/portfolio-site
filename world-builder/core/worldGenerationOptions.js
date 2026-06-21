import { SEA_LEVEL } from './biomeIds.js'
import { EROSION_STEP_COUNT } from './types.js'

/** @typedef {import('./types.js').WorldGenerationOptions} WorldGenerationOptions */

/** @type {WorldGenerationOptions} */
export const DEFAULT_WORLD_GENERATION_OPTIONS = {
  seaLevel: SEA_LEVEL,
  elevationScale: 1,
  elevationFrequencyScale: 1,
  elevationOctaves: 6,
  elevationPersistence: 0.55,
  erosionStepCount: EROSION_STEP_COUNT,
  erosionChannelWear: 0.004,
  erosionPeakWear: 0.002,
  rainShadowStrength: 1,
  temperatureLapseRate: 0.55,
  rainfallFrequencyScale: 1,
  navigableFlowCutoffScale: 1,
  minLakeAreaScale: 1,
  soilDrainageScale: 0.75,
  maxSaltNodes: 12,
}

/**
 * @param {Partial<WorldGenerationOptions> | undefined | null} partial
 * @returns {WorldGenerationOptions}
 */
export function resolveWorldGenerationOptions(partial) {
  if (!partial) {
    return { ...DEFAULT_WORLD_GENERATION_OPTIONS }
  }
  return {
    ...DEFAULT_WORLD_GENERATION_OPTIONS,
    ...partial,
  }
}
