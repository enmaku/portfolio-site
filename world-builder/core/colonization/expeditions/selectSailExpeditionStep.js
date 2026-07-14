import { resolveSailTraversableMask } from './expeditionRouting.js'
import {
  bearingAlignmentDelta,
  neighborCells8,
  stepBearingRadians,
} from './bearingStepUtils.js'

/**
 * @param {{ x: number, y: number }} from
 * @param {{ x: number, y: number }} to
 */
export function sailStepTravelCost(from, to) {
  const diagonal = from.x !== to.x && from.y !== to.y ? Math.SQRT2 : 1
  return 0.6 * diagonal
}

/**
 * @param {number} x
 * @param {number} y
 * @param {Uint8Array} dryLandMask
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @param {number} maxDistance
 */
function isWithinDryLandDistance(x, y, dryLandMask, gridWidth, gridHeight, maxDistance) {
  for (let dy = -maxDistance; dy <= maxDistance; dy += 1) {
    for (let dx = -maxDistance; dx <= maxDistance; dx += 1) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) > maxDistance) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue
      if (dryLandMask[ny * gridWidth + nx] === 1) {
        return true
      }
    }
  }
  return false
}

/**
 * @param {{ x: number, y: number }} current
 * @param {Uint8Array} sailMask
 * @param {Uint8Array} dryLandMask
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {Array<{ x: number, y: number }>}
 */
export function listLegalSailExpeditionSteps(current, sailMask, dryLandMask, gridWidth, gridHeight) {
  return neighborCells8(current, gridWidth, gridHeight).filter((neighbor) => {
    const index = neighbor.y * gridWidth + neighbor.x
    if (sailMask[index] !== 1) return false
    return isWithinDryLandDistance(
      neighbor.x,
      neighbor.y,
      dryLandMask,
      gridWidth,
      gridHeight,
      SAIL_EXPEDITION_MAX_SHORE_DISTANCE,
    )
  })
}

/**
 * @param {{ x: number, y: number }} current
 * @param {number} bearing
 * @param {Uint8Array} sailMask
 * @param {Uint8Array} dryLandMask
 * @param {import('../../types.js').WorldDocument} doc
 * @returns {{ x: number, y: number } | null}
 */
export function selectSailExpeditionStep(current, bearing, sailMask, dryLandMask, doc) {
  const { gridWidth, gridHeight } = doc
  const legal = listLegalSailExpeditionSteps(current, sailMask, dryLandMask, gridWidth, gridHeight)
  if (legal.length === 0) return null

  legal.sort((a, b) => {
    const alignmentA = bearingAlignmentDelta(bearing, stepBearingRadians(current, a))
    const alignmentB = bearingAlignmentDelta(bearing, stepBearingRadians(current, b))
    return alignmentA - alignmentB
  })

  return legal[0]
}

/**
 * @param {import('../../types.js').WorldDocument} doc
 * @param {{ x: number, y: number }} pin
 * @returns {boolean}
 */
export function isSettlementSailReachable(doc, pin) {
  const sailMask = resolveSailTraversableMask(doc)
  if (!sailMask) return false
  const index = pin.y * doc.gridWidth + pin.x
  return sailMask[index] === 1
}

/** Coastal settlements dispatch sail expedition ~60% of the time. */
export const SAIL_EXPEDITION_DISPATCH_PROBABILITY = 0.6

/** Max Chebyshev distance from dry land for a sail expedition step (cells). */
export const SAIL_EXPEDITION_MAX_SHORE_DISTANCE = 6
