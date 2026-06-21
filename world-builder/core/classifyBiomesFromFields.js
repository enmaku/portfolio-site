import { BIOMES, SEA_LEVEL } from './biomeIds.js'

/**
 * @typedef {Object} FieldSample
 * @property {number} elevation
 * @property {number} temperature
 * @property {number} rainfall
 * @property {number} drainage
 * @property {number} salidity
 */

/**
 * Classify one cell from normalized scalar fields.
 * @param {FieldSample} sample
 * @returns {number} biome index
 */
export function classifyBiomeFromSample(sample) {
  const { elevation, temperature, rainfall, drainage, salidity } = sample

  if (elevation < SEA_LEVEL) {
    return BIOMES.OCEAN
  }

  if (salidity >= 0.45) {
    return BIOMES.COAST
  }

  if (elevation >= 0.82 && temperature <= 0.28) {
    return BIOMES.GLACIER
  }

  if (elevation >= 0.78) {
    return BIOMES.MOUNTAIN
  }

  if (temperature <= 0.22) {
    return BIOMES.TUNDRA
  }

  if (temperature <= 0.38 && rainfall >= 0.35) {
    return BIOMES.TAIGA
  }

  if (rainfall <= 0.18) {
    return BIOMES.DESERT
  }

  if (rainfall <= 0.32) {
    return BIOMES.SCRUBLAND
  }

  if (rainfall >= 0.68 && drainage <= 0.35) {
    return BIOMES.SWAMP
  }

  if (elevation >= 0.58 && elevation < 0.78) {
    return BIOMES.HILLS
  }

  if (temperature >= 0.62 && rainfall >= 0.72) {
    return BIOMES.TROPICAL_RAINFOREST
  }

  if (temperature >= 0.52 && rainfall >= 0.42 && rainfall < 0.72) {
    return BIOMES.SAVANNA
  }

  if (temperature >= 0.35 && temperature < 0.62 && rainfall >= 0.45) {
    return BIOMES.TEMPERATE_FOREST
  }

  return BIOMES.GRASSLAND
}

/**
 * @param {Object} fields
 * @param {Float32Array} fields.elevation
 * @param {Float32Array} fields.temperature
 * @param {Float32Array} fields.rainfall
 * @param {Float32Array} fields.drainage
 * @param {Float32Array} fields.salidity
 * @param {number} width
 * @param {number} height
 * @returns {Uint8Array}
 */
export function classifyBiomesFromFields(fields, width, height) {
  const { elevation, temperature, rainfall, drainage, salidity } = fields
  const biomes = new Uint8Array(width * height)

  for (let i = 0; i < biomes.length; i += 1) {
    biomes[i] = classifyBiomeFromSample({
      elevation: elevation[i],
      temperature: temperature[i],
      rainfall: rainfall[i],
      drainage: drainage[i],
      salidity: salidity[i],
    })
  }

  return biomes
}
