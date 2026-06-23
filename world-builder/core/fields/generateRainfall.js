import { deriveFieldSeed } from '../noise/seededRandom.js'
import { generateFbm2d } from '../noise/fbm2d.js'
import { applyRainShadow } from './applyRainShadow.js'
import { scaleForGridSize } from '../types.js'
import { resolveWorldGenerationOptions } from '../worldGenerationOptions.js'

/**
 * @param {Object} params
 * @param {number} params.geographySeed
 * @param {number} params.width
 * @param {number} params.height
 * @param {Float32Array} params.elevation
 * @param {number} params.prevailingWindDegrees
 * @param {Partial<import('../types.js').WorldGenerationOptions>} [params.options]
 * @returns {Float32Array}
 */
export function generateRainfall({
  geographySeed,
  width,
  height,
  elevation,
  prevailingWindDegrees,
  options,
}) {
  const resolved = resolveWorldGenerationOptions(options)
  const seed = deriveFieldSeed(geographySeed, 'rainfall')
  const base = generateFbm2d({
    width,
    height,
    seed,
    octaves: 5,
    frequency: scaleForGridSize(0.014 * resolved.rainfallFrequencyScale, width),
    persistence: 0.5,
  })

  const shadowed = applyRainShadow({
    rainfall: base,
    elevation,
    width,
    height,
    prevailingWindDegrees,
    rainShadowStrength: resolved.rainShadowStrength,
  })

  if (resolved.rainfallAmountScale === 1) {
    return shadowed
  }

  const scaled = new Float32Array(shadowed.length)
  for (let i = 0; i < shadowed.length; i += 1) {
    scaled[i] = Math.min(1, Math.max(0, shadowed[i] * resolved.rainfallAmountScale))
  }
  return scaled
}
