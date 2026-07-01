import { REFERENCE_GRID_SIZE } from './types.js'

/** Minimum spacing between salt or metal nodes at REFERENCE_GRID_SIZE. */
export const REFERENCE_STRATEGIC_RESOURCE_NODE_SPACING = 16

/** Salt land-proximity disk radius at REFERENCE_GRID_SIZE. */
export const REFERENCE_SALT_LAND_PROXIMITY_RADIUS = 10

/** Coastal proximity BFS reach on land at REFERENCE_GRID_SIZE. */
export const REFERENCE_COASTAL_PROXIMITY_MAX_DISTANCE = 10

/**
 * Scale a cell distance authored at REFERENCE_GRID_SIZE to another grid width.
 * @param {number} referenceDistance
 * @param {number} gridSize
 */
export function scaleCellDistanceForGrid(referenceDistance, gridSize) {
  return Math.max(4, Math.round(referenceDistance * (gridSize / REFERENCE_GRID_SIZE)))
}

/**
 * @param {number} gridSize
 */
export function strategicResourceNodeSpacingForGrid(gridSize) {
  return scaleCellDistanceForGrid(REFERENCE_STRATEGIC_RESOURCE_NODE_SPACING, gridSize)
}

/**
 * @param {number} gridSize
 */
export function saltLandProximityRadiusForGrid(gridSize) {
  return scaleCellDistanceForGrid(REFERENCE_SALT_LAND_PROXIMITY_RADIUS, gridSize)
}

/**
 * @param {number} gridSize
 */
export function coastalProximityMaxDistanceForGrid(gridSize) {
  return scaleCellDistanceForGrid(REFERENCE_COASTAL_PROXIMITY_MAX_DISTANCE, gridSize)
}
