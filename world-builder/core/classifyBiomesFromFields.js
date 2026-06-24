import { generateBiomeEdgeNoiseOffsets } from './biomeEdgeNoise.js'
import { BIOMES, SEA_LEVEL, SNOW_CAP_ELEVATION_MIN, SNOW_CAP_TEMPERATURE_MAX } from './biomeIds.js'

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
 * @param {number} [seaLevel]
 * @returns {number} biome index
 */
export function classifyBiomeFromSample(sample, seaLevel = SEA_LEVEL) {
  const { elevation, temperature, rainfall, drainage, salidity } = sample

  if (elevation < seaLevel) {
    return BIOMES.OCEAN
  }

  if (salidity >= 0.45) {
    return BIOMES.COAST
  }

  if (elevation >= SNOW_CAP_ELEVATION_MIN && temperature <= SNOW_CAP_TEMPERATURE_MAX) {
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
 * @param {number} [seaLevel]
 * @param {number} [geographySeed] when set, applies seeded fractal noise to roughen inland biome edges
 * @param {number} [biomeEdgeNoiseStrength] scales inland edge noise; 0 disables
 * @returns {Uint8Array}
 */
export function classifyBiomesFromFields(
  fields,
  width,
  height,
  seaLevel = SEA_LEVEL,
  geographySeed,
  biomeEdgeNoiseStrength = 1,
) {
  const { elevation, temperature, rainfall, drainage, salidity } = fields
  const biomes = new Uint8Array(width * height)
  const edgeNoise =
    geographySeed == null
      ? null
      : generateBiomeEdgeNoiseOffsets(geographySeed, width, height, biomeEdgeNoiseStrength)

  for (let i = 0; i < biomes.length; i += 1) {
    const sample = {
      elevation: elevation[i],
      temperature: temperature[i],
      rainfall: rainfall[i],
      drainage: drainage[i],
      salidity: salidity[i],
    }
    const baseBiome = classifyBiomeFromSample(sample, seaLevel)

    if (!edgeNoise || baseBiome === BIOMES.OCEAN || baseBiome === BIOMES.COAST) {
      biomes[i] = baseBiome
      continue
    }

    biomes[i] = classifyBiomeFromSample(
      {
        ...sample,
        temperature: temperature[i] + edgeNoise.temperature[i],
        rainfall: rainfall[i] + edgeNoise.rainfall[i],
        drainage: drainage[i] + edgeNoise.drainage[i],
      },
      seaLevel,
    )
  }

  return biomes
}

/**
 * Apply freshwater hydrology overlays after continental classification.
 * @param {Object} fields
 * @param {Float32Array} fields.elevation
 * @param {Float32Array} fields.temperature
 * @param {Float32Array} fields.rainfall
 * @param {Float32Array} fields.drainage
 * @param {Float32Array} fields.salidity
 * @param {number} width
 * @param {number} height
 * @param {Object} hydrology
 * @param {Uint8Array} hydrology.lakeMask
 * @param {Uint8Array} hydrology.riverCorridorMask
 * @param {Float32Array} [hydrology.channelWidth]
 * @param {Int16Array} hydrology.flowDirection
 * @param {number} [seaLevel]
 * @param {number} [geographySeed]
 * @param {number} [biomeEdgeNoiseStrength]
 * @returns {Uint8Array}
 */
export function classifyBiomesWithHydrology(
  fields,
  width,
  height,
  hydrology,
  seaLevel = SEA_LEVEL,
  geographySeed,
  biomeEdgeNoiseStrength = 1,
) {
  const biomes = classifyBiomesFromFields(
    fields,
    width,
    height,
    seaLevel,
    geographySeed,
    biomeEdgeNoiseStrength,
  )
  const { lakeMask, riverCorridorMask } = hydrology

  for (let i = 0; i < biomes.length; i += 1) {
    if (lakeMask[i]) {
      biomes[i] = BIOMES.FRESHWATER_LAKE
    } else if (riverCorridorMask[i]) {
      biomes[i] = BIOMES.RIVER_CORRIDOR
    }
  }

  return biomes
}
