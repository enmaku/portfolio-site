import { BIOMES, SEA_LEVEL } from '../biomeIds.js'
import { computeSlopeField } from '../fields/elevationPriors.js'
import { clamp01 } from '../grid/gridTopology.js'

/**
 * Macro metals potential raster from terrain, biomes, slope, and headwater proxies.
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {Uint8Array} params.biomes
 * @param {Float32Array} params.drainage
 * @param {Uint8Array} [params.riverNetworkMask]
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} [params.seaLevel]
 * @returns {Float32Array}
 */
export function computeMetalsRaster({
  elevation,
  biomes,
  drainage,
  riverNetworkMask,
  width,
  height,
  seaLevel = SEA_LEVEL,
}) {
  const slopes = computeSlopeField(elevation, width, height)
  const raster = new Float32Array(width * height)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x
      if (elevation[idx] < seaLevel) {
        raster[idx] = 0
        continue
      }

      let score = slopes[idx] * 0.45
      const biome = biomes[idx]
      if (biome === BIOMES.HILLS) score += 0.28
      if (biome === BIOMES.MOUNTAIN) score += 0.42

      const upland = elevation[idx] > seaLevel + 0.18
      if (upland && drainage[idx] > 0.08 && drainage[idx] < 0.72) {
        score += 0.18
      }
      if (riverNetworkMask?.[idx] && upland) {
        score += 0.1
      }

      raster[idx] = clamp01(score)
    }
  }

  return raster
}
