import { SEA_LEVEL } from '../biomeIds.js'
import { isOceanCell } from '../fields/applyClosedIslandRim.js'
import { deriveSailOverlayMask } from '../sail/deriveSailOverlayMask.js'

/** Grid cells within this Chebyshev radius of a click may snap to a valid landing. */
export const FOUNDING_LANDING_SNAP_RADIUS = 8

/**
 * @typedef {Object} FoundingLandingValidityContext
 * @property {number} width
 * @property {number} height
 * @property {boolean[]} ocean
 * @property {Uint8Array} sailMask
 * @property {Set<string>} mouthKeys
 */

/**
 * @param {import('../types.js').WorldDocument} doc
 * @returns {FoundingLandingValidityContext | null}
 */
export function createFoundingLandingValidityContext(doc) {
  const width = doc.gridWidth
  const height = doc.gridHeight
  const elevation = doc.fields?.elevation
  if (!elevation || !Number.isInteger(width) || !Number.isInteger(height)) {
    return null
  }

  /** @type {Set<string>} */
  const mouthKeys = new Set()
  for (const node of doc.coastalNodes ?? []) {
    if (node.kind === 'mouth' || node.kind === 'anchorage') {
      mouthKeys.add(`${node.x},${node.y}`)
    }
  }

  return {
    width,
    height,
    ocean: isOceanCell(elevation, width, height, SEA_LEVEL),
    sailMask: deriveSailOverlayMask({
      elevation,
      lakeMask: doc.lakeMask,
      riverCorridorMask: doc.riverCorridorMask,
      gridWidth: width,
      gridHeight: height,
      seaLevel: SEA_LEVEL,
    }),
    mouthKeys,
  }
}

/**
 * @param {FoundingLandingValidityContext} ctx
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function isValidFoundingLandingCellInContext(ctx, x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= ctx.width || y >= ctx.height) {
    return false
  }

  const index = y * ctx.width + x
  if (ctx.ocean[index]) {
    return false
  }

  const isMouthOrAnchorage = ctx.mouthKeys.has(`${x},${y}`)
  if (!ctx.sailMask[index] && !isMouthOrAnchorage) {
    return false
  }

  if (isMouthOrAnchorage) {
    return true
  }

  return isAdjacentToOcean(ctx.ocean, x, y, ctx.width, ctx.height)
}

/**
 * @param {import('../types.js').WorldDocument} doc
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function isValidFoundingLandingCell(doc, x, y) {
  const ctx = createFoundingLandingValidityContext(doc)
  if (!ctx) {
    return false
  }
  return isValidFoundingLandingCellInContext(ctx, x, y)
}

/**
 * Snap a click to the nearest valid founding landing within `maxDistance` (Chebyshev).
 * @param {import('../types.js').WorldDocument} doc
 * @param {number} x
 * @param {number} y
 * @param {number} [maxDistance]
 * @returns {{ x: number, y: number } | null}
 */
export function snapFoundingLandingCell(
  doc,
  x,
  y,
  maxDistance = FOUNDING_LANDING_SNAP_RADIUS,
) {
  const ctx = createFoundingLandingValidityContext(doc)
  if (!ctx || !Number.isInteger(x) || !Number.isInteger(y) || maxDistance < 0) {
    return null
  }

  if (isValidFoundingLandingCellInContext(ctx, x, y)) {
    return { x, y }
  }

  /** @type {{ x: number, y: number, distanceSq: number } | null} */
  let best = null
  for (let dy = -maxDistance; dy <= maxDistance; dy += 1) {
    for (let dx = -maxDistance; dx <= maxDistance; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const chebyshev = Math.max(Math.abs(dx), Math.abs(dy))
      if (chebyshev > maxDistance) continue
      const nx = x + dx
      const ny = y + dy
      if (!isValidFoundingLandingCellInContext(ctx, nx, ny)) continue
      const distanceSq = dx * dx + dy * dy
      if (!best || distanceSq < best.distanceSq) {
        best = { x: nx, y: ny, distanceSq }
      }
    }
  }

  return best ? { x: best.x, y: best.y } : null
}

/**
 * @param {boolean[]} ocean
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @returns {boolean}
 */
function isAdjacentToOcean(ocean, x, y, width, height) {
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      if (ocean[ny * width + nx]) {
        return true
      }
    }
  }
  return false
}
