import { BIOMES_CATALOG } from './biomeCatalog.js'
import { buildDisplayBiomes } from './buildDisplayBiomes.js'
import { classifyBiomesFromFields } from './classifyBiomesFromFields.js'
import { generateDrainage } from './fields/generateDrainage.js'
import { generateElevation } from './fields/generateElevation.js'
import { generateRainfall } from './fields/generateRainfall.js'
import { generateTemperature } from './fields/generateTemperature.js'
import { deriveSalinityFromOcean } from './fields/deriveSalinityFromOcean.js'
import {
  DEFAULT_GRID_SIZE,
  PIPELINE_STAGE_PHYSICAL_TERRAIN_BASELINE,
} from './types.js'
import { resolveWorldGenerationOptions } from './worldGenerationOptions.js'

/**
 * @param {import('./types.js').PhysicalTerrainBaselineParams} params
 * @returns {import('./types.js').WorldDocument}
 */
export function generatePhysicalTerrainBaseline(params) {
  const width = params.width ?? DEFAULT_GRID_SIZE
  const height = params.height ?? DEFAULT_GRID_SIZE
  const geographySeed = params.geographySeed | 0
  const prevailingWindDegrees = normalizeWindDegrees(params.prevailingWindDegrees)
  const options = resolveWorldGenerationOptions(params.options)

  const elevation = generateElevation({ geographySeed, width, height, options })
  const temperature = generateTemperature({ geographySeed, width, height, elevation, options })
  const rainfall = generateRainfall({
    geographySeed,
    width,
    height,
    elevation,
    prevailingWindDegrees,
    options,
  })
  const drainage = generateDrainage({ geographySeed, width, height, options })
  const salinity = deriveSalinityFromOcean({
    elevation,
    width,
    height,
    seaLevel: options.seaLevel,
  })

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

  return {
    geographySeed: geographySeed >= 0 ? geographySeed : geographySeed + 4294967296,
    prevailingWindDegrees,
    gridWidth: width,
    gridHeight: height,
    fields,
    biomes,
    displayBiomes,
    biomeCatalog: BIOMES_CATALOG,
    generatedAt: new Date().toISOString(),
    pipelineStage: PIPELINE_STAGE_PHYSICAL_TERRAIN_BASELINE,
  }
}

/**
 * @param {number} degrees
 */
function normalizeWindDegrees(degrees) {
  const rounded = Math.round(degrees)
  return ((rounded % 360) + 360) % 360
}
