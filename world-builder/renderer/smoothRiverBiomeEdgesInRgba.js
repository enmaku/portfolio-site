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
 * Feather hard river biome edges in an RGBA terrain buffer.
 * Smoothing bleeds only onto land; river cells stay full strength, then alpha is crisped.
 * @param {Uint8ClampedArray} rgba
 * @param {Uint8Array} biomes
 * @param {number} width
 * @param {number} height
 */
export function smoothRiverBiomeEdgesInRgba(rgba, biomes, width, height) {
  const cellCount = width * height
  const strength = new Float32Array(cellCount)
  for (let i = 0; i < cellCount; i += 1) {
    strength[i] = biomes[i] === RIVER ? 1 : 0
  }

  const blurred = new Float32Array(cellCount)
  const wideBlurred = new Float32Array(cellCount)
  blurRiverStrength(strength, width, height, blurred)
  blurRiverStrength(blurred, width, height, wideBlurred)

  const baseRgba = new Uint8ClampedArray(rgba)
  const [riverR, riverG, riverB] = biomeColorForId(RIVER)

  for (let i = 0; i < cellCount; i += 1) {
    if (biomes[i] === RIVER || biomes[i] === LAKE) continue

    const alpha = crispRiverEdgeStrength(blurred[i], wideBlurred[i])
    if (alpha <= 0) continue

    const offset = i * 4
    rgba[offset] = Math.round(baseRgba[offset] + (riverR - baseRgba[offset]) * alpha)
    rgba[offset + 1] = Math.round(baseRgba[offset + 1] + (riverG - baseRgba[offset + 1]) * alpha)
    rgba[offset + 2] = Math.round(baseRgba[offset + 2] + (riverB - baseRgba[offset + 2]) * alpha)
    rgba[offset + 3] = 255
  }
}
