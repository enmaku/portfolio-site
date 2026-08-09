import { BIOMES, SNOW_CAP_ELEVATION_MIN, SNOW_CAP_TEMPERATURE_MAX } from '../biomeIds.js'
import { createSeededRandom, deriveFieldSeed } from '../noise/seededRandom.js'

/** @type {Readonly<Record<number, number>>} */
const FOREST_BIOME_PRODUCTIVITY = {
  [BIOMES.TEMPERATE_FOREST]: 0.88,
  [BIOMES.TAIGA]: 0.72,
  [BIOMES.TROPICAL_RAINFOREST]: 0.95,
}

/**
 * @param {number} value
 */
function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}

/**
 * @param {number} biome
 */
function biomeBaseProductivity(biome) {
  return FOREST_BIOME_PRODUCTIVITY[biome] ?? 0
}

/**
 * Suppress timber above a treeline proxy from cold high cells.
 * @param {number} elevation
 * @param {number} temperature
 */
function treelineSuppression(elevation, temperature) {
  const elevSpan = Math.max(0.001, SNOW_CAP_ELEVATION_MIN - 0.6)
  const elevFactor = clamp01((elevation - 0.6) / elevSpan)
  const coldSpan = Math.max(0.001, SNOW_CAP_TEMPERATURE_MAX - 0.08)
  const coldFactor = clamp01((SNOW_CAP_TEMPERATURE_MAX - temperature) / coldSpan)
  return 1 - elevFactor * coldFactor
}

/**
 * Normalized timber productivity raster from forest biomes with treeline decay.
 * @param {Object} params
 * @param {import('../types.js').ScalarFields} params.fields
 * @param {Uint8Array} params.biomes
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.geographySeed
 * @returns {Float32Array}
 */
export function generateTimberProductivity({
  fields,
  biomes,
  width,
  height,
  geographySeed,
}) {
  const raster = new Float32Array(width * height)
  const random = createSeededRandom(deriveFieldSeed(geographySeed, 'timber-productivity'))

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      const base = biomeBaseProductivity(biomes[index])
      if (base <= 0) {
        raster[index] = 0
        continue
      }

      const suppression = treelineSuppression(fields.elevation[index], fields.temperature[index])
      const noise = 0.92 + random() * 0.08
      raster[index] = clamp01(base * suppression * noise)
    }
  }

  return raster
}
