import { SEA_LEVEL } from '../biomeIds.js'
import { isOceanCell } from '../fields/applyClosedIslandRim.js'
import {
  SAIL_OVERLAY_BLUR_PASSES,
  SAIL_OVERLAY_SMOOTHSTEP_HIGH,
  SAIL_OVERLAY_SMOOTHSTEP_LOW,
  SAIL_OVERLAY_STRENGTH_THRESHOLD,
  SAIL_OVERLAY_UNSHARP_AMOUNT,
} from './sailOverlayConstants.js'

/** 3×3 binomial kernel, normalized to sum 1. */
const KERNEL = [1, 2, 1, 2, 4, 2, 1, 2, 1]
const KERNEL_SUM = 16

/**
 * @param {number} edge0
 * @param {number} edge1
 * @param {number} value
 * @returns {number}
 */
function smoothstep(edge0, edge1, value) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/**
 * @param {number} blurred
 * @param {number} wideBlurred
 * @returns {number}
 */
function sharpenStrength(blurred, wideBlurred) {
  const unsharp = blurred + SAIL_OVERLAY_UNSHARP_AMOUNT * (blurred - wideBlurred)
  const clamped = Math.max(0, Math.min(1, unsharp))
  return smoothstep(SAIL_OVERLAY_SMOOTHSTEP_LOW, SAIL_OVERLAY_SMOOTHSTEP_HIGH, clamped)
}

/**
 * @param {Float32Array} strength
 * @param {number} width
 * @param {number} height
 * @param {Float32Array} out
 */
function blurStrength(strength, width, height, out) {
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
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {Uint8Array} [params.lakeMask]
 * @param {Uint8Array} [params.riverCorridorMask]
 * @param {number} params.gridWidth
 * @param {number} params.gridHeight
 * @param {number} [params.seaLevel]
 * @returns {Uint8Array}
 */
export function deriveSailOverlayMask({
  elevation,
  lakeMask,
  riverCorridorMask,
  gridWidth,
  gridHeight,
  seaLevel = SEA_LEVEL,
}) {
  const cellCount = gridWidth * gridHeight
  const waterUnion = new Uint8Array(cellCount)
  const ocean = isOceanCell(elevation, gridWidth, gridHeight, seaLevel)

  for (let i = 0; i < cellCount; i += 1) {
    if (ocean[i] || lakeMask?.[i] || riverCorridorMask?.[i]) {
      waterUnion[i] = 1
    }
  }

  const strength = new Float32Array(cellCount)
  for (let i = 0; i < cellCount; i += 1) {
    strength[i] = waterUnion[i] ? 1 : 0
  }

  const blurred = new Float32Array(cellCount)
  const wideBlurred = new Float32Array(cellCount)
  blurStrength(strength, gridWidth, gridHeight, blurred)
  for (let pass = 1; pass < SAIL_OVERLAY_BLUR_PASSES; pass += 1) {
    blurStrength(blurred, gridWidth, gridHeight, wideBlurred)
    blurred.set(wideBlurred)
  }
  blurStrength(blurred, gridWidth, gridHeight, wideBlurred)

  const mask = new Uint8Array(cellCount)
  for (let i = 0; i < cellCount; i += 1) {
    const derivedStrength = waterUnion[i]
      ? 1
      : sharpenStrength(blurred[i], wideBlurred[i])
    mask[i] = derivedStrength >= SAIL_OVERLAY_STRENGTH_THRESHOLD ? 1 : 0
  }

  return mask
}
