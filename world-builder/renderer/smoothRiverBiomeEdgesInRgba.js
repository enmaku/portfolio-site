import { BIOMES } from '../core/biomeIds.js'
import { biomeColorForId } from './biomePalette.js'
import {
  crispRiverEdgeStrength,
  RIVER_EDGE_SMOOTHSTEP_HIGH,
  RIVER_EDGE_SMOOTHSTEP_LOW,
  RIVER_EDGE_UNSHARP_AMOUNT,
  RIVER_OUTLINE_ALPHA_THRESHOLD,
  RIVER_OUTLINE_LAND_WIDTH,
  RIVER_OUTLINE_WATER_WIDTH,
  smoothstep,
} from './riverCorridorOverlayRgba.js'

const RIVER = BIOMES.RIVER_CORRIDOR
const LAKE = BIOMES.FRESHWATER_LAKE

/** 3×3 binomial kernel, normalized to sum 1. */
const KERNEL = [
  1, 2, 1,
  2, 4, 2,
  1, 2, 1,
]
const KERNEL_SUM = 16

export {
  RIVER_EDGE_SMOOTHSTEP_HIGH,
  RIVER_EDGE_SMOOTHSTEP_LOW,
  RIVER_EDGE_UNSHARP_AMOUNT,
  crispRiverEdgeStrength,
  smoothstep,
}

/**
 * @param {Float32Array} strength
 * @param {number} width
 * @param {number} height
 * @param {Float32Array} out
 */
function blurRiverStrength(strength, width, height, out) {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0
      let kernelIndex = 0
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx
          const ny = y + dy
          const sample =
            nx >= 0 && ny >= 0 && nx < width && ny < height ? strength[ny * width + nx] : 0
          sum += sample * KERNEL[kernelIndex]
          kernelIndex += 1
        }
      }
      out[y * width + x] = sum / KERNEL_SUM
    }
  }
}

/**
 * Biome-mask river alpha — test-only; production uses corridor overlay in riverCorridorOverlayRgba.
 * @param {Uint8Array} biomes
 * @param {number} width
 * @param {number} height
 * @returns {Float32Array}
 */
export function computeRiverOverlayAlpha(biomes, width, height) {
  const cellCount = width * height
  const strength = new Float32Array(cellCount)
  for (let i = 0; i < cellCount; i += 1) {
    strength[i] = biomes[i] === RIVER ? 1 : 0
  }

  const blurred = new Float32Array(cellCount)
  const wideBlurred = new Float32Array(cellCount)
  blurRiverStrength(strength, width, height, blurred)
  blurRiverStrength(blurred, width, height, wideBlurred)

  const alpha = new Float32Array(cellCount)
  for (let i = 0; i < cellCount; i += 1) {
    if (biomes[i] === RIVER) {
      alpha[i] = 1
    } else if (biomes[i] === LAKE) {
      alpha[i] = 0
    } else {
      alpha[i] = crispRiverEdgeStrength(blurred[i], wideBlurred[i])
    }
  }

  return alpha
}

/**
 * @param {number} idx
 * @param {number} width
 * @param {number} height
 * @returns {boolean}
 */
function touchesOutOfBounds(idx, width, height) {
  const x = idx % width
  const y = Math.floor(idx / width)
  return x === 0 || y === 0 || x === width - 1 || y === height - 1
}

/**
 * @param {Uint8Array} biomes
 * @param {number} idx
 * @param {number} width
 * @param {number} height
 * @returns {boolean}
 */
function touchesNonRiverBiome(biomes, idx, width, height) {
  if (touchesOutOfBounds(idx, width, height)) return true
  const x = idx % width
  const y = Math.floor(idx / width)
  const neighbors = [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1],
  ]
  for (const [nx, ny] of neighbors) {
    const neighborIdx = ny * width + nx
    if (biomes[neighborIdx] !== RIVER) return true
  }
  return false
}

/**
 * Biome-mask outline variant — test-only.
 * @param {Float32Array} riverAlpha
 * @param {Uint8Array} biomes
 * @param {number} width
 * @param {number} height
 * @returns {Uint8Array}
 */
