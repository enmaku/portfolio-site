import { isOceanCell } from './applyClosedIslandRim.js'

/**
 * @param {number} x
 * @param {number} y
 * @param {number} seed
 */
function hashNoise(x, y, seed) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)

  const v00 = latticeValue(ix, iy, seed)
  const v10 = latticeValue(ix + 1, iy, seed)
  const v01 = latticeValue(ix, iy + 1, seed)
  const v11 = latticeValue(ix + 1, iy + 1, seed)

  const ix0 = v00 + (v10 - v00) * sx
  const ix1 = v01 + (v11 - v01) * sx
  return ix0 + (ix1 - ix0) * sy
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} seed
 */
function latticeValue(x, y, seed) {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ seed
  n = Math.imul(n ^ (n >> 13), 1274126177)
  return ((n ^ (n >> 16)) & 0xffff) / 65535
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function clamp01(value, min = 0, max = 1) {
  if (value < min) return min
  if (value > max) return max
  return value
}

const COAST_DISTANCE_ORTH = 1
const COAST_DISTANCE_DIAG = 1.41421356237

/**
 * Two-pass chamfer distance from each land cell to the nearest ocean cell.
 * @param {Float32Array} elevation
 * @param {number} width
 * @param {number} height
 * @param {number} seaLevel
 * @returns {Float32Array}
 */
export function computeLandCoastDistance(elevation, width, height, seaLevel) {
  const ocean = isOceanCell(elevation, width, height, seaLevel)
  const distances = new Float32Array(width * height)

  for (let i = 0; i < elevation.length; i += 1) {
    distances[i] = ocean[i] ? 0 : Number.POSITIVE_INFINITY
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x
      if (ocean[idx]) continue

      let best = distances[idx]
      if (x > 0) {
        best = Math.min(best, distances[idx - 1] + COAST_DISTANCE_ORTH)
      }
      if (y > 0) {
        best = Math.min(best, distances[idx - width] + COAST_DISTANCE_ORTH)
      }
      if (x > 0 && y > 0) {
        best = Math.min(best, distances[idx - width - 1] + COAST_DISTANCE_DIAG)
      }
      if (x < width - 1 && y > 0) {
        best = Math.min(best, distances[idx - width + 1] + COAST_DISTANCE_DIAG)
      }
      distances[idx] = best
    }
  }

  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const idx = y * width + x
      if (ocean[idx]) continue

      let best = distances[idx]
      if (x < width - 1) {
        best = Math.min(best, distances[idx + 1] + COAST_DISTANCE_ORTH)
      }
      if (y < height - 1) {
        best = Math.min(best, distances[idx + width] + COAST_DISTANCE_ORTH)
      }
      if (x < width - 1 && y < height - 1) {
        best = Math.min(best, distances[idx + width + 1] + COAST_DISTANCE_DIAG)
      }
      if (x > 0 && y < height - 1) {
        best = Math.min(best, distances[idx + width - 1] + COAST_DISTANCE_DIAG)
      }
      distances[idx] = best
    }
  }

  return distances
}

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
      const detail = hashNoise(x * frequency, y * frequency, seed + 8803) - 0.5
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
          ? (hashNoise(x * warpFrequency, y * warpFrequency, seed + 7101) * 2 - 1) * warpStrength
          : 0
      const warpY =
        warpStrength > 0
          ? (hashNoise(x * warpFrequency, y * warpFrequency, seed + 7102) * 2 - 1) * warpStrength
          : 0
      const sampleX = x + warpX
      const sampleY = y + warpY

      let value = 0
      amplitude = 1
      let freq = frequency
      for (let o = 0; o < coarseOctaves; o += 1) {
        value += hashNoise(sampleX * freq, sampleY * freq, seed + o * 1013) * amplitude
        freq *= 2
        amplitude *= persistence
      }

      let detailValue = 0
      let detailAmplitude = amplitude
      let detailFreq = freq
      for (let o = 0; o < detailOctaves; o += 1) {
        detailValue +=
          hashNoise(sampleX * detailFreq, sampleY * detailFreq, seed + (coarseOctaves + o) * 1013) *
          detailAmplitude
        detailFreq *= 2
        detailAmplitude *= persistence
      }

      const slopeProxy = Math.abs(
        hashNoise(sampleX * frequency * 0.5, sampleY * frequency * 0.5, seed + 7201) - 0.5,
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

