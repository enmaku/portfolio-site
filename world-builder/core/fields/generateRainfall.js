import { deriveFieldSeed } from '../noise/seededRandom.js'
import { generateFbm2d } from '../noise/fbm2d.js'
import { applyRainShadow } from './applyRainShadow.js'
import { scaleForGridSize } from '../types.js'

/**
 * @param {Object} params
 * @param {number} params.geographySeed
 * @param {number} params.width
 * @param {number} params.height
 * @param {Float32Array} params.elevation
 * @param {number} params.prevailingWindDegrees
 * @returns {Float32Array}
 */
export function generateRainfall({
  geographySeed,
  width,
  height,
  elevation,
  prevailingWindDegrees,
}) {
  const seed = deriveFieldSeed(geographySeed, 'rainfall')
  const base = generateFbm2d({
    width,
    height,
    seed,
    octaves: 5,
    frequency: scaleForGridSize(0.014, width),
    persistence: 0.5,
  })

  return applyRainShadow({
    rainfall: base,
    elevation,
    width,
    height,
    prevailingWindDegrees,
  })
}
