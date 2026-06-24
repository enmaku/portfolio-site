import { BIOMES } from '../core/biomeIds.js'
import { biomeColorForId } from './biomePalette.js'

const RIVER = BIOMES.RIVER_CORRIDOR
const LAKE = BIOMES.FRESHWATER_LAKE

/** 3×3 binomial kernel, normalized to sum 1. */
const KERNEL = [
  1, 2, 1,
  2, 4, 2,
  1, 2, 1,
]
const KERNEL_SUM = 16

/** High-pass boost applied after the soft edge blur. */
export const RIVER_EDGE_UNSHARP_AMOUNT = 1.75

/** Narrow smoothstep band on the sharpened alpha — keeps aa but drops mushy halos. */
export const RIVER_EDGE_SMOOTHSTEP_LOW = 0.06
export const RIVER_EDGE_SMOOTHSTEP_HIGH = 0.24

/** Matches topography contour stroke — same dark fringe lakes pick up at shorelines. */
export const WATER_BODY_OUTLINE_RGBA = [20, 16, 12, Math.round(0.42 * 255)]

/** Visible river overlay alpha above this counts as water for outline placement. */
export const RIVER_OUTLINE_ALPHA_THRESHOLD = 0

/** Outline ring on land just outside the river silhouette. */
export const RIVER_OUTLINE_LAND_WIDTH = 1

/** Extra outline depth on the water side — eats into fill so rivers read slightly thinner. */
export const RIVER_OUTLINE_WATER_WIDTH = 1

/**
 * @param {number} edge0
 * @param {number} edge1
 * @param {number} value
 * @returns {number}
 */
export function smoothstep(edge0, edge1, value) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/**
 * Sharpen a soft river mask with a high-pass (unsharp) term, then steepen the transition.
 * @param {number} blurred
 * @param {number} wideBlurred
 * @param {{ unsharpAmount?: number, smoothstepLow?: number, smoothstepHigh?: number }} [options]
 * @returns {number}
 */
export function crispRiverEdgeStrength(
  blurred,
  wideBlurred,
  options = {},
) {
  const {
    unsharpAmount = RIVER_EDGE_UNSHARP_AMOUNT,
    smoothstepLow = RIVER_EDGE_SMOOTHSTEP_LOW,
    smoothstepHigh = RIVER_EDGE_SMOOTHSTEP_HIGH,
  } = options
  const unsharp = blurred + unsharpAmount * (blurred - wideBlurred)
  const clamped = Math.max(0, Math.min(1, unsharp))
  return smoothstep(smoothstepLow, smoothstepHigh, clamped)
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
 * Per-cell river overlay alpha in [0, 1] with crisp feathered banks.
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
 * @param {Float32Array} riverAlpha
 * @param {number} idx
 * @param {number} width
 * @param {number} height
 * @param {number} alphaThreshold
 * @returns {boolean}
 */
function touchesLowerRiverAlpha(riverAlpha, idx, width, height, alphaThreshold) {
  const x = idx % width
  const y = Math.floor(idx / width)
  const neighbors = [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1],
  ]
  for (const [nx, ny] of neighbors) {
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) return true
    if (riverAlpha[ny * width + nx] <= alphaThreshold) return true
  }
  return false
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
 * Land and water outline rings around the feathered river overlay silhouette.
 * Extra width is placed on the water side so fill narrows slightly.
 * @param {Float32Array} riverAlpha
 * @param {number} width
 * @param {number} height
 * @param {{ alphaThreshold?: number, landWidth?: number, waterWidth?: number, biomes?: Uint8Array }} [options]
 * @returns {Uint8Array}
 */
export function computeRiverOutlineMask(
  riverAlpha,
  width,
  height,
  options = {},
) {
  const {
    alphaThreshold = RIVER_OUTLINE_ALPHA_THRESHOLD,
    landWidth = RIVER_OUTLINE_LAND_WIDTH,
    waterWidth = RIVER_OUTLINE_WATER_WIDTH,
    biomes,
  } = options
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
      if (biomes) {
        if (biomes[idx] !== RIVER) continue
        if (!touchesNonRiverBiome(biomes, idx, width, height)) continue
      } else {
        if (riverAlpha[idx] <= alphaThreshold) continue
        if (!touchesLowerRiverAlpha(riverAlpha, idx, width, height, alphaThreshold)) continue
      }
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
        if (biomes) {
          if (biomes[neighborIdx] !== RIVER) continue
        } else if (riverAlpha[neighborIdx] <= alphaThreshold) {
          continue
        }
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
 * Feather hard river biome edges in an RGBA terrain buffer.
 * Smoothing bleeds only onto land; river cells stay full strength, then alpha is crisped.
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
