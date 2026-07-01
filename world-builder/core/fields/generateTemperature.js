import { clamp01 } from '../grid/gridTopology.js'
import { deriveFieldSeed } from '../noise/seededRandom.js'
import { generateFbm2d } from '../noise/fbm2d.js'
import { scaleForGridSize } from '../types.js'
import { resolveWorldGenerationOptions } from '../worldGenerationOptions.js'

/**
 * Row 0 is north; equator is mid-latitude; elevation lapse cools high ground.
 * @param {Object} params
 * @param {number} params.geographySeed
 * @param {number} params.width
 * @param {number} params.height
 * @param {Float32Array} params.elevation
 * @param {Partial<import('../types.js').WorldGenerationOptions>} [params.options]
 * @returns {Float32Array} normalized temperature in [0, 1] (0 = cold, 1 = hot)
 */
export function generateTemperature({ geographySeed, width, height, elevation, options } ) {
  const resolved = resolveWorldGenerationOptions(options)
  const seed = deriveFieldSeed(geographySeed, 'temperature')
  const noise = generateFbm2d({
    width,
    height,
    seed,
    octaves: 4,
    frequency: scaleForGridSize(0.015, width),
    persistence: 0.45,
  })
  const out = new Float32Array(width * height)
  const equatorRow = height > 1 ? (height - 1) / 2 : 0

  for (let y = 0; y < height; y += 1) {
    const latitudeFactor =
      height <= 1 ? 1 : 1 - Math.abs(y - equatorRow) / equatorRow
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x
      const lapse = elevation[idx] * resolved.temperatureLapseRate
      const base = latitudeFactor * 0.65 + noise[idx] * 0.35
      out[idx] = clamp01(base - lapse)
    }
  }

  return out
}
