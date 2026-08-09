import { clamp01 } from '../grid/gridTopology.js'
import { sampleValueNoise2d } from '../noise/valueNoise2d.js'

/**
 * @param {Float32Array} elevation
 * @param {Float32Array} coastDistance
 * @param {number} width
 * @param {number} height
 * @param {number} seaLevel
 * @param {number} strength
 */
export function applyCoastDistanceBias(
  elevation,
  coastDistance,
  width,
  height,
  seaLevel,
  strength,
) {
  if (strength <= 0) return

  let maxDistance = 1
  for (let i = 0; i < coastDistance.length; i += 1) {
    if (Number.isFinite(coastDistance[i]) && coastDistance[i] > maxDistance) {
      maxDistance = coastDistance[i]
    }
  }

  for (let i = 0; i < elevation.length; i += 1) {
    if (elevation[i] < seaLevel || !Number.isFinite(coastDistance[i])) continue
    const inlandFactor = clamp01(coastDistance[i] / maxDistance)
    const delta = strength * (2 * inlandFactor - 1)
    elevation[i] = clamp01(elevation[i] + delta)
  }
}

/**
 * @param {Float32Array} elevation
 * @param {number} width
 * @param {number} height
 * @param {number} seaLevel
 * @param {number} strength
 * @param {number} peakPreserveThreshold
 */
export function smoothMidLevelElevation(
  elevation,
  width,
  height,
  seaLevel,
  strength,
  peakPreserveThreshold,
) {
  if (strength <= 0) return

  const source = new Float32Array(elevation)
  const midFloor = seaLevel + 0.05

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x
      const value = source[idx]
      if (value >= peakPreserveThreshold || value < midFloor) continue

      let sum = 0
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          sum += source[(y + dy) * width + (x + dx)]
        }
      }
      const blurred = sum / 9
      const midWeight = clamp01((value - midFloor) / (peakPreserveThreshold - midFloor))
      const blend = strength * (1 - midWeight * 0.35)
      elevation[idx] = value + (blurred - value) * blend
    }
  }
}

/**
 * @param {Float32Array} elevation
 * @param {number} width
 * @param {number} height
 * @returns {Float32Array}
 */
export function computeSlopeField(elevation, width, height) {
  const slopes = new Float32Array(width * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x
      const left = elevation[y * width + Math.max(0, x - 1)]
      const right = elevation[y * width + Math.min(width - 1, x + 1)]
      const up = elevation[Math.max(0, y - 1) * width + x]
      const down = elevation[Math.min(height - 1, y + 1) * width + x]
      slopes[idx] = Math.max(Math.abs(right - left), Math.abs(down - up)) * 0.5
    }
  }
  return slopes
}

/**
 * @param {Float32Array} elevation
 * @param {number} width
 * @param {number} height
 * @param {number} seed
 * @param {number} strength
 * @param {{ minSlope?: number, maxSlope?: number }} [params]
 */
export function applySlopeDependentRoughness(
  elevation,
  width,
  height,
  seed,
  strength,
  params = {},
) {
  if (strength <= 0) return

  const minSlope = params.minSlope ?? 0.004
  const maxSlope = params.maxSlope ?? 0.05
  const slopes = computeSlopeField(elevation, width, height)
  const frequency = 0.22

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x
      const slopeFactor = clamp01((slopes[idx] - minSlope) / (maxSlope - minSlope))
      if (slopeFactor <= 0) continue
      const detail = sampleValueNoise2d(x * frequency, y * frequency, seed + 8803) - 0.5
      elevation[idx] = clamp01(elevation[idx] + detail * strength * slopeFactor * 2)
    }
  }
}

/**
 * @param {Float32Array} elevation
 * @param {number} width
 * @param {number} height
 * @param {number} gentleSlopePersistenceScale
 */
export function reduceGentleSlopeHighFrequency(
  elevation,
  width,
  height,
  gentleSlopePersistenceScale,
) {
  if (gentleSlopePersistenceScale >= 1) return

  const source = new Float32Array(elevation)
  const slopes = computeSlopeField(source, width, height)
  const reduction = 1 - gentleSlopePersistenceScale

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x
      const gentleFactor = 1 - clamp01(slopes[idx] / 0.03)
      if (gentleFactor <= 0) continue

      let sum = 0
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          sum += source[(y + dy) * width + (x + dx)]
        }
      }
      const lowPass = sum / 9
      const highPass = source[idx] - lowPass
      elevation[idx] = clamp01(source[idx] - highPass * reduction * gentleFactor)
    }
  }
}

/**
 * @param {Object} params
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.seed
 * @param {number} params.octaves
 * @param {number} params.frequency
 * @param {number} params.persistence
 * @param {number} params.warpStrength
 * @param {number} params.gentleSlopePersistenceScale
 * @returns {Float32Array}
 */
export function generateWarpedFbm2d({
  width,
  height,
  seed,
  octaves,
  frequency,
  persistence,
  warpStrength,
  gentleSlopePersistenceScale,
}) {
  const out = new Float32Array(width * height)
  const warpFrequency = frequency * 0.45
  const coarseOctaves = Math.min(3, octaves)
  const detailOctaves = Math.max(0, octaves - coarseOctaves)

  let maxAmplitude = 0
  let amplitude = 1
  for (let o = 0; o < octaves; o += 1) {
    maxAmplitude += amplitude
    amplitude *= persistence
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const warpX =
        warpStrength > 0
          ? (sampleValueNoise2d(x * warpFrequency, y * warpFrequency, seed + 7101) * 2 - 1) * warpStrength
          : 0
      const warpY =
        warpStrength > 0
          ? (sampleValueNoise2d(x * warpFrequency, y * warpFrequency, seed + 7102) * 2 - 1) * warpStrength
          : 0
      const sampleX = x + warpX
      const sampleY = y + warpY

      let value = 0
      amplitude = 1
      let freq = frequency
      for (let o = 0; o < coarseOctaves; o += 1) {
        value += sampleValueNoise2d(sampleX * freq, sampleY * freq, seed + o * 1013) * amplitude
        freq *= 2
        amplitude *= persistence
      }

      let detailValue = 0
      let detailAmplitude = amplitude
      let detailFreq = freq
      for (let o = 0; o < detailOctaves; o += 1) {
        detailValue +=
          sampleValueNoise2d(sampleX * detailFreq, sampleY * detailFreq, seed + (coarseOctaves + o) * 1013) *
          detailAmplitude
        detailFreq *= 2
        detailAmplitude *= persistence
      }

      const slopeProxy = Math.abs(
        sampleValueNoise2d(sampleX * frequency * 0.5, sampleY * frequency * 0.5, seed + 7201) - 0.5,
      )
      const slopeFactor = clamp01(slopeProxy / 0.25)
      const detailScale =
        gentleSlopePersistenceScale + (1 - gentleSlopePersistenceScale) * slopeFactor
      value += detailValue * detailScale
      out[y * width + x] = value / maxAmplitude
    }
  }

  return out
}

