import {
  bearingAlignmentDelta,
  neighborCells8,
  stepBearingRadians,
} from './bearingStepUtils.js'

/**
 * @param {{ x: number, y: number }} from
 * @param {{ x: number, y: number }} to
 * @returns {number}
 */
export function openSeaStepTravelCost(from, to) {
  const diagonal = from.x !== to.x && from.y !== to.y ? Math.SQRT2 : 1
  return 0.6 * diagonal
}

/**
 * @param {{ x: number, y: number }} current
 * @param {Uint8Array} sailMask
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {Array<{ x: number, y: number }>}
 */
export function listLegalOpenSeaExpeditionSteps(current, sailMask, gridWidth, gridHeight) {
  return neighborCells8(current, gridWidth, gridHeight).filter((neighbor) => {
    const index = neighbor.y * gridWidth + neighbor.x
    return sailMask[index] === 1
  })
}

/**
 * @param {{ x: number, y: number }} current
 * @param {number} bearing
 * @param {Uint8Array} sailMask
 * @param {import('../../types.js').WorldDocument} doc
 * @returns {{ x: number, y: number } | null}
 */
export function selectOpenSeaExpeditionStep(current, bearing, sailMask, doc) {
  const { gridWidth, gridHeight } = doc
  const legal = listLegalOpenSeaExpeditionSteps(current, sailMask, gridWidth, gridHeight)
  if (legal.length === 0) return null

  legal.sort((a, b) => {
    const alignmentA = bearingAlignmentDelta(bearing, stepBearingRadians(current, a))
    const alignmentB = bearingAlignmentDelta(bearing, stepBearingRadians(current, b))
    return alignmentA - alignmentB
  })

  return legal[0]
}
