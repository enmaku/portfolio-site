import { SEA_LEVEL } from '../biomeIds.js'
import { computeSailMetrics } from './computeSailMetrics.js'
import { deriveSailOverlayMask } from './deriveSailOverlayMask.js'

/**
 * @typedef {import('./computeSailMetrics.js').SailMetrics} SailMetrics
 */

/**
 * @typedef {Object} SailOverlaySnapshot
 * @property {Uint8Array} mask
 * @property {import('./computeSailMetrics.js').SailMetrics} metrics
 */

/**
 * @param {Object} slice
 * @param {import('../types.js').ScalarFields} slice.fields
 * @param {Uint8Array} [slice.lakeMask]
 * @param {Uint8Array} [slice.riverCorridorMask]
 * @param {number} slice.gridWidth
 * @param {number} slice.gridHeight
 * @param {import('../types.js').WorldGenerationOptions} [slice.validationOptions]
 * @returns {SailOverlaySnapshot}
 */
export function resolveSailOverlayFromSlice(slice) {
  const {
    fields,
    lakeMask,
    riverCorridorMask,
    gridWidth,
    gridHeight,
    validationOptions,
  } = slice
  const seaLevel = validationOptions?.seaLevel ?? SEA_LEVEL
  const mask = deriveSailOverlayMask({
    elevation: fields.elevation,
    lakeMask,
    riverCorridorMask,
    gridWidth,
    gridHeight,
    seaLevel,
  })
  const metrics = computeSailMetrics(mask, {
    elevation: fields.elevation,
    lakeMask,
    riverCorridorMask,
    gridWidth,
    gridHeight,
    seaLevel,
  })
  return { mask, metrics }
}

/**
 * @param {Object} slice
 * @returns {import('./computeSailMetrics.js').SailMetrics}
 */
export function resolveSailMetricsFromSlice(slice) {
  return resolveSailOverlayFromSlice(slice).metrics
}

/**
 * @param {Uint8Array} mask
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {import('../types.js').MapFocus}
 */
export function findSailOverlayFocus(mask, gridWidth, gridHeight) {
  let bestIdx = 0
  let bestSize = 0
  const visited = new Uint8Array(mask.length)
  const offsets = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ]

  for (let idx = 0; idx < mask.length; idx += 1) {
    if (!mask[idx] || visited[idx]) continue
    /** @type {number[]} */
    const component = []
    /** @type {number[]} */
    const stack = [idx]
    while (stack.length > 0) {
      const current = stack.pop()
      if (current === undefined || visited[current] || !mask[current]) continue
      visited[current] = 1
      component.push(current)
      const x = current % gridWidth
      const y = Math.floor(current / gridWidth)
      for (const [dx, dy] of offsets) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue
        stack.push(ny * gridWidth + nx)
      }
    }
    if (component.length > bestSize) {
      bestSize = component.length
      bestIdx = component[Math.floor(component.length / 2)]
    }
  }

  return {
    x: bestIdx % gridWidth,
    y: Math.floor(bestIdx / gridWidth),
    zoom: 2,
  }
}
