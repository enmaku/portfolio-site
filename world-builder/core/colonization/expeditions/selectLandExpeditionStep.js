import { DEFAULT_ROAD_MOVEMENT_MULTIPLIER } from '../roads/roadNetwork.js'
import {
  bearingAlignmentDelta,
  neighborCells8,
  isVisitRasterCellVisited,
  stepBearingRadians,
} from './bearingStepUtils.js'

/**
 * @typedef {Object} LandStepContext
 * @property {import('../../types.js').WorldDocument} doc
 * @property {Uint8Array} dryLandMask
 * @property {Uint8Array} visitRaster
 * @property {Uint8Array | null} [roadCellMask]
 * @property {number} [roadMultiplier]
 */

/**
 * @param {import('../../types.js').WorldDocument} doc
 * @param {number} cellIndex
 * @param {Uint8Array | null} roadCellMask
 * @param {number} roadMultiplier
 */
function stepTravelCost(doc, cellIndex, roadCellMask, roadMultiplier) {
  const movementCost = doc.movementCost
  let base = 1
  if (movementCost && Number.isFinite(movementCost[cellIndex]) && movementCost[cellIndex] > 0) {
    base = movementCost[cellIndex]
  }
  if (roadCellMask?.[cellIndex] === 1) {
    return base * roadMultiplier
  }
  return base
}

/**
 * @param {import('../../types.js').WorldDocument} doc
 * @param {{ x: number, y: number }} from
 * @param {{ x: number, y: number }} to
 * @param {Uint8Array | null} roadCellMask
 * @param {number} roadMultiplier
 */
export function landStepTravelCost(doc, from, to, roadCellMask, roadMultiplier) {
  const index = to.y * doc.gridWidth + to.x
  const step = stepTravelCost(doc, index, roadCellMask, roadMultiplier)
  const diagonal = from.x !== to.x && from.y !== to.y ? Math.SQRT2 : 1
  return step * diagonal
}

/**
 * @param {{ x: number, y: number }} current
 * @param {number} bearing
 * @param {LandStepContext} context
 * @returns {{ x: number, y: number } | null}
 */
export function selectLandExpeditionStep(current, bearing, context) {
  const { doc, dryLandMask, visitRaster, roadCellMask = null, roadMultiplier = DEFAULT_ROAD_MOVEMENT_MULTIPLIER } =
    context
  const { gridWidth, gridHeight } = doc
  const elevation = doc.fields?.elevation
  const currentIndex = current.y * gridWidth + current.x
  const currentElevation = elevation?.[currentIndex] ?? 0.5

  /** @type {Array<{ cell: { x: number, y: number }, alignment: number, cost: number, visited: number, climb: number }>} */
  const candidates = []

  for (const neighbor of neighborCells8(current, gridWidth, gridHeight)) {
    const index = neighbor.y * gridWidth + neighbor.x
    if (dryLandMask[index] !== 1) continue
    const alignment = bearingAlignmentDelta(bearing, stepBearingRadians(current, neighbor))
    const cost = landStepTravelCost(doc, current, neighbor, roadCellMask, roadMultiplier)
    const visited = isVisitRasterCellVisited(visitRaster, neighbor.x, neighbor.y, gridWidth)
      ? 1
      : 0
    const neighborElevation = elevation?.[index] ?? 0.5
    const climb = Math.max(0, neighborElevation - currentElevation)
    candidates.push({ cell: neighbor, alignment, cost, visited, climb })
  }

  if (candidates.length === 0) {
    return null
  }

  candidates.sort((a, b) => {
    if (a.alignment !== b.alignment) return a.alignment - b.alignment
    if (a.cost !== b.cost) return a.cost - b.cost
    return a.climb - b.climb
  })

  const bestAlignment = candidates[0].alignment
  const aligned = candidates.filter((entry) => entry.alignment <= bestAlignment + 1e-6)
  const minClimbAmongAligned = Math.min(...aligned.map((entry) => entry.climb))
  const lowClimbAligned = aligned.filter(
    (entry) => entry.climb <= minClimbAmongAligned + 0.05,
  )
  lowClimbAligned.sort((a, b) => {
    if (a.visited !== b.visited) return a.visited - b.visited
    if (a.cost !== b.cost) return a.cost - b.cost
    return a.climb - b.climb
  })

  return lowClimbAligned[0]?.cell ?? candidates[0].cell
}

/**
 * @param {{ x: number, y: number }} current
 * @param {LandStepContext} context
 * @returns {Array<{ x: number, y: number }>}
 */
export function listLegalLandExpeditionSteps(current, context) {
  const { doc, dryLandMask } = context
  const { gridWidth, gridHeight } = doc
  return neighborCells8(current, gridWidth, gridHeight).filter((neighbor) => {
    const index = neighbor.y * gridWidth + neighbor.x
    return dryLandMask[index] === 1
  })
}