export function computeRiverOutlineMaskFromBiomes(riverAlpha, biomes, width, height) {
  const alphaThreshold = RIVER_OUTLINE_ALPHA_THRESHOLD
  const landWidth = RIVER_OUTLINE_LAND_WIDTH
  const waterWidth = RIVER_OUTLINE_WATER_WIDTH
  const outline = new Uint8Array(riverAlpha.length)
  if (landWidth <= 0 && waterWidth <= 0) {
    return outline
  }

  const cellCount = riverAlpha.length
  const isWater = new Uint8Array(cellCount)
  for (let i = 0; i < cellCount; i += 1) {
    isWater[i] = riverAlpha[i] > alphaThreshold ? 1 : 0
  }

  if (landWidth > 0) {
    const landDistance = new Int16Array(cellCount).fill(-1)
    /** @type {number[]} */
    const queue = []
    for (let idx = 0; idx < cellCount; idx += 1) {
      if (isWater[idx]) continue
      const x = idx % width
      const y = Math.floor(idx / width)
      const neighbors = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        if (!isWater[ny * width + nx]) continue
        landDistance[idx] = 0
        queue.push(idx)
        break
      }
    }

    for (let head = 0; head < queue.length; head += 1) {
      const idx = queue[head]
      const distance = landDistance[idx]
      if (distance >= landWidth - 1) continue

      const x = idx % width
      const y = Math.floor(idx / width)
      const neighbors = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const neighborIdx = ny * width + nx
        if (isWater[neighborIdx] || landDistance[neighborIdx] >= 0) continue
        landDistance[neighborIdx] = distance + 1
        queue.push(neighborIdx)
      }
    }

    for (let idx = 0; idx < cellCount; idx += 1) {
      if (landDistance[idx] >= 0 && landDistance[idx] < landWidth) {
        outline[idx] = 1
      }
    }
  }

  if (waterWidth > 0) {
    const waterDistance = new Int16Array(cellCount).fill(-1)
    /** @type {number[]} */
    const queue = []
    for (let idx = 0; idx < cellCount; idx += 1) {
      if (biomes[idx] !== RIVER) continue
      if (!touchesNonRiverBiome(biomes, idx, width, height)) continue
      waterDistance[idx] = 0
      queue.push(idx)
    }

    for (let head = 0; head < queue.length; head += 1) {
      const idx = queue[head]
      const distance = waterDistance[idx]
      if (distance >= waterWidth - 1) continue

      const x = idx % width
      const y = Math.floor(idx / width)
      const neighbors = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const neighborIdx = ny * width + nx
        if (waterDistance[neighborIdx] >= 0) continue
        if (biomes[neighborIdx] !== RIVER) continue
        waterDistance[neighborIdx] = distance + 1
        queue.push(neighborIdx)
      }
    }

    for (let idx = 0; idx < cellCount; idx += 1) {
      if (waterDistance[idx] >= 0 && waterDistance[idx] < waterWidth) {
        outline[idx] = 1
      }
    }
  }

  return outline
}

/**
 * Legacy biome-based terrain feathering. Test-only — rivers render via hydrology corridor overlay.
 * @param {Uint8ClampedArray} rgba
 * @param {Uint8Array} biomes
 * @param {number} width
 * @param {number} height
 */
export function smoothRiverBiomeEdgesInRgba(rgba, biomes, width, height) {
  const cellCount = width * height
  const alpha = computeRiverOverlayAlpha(biomes, width, height)
  const baseRgba = new Uint8ClampedArray(rgba)
  const [riverR, riverG, riverB] = biomeColorForId(RIVER)

  for (let i = 0; i < cellCount; i += 1) {
    if (biomes[i] === RIVER || biomes[i] === LAKE) continue

    const riverAlpha = alpha[i]
    if (riverAlpha <= 0) continue

    const offset = i * 4
    rgba[offset] = Math.round(baseRgba[offset] + (riverR - baseRgba[offset]) * riverAlpha)
    rgba[offset + 1] = Math.round(baseRgba[offset + 1] + (riverG - baseRgba[offset + 1]) * riverAlpha)
    rgba[offset + 2] = Math.round(baseRgba[offset + 2] + (riverB - baseRgba[offset + 2]) * riverAlpha)
    rgba[offset + 3] = 255
  }
}
