import { computeHaulShedIsochrone } from './computeHaulShedIsochrone.js'

/**
 * @typedef {{ x: number, y: number }} GridCell
 */

/**
 * @param {{
 *   origin: GridCell,
 *   threeDayHaulDistance: number,
 *   gridWidth: number,
 *   gridHeight: number,
 *   movementCost?: Float32Array | null,
 * }} params
 * @returns {GridCell[]}
 */
export function computeHaulShedReachPreview(params) {
  const { origin, threeDayHaulDistance, gridWidth, gridHeight, movementCost } = params
  return computeHaulShedIsochrone({
    origin,
    budget: threeDayHaulDistance,
    gridWidth,
    gridHeight,
    movementCost,
  })
}
