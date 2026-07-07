import { buildDryLandTraversableMask } from './buildDryLandTraversableMask.js'
import { isVisitRasterCellVisited } from './bearingStepUtils.js'
import { resolveSailTraversableMask } from './expeditionRouting.js'

/**
 * @param {import('./allocateExpeditionSlots.js').ExpeditionSlotAssignment} assignment
 * @param {{
 *   doc: import('../../types.js').WorldDocument,
 *   visitRaster: Uint8Array,
 * }} context
 * @returns {import('./expeditionConstants.js').ExpeditionMode}
 */
export function resolveExpeditionModeForSender(assignment, context) {
  if (assignment.pool === 'land') {
    return 'land'
  }

  if (assignment.maritimeRole === 'port' && hasUnvisitedOpenOceanFrontier(context)) {
    return 'open_sea'
  }

  return 'inland_sail'
}

/**
 * @param {{
 *   doc: import('../../types.js').WorldDocument,
 *   visitRaster: Uint8Array,
 * }} context
 * @returns {boolean}
 */
function hasUnvisitedOpenOceanFrontier(context) {
  const { doc, visitRaster } = context
  const sailMask = resolveSailTraversableMask(doc)
  const dryLandMask = buildDryLandTraversableMask(doc)
  if (!sailMask) return false

  const { gridWidth, gridHeight } = doc
  for (let y = 0; y < gridHeight; y += 1) {
    for (let x = 0; x < gridWidth; x += 1) {
      const index = y * gridWidth + x
      if (sailMask[index] !== 1) continue
      if (isVisitRasterCellVisited(visitRaster, x, y, gridWidth)) continue
      if (!isNearOcean(x, y, dryLandMask, gridWidth, gridHeight)) continue
      return true
    }
  }
  return false
}

/**
 * @param {number} x
 * @param {number} y
 * @param {Uint8Array} dryLandMask
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {boolean}
 */
function isNearOcean(x, y, dryLandMask, gridWidth, gridHeight) {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue
      if (dryLandMask[ny * gridWidth + nx] !== 1) {
        return true
      }
    }
  }
  return false
}
