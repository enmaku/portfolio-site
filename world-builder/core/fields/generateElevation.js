import { deriveFieldSeed } from '../noise/seededRandom.js'
import { scaleForGridSize } from '../types.js'
import { resolveWorldGenerationOptions } from '../worldGenerationOptions.js'
import { applyClosedIslandRim } from './applyClosedIslandRim.js'
import {
  applyCoastDistanceBias,
  applySlopeDependentRoughness,
  computeLandCoastDistance,
  generateWarpedFbm2d,
  reduceGentleSlopeHighFrequency,
  smoothMidLevelElevation,
} from './elevationPriors.js'
import { scaleElevationAroundSeaLevel } from './scaleElevationAroundSeaLevel.js'

/**
 * @param {Object} params
 * @param {number} params.geographySeed
 * @param {number} params.width
 * @param {number} params.height
 * @param {Partial<import('../types.js').WorldGenerationOptions>} [params.options]
 * @returns {Float32Array}
 */
export function generateElevation({ geographySeed, width, height, options }) {
  const resolved = resolveWorldGenerationOptions(options)
  const seed = deriveFieldSeed(geographySeed, 'elevation')
  const warpStrength =
    resolved.elevationDomainWarpStrength > 0
      ? scaleForGridSize(resolved.elevationDomainWarpStrength, width)
      : 0

  const elevation = generateWarpedFbm2d({
    width,
    height,
    seed,
    octaves: resolved.elevationOctaves,
    frequency: scaleForGridSize(0.008 * resolved.elevationFrequencyScale, width),
    persistence: resolved.elevationPersistence,
    warpStrength,
    gentleSlopePersistenceScale: resolved.elevationGentleSlopePersistenceScale,
  })

  scaleElevationAroundSeaLevel(elevation, resolved.seaLevel, resolved.elevationScale)

  if (resolved.elevationCoastBiasStrength > 0) {
    const coastDistance = computeLandCoastDistance(
      elevation,
      width,
      height,
      resolved.seaLevel,
    )
    applyCoastDistanceBias(
      elevation,
      coastDistance,
      width,
      height,
      resolved.seaLevel,
      resolved.elevationCoastBiasStrength,
    )
  }

  if (resolved.elevationMidSmoothingStrength > 0) {
    smoothMidLevelElevation(
      elevation,
      width,
      height,
      resolved.seaLevel,
      resolved.elevationMidSmoothingStrength,
      0.78,
    )
  }

  reduceGentleSlopeHighFrequency(
    elevation,
    width,
    height,
    resolved.elevationGentleSlopePersistenceScale,
  )

  if (resolved.elevationSlopeRoughnessStrength > 0) {
    applySlopeDependentRoughness(
      elevation,
      width,
      height,
      seed,
      resolved.elevationSlopeRoughnessStrength,
    )
  }

  applyClosedIslandRim(elevation, width, height)
  return elevation
}
