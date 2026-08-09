import { deriveFieldSeed } from '../noise/seededRandom.js'
import { generateFbm2d } from '../noise/fbm2d.js'
import { applyOrographicMoisture } from './applyOrographicMoisture.js'
import { computeMoistureAdvection } from './computeMoistureAdvection.js'
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

  const advectionStrength = resolved.moistureAdvectionStrength
  const blended = new Float32Array(base.length)
  if (advectionStrength > 0) {
    const advection = computeMoistureAdvection({
      elevation,
      width,
      height,
      prevailingWindDegrees,
      seaLevel: resolved.seaLevel,
    })
    for (let i = 0; i < base.length; i += 1) {
      const multiplier = 1 + advectionStrength * (advection[i] * 2 - 1)
      blended[i] = Math.min(1, Math.max(0, base[i] * multiplier))
    }
  } else {
    blended.set(base)
  }

  const oro = applyOrographicMoisture({
    rainfall: blended,
    elevation,
    width,
    height,
    prevailingWindDegrees,
    rainShadowStrength: resolved.rainShadowStrength,
  })

  if (resolved.rainfallAmountScale === 1) {
    return oro
  }

  const scaled = new Float32Array(oro.length)
  for (let i = 0; i < oro.length; i += 1) {
    scaled[i] = Math.min(1, Math.max(0, oro[i] * resolved.rainfallAmountScale))
  }
  return scaled
}
