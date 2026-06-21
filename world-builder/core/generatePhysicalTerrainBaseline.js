import { BIOMES_CATALOG } from './biomeCatalog.js'
import { classifyBiomesFromFields } from './classifyBiomesFromFields.js'
import { generateDrainage } from './fields/generateDrainage.js'
import { generateElevation } from './fields/generateElevation.js'
import { generateRainfall } from './fields/generateRainfall.js'
import { generateTemperature } from './fields/generateTemperature.js'
import { deriveSalidityFromOcean } from './fields/deriveSalidityFromOcean.js'
import {
  DEFAULT_GRID_SIZE,
  PIPELINE_STAGE_PHYSICAL_TERRAIN_BASELINE,
} from './types.js'

/**
 * @param {import('./types.js').PhysicalTerrainBaselineParams} params
 * @returns {import('./types.js').WorldDocument}
 */
export function generatePhysicalTerrainBaseline(params) {
  const width = params.width ?? DEFAULT_GRID_SIZE
  const height = params.height ?? DEFAULT_GRID_SIZE
  const geographySeed = params.geographySeed | 0
  const prevailingWindDegrees = normalizeWindDegrees(params.prevailingWindDegrees)

  const elevation = generateElevation({ geographySeed, width, height })
  const temperature = generateTemperature({ geographySeed, width, height, elevation })
  const rainfall = generateRainfall({
    geographySeed,
    width,
    height,
    elevation,
    prevailingWindDegrees,
  })
  const drainage = generateDrainage({ geographySeed, width, height })
  const salidity = deriveSalidityFromOcean({ elevation, width, height })

  const fields = { elevation, temperature, rainfall, drainage, salidity }
  const biomes = classifyBiomesFromFields(fields, width, height)

  return {
    geographySeed: geographySeed >= 0 ? geographySeed : geographySeed + 4294967296,
    prevailingWindDegrees,
    gridWidth: width,
    gridHeight: height,
    fields,
    biomes,
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
