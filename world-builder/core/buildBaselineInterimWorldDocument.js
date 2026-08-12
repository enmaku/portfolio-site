import { BIOMES_CATALOG } from './biomeCatalog.js'
import { buildDisplayBiomes } from './buildDisplayBiomes.js'
import { classifyBiomesFromFields } from './classifyBiomesFromFields.js'
import { generateDrainage } from './fields/generateDrainage.js'
import { generateTemperature } from './fields/generateTemperature.js'
import { deriveSalinityFromOcean } from './fields/deriveSalinityFromOcean.js'
import { PIPELINE_STAGE_PHYSICAL_TERRAIN_BASELINE } from './types.js'

/**
 * @typedef {Object} BaselineInterimClimateCache
 * @property {Float32Array} temperature
 * @property {Float32Array} drainage
 * @property {Float32Array} salinity
 */

/**
 * Rough landmass preview while baseline is still running (elevation / rainfall lobes).
 * Reuses temperature/drainage/salinity across rainfall lobe frames.
 *
 * @param {Object} params
 * @param {number} params.geographySeed
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.prevailingWindDegrees
 * @param {number} params.secondaryMaximumDegrees
 * @param {import('./types.js').WorldGenerationOptions} params.options
 * @param {Float32Array} params.elevation
 * @param {Float32Array} params.rainfall
 * @param {BaselineInterimClimateCache} [params.climateCache]
 * @returns {{ worldDocument: import('./types.js').WorldDocument, climateCache: BaselineInterimClimateCache }}
 */
export function buildBaselineInterimWorldDocument({
  geographySeed,
  width,
  height,
  prevailingWindDegrees,
  secondaryMaximumDegrees,
  options,
  elevation,
  rainfall,
  climateCache,
}) {
  const temperature =
    climateCache?.temperature ??
    generateTemperature({ geographySeed, width, height, elevation, options })
  const drainage =
    climateCache?.drainage ?? generateDrainage({ geographySeed, width, height, options })
  const salinity =
    climateCache?.salinity ??
    deriveSalinityFromOcean({
      elevation,
      width,
      height,
      seaLevel: options.seaLevel,
    })
  const nextCache = { temperature, drainage, salinity }
  const fields = { elevation, temperature, rainfall, drainage, salinity }
  const biomes = classifyBiomesFromFields(
    fields,
    width,
    height,
    options.seaLevel,
    geographySeed,
    options.biomeEdgeNoiseStrength,
  )
  const displayBiomes = buildDisplayBiomes(biomes, fields, options.seaLevel)
  const seed = geographySeed | 0
  return {
    climateCache: nextCache,
    worldDocument: {
      geographySeed: seed >= 0 ? seed : seed + 4294967296,
      prevailingWindDegrees,
      secondaryMaximumDegrees,
      gridWidth: width,
      gridHeight: height,
      fields,
      biomes,
      displayBiomes,
      biomeCatalog: BIOMES_CATALOG,
      generatedAt: new Date().toISOString(),
      pipelineStage: PIPELINE_STAGE_PHYSICAL_TERRAIN_BASELINE,
    },
  }
}
