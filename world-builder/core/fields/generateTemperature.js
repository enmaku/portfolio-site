import { deriveFieldSeed } from '../noise/seededRandom.js'
import { generateFbm2d } from '../noise/fbm2d.js'
import { scaleForGridSize } from '../types.js'

/**
 * Row 0 is north; equator is mid-latitude; elevation lapse cools high ground.
 * @param {Object} params
 * @param {number} params.geographySeed
 * @param {number} params.width
 * @param {number} params.height
 * @param {Float32Array} params.elevation
 * @returns {Float32Array} normalized temperature in [0, 1] (0 = cold, 1 = hot)
 */
export function generateTemperature({ geographySeed, width, height, elevation } ) {
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
  const equatorRow = (height - 1) / 2

  for (let y = 0; y < height; y += 1) {
    const latitudeFactor = 1 - Math.abs(y - equatorRow) / equatorRow
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x
      const lapse = elevation[idx] * 0.55
      const base = latitudeFactor * 0.65 + noise[idx] * 0.35
      out[idx] = clamp01(base - lapse)
    }
  }

  return out
}

/**
 * @param {number} value
 */
function clamp01(value) {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}
