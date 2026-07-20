import {
  createFoundingLandingValidityContext,
  isValidFoundingLandingCellInContext,
} from '../isValidFoundingLandingCell.js'

/** @typedef {'none' | 'port' | 'inland_sail'} SettlementMaritimeRole */

/**
 * @param {import('../../types.js').WorldDocument} doc
 * @param {{ x: number, y: number }} pin
 * @returns {SettlementMaritimeRole}
 */
export function classifySettlementMaritimeRole(doc, pin) {
  const ctx = createFoundingLandingValidityContext(doc)
  if (!ctx) {
    return 'none'
  }

  if (isValidFoundingLandingCellInContext(ctx, pin.x, pin.y)) {
    return 'port'
  }

  const sailIndex = resolveNearbyMaskCellIndex(ctx.sailMask, ctx.width, ctx.height, pin.x, pin.y)
  if (sailIndex === null) {
    return 'none'
  }

  const waterIndex = resolveNearbyMaskCellIndex(
    ctx.waterUnion,
    ctx.width,
    ctx.height,
    pin.x,
    pin.y,
  )
  if (waterIndex !== null && ctx.waterReachesOcean[waterIndex] === 1) {
    return 'port'
  }

  return 'inland_sail'
}

/**
 * @param {SettlementMaritimeRole} role
 * @returns {boolean}
 */
export function isPortSettlement(role) {
  return role === 'port'
}

/**
 * @param {Uint8Array} mask
 * @param {number} width
 * @param {number} height
 * @param {number} x
 * @param {number} y
 * @returns {number | null}
 */
function resolveNearbyMaskCellIndex(mask, width, height, x, y) {
  const index = y * width + x
  if (mask[index] === 1) {
    return index
  }

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const neighborIndex = ny * width + nx
      if (mask[neighborIndex] === 1) {
        return neighborIndex
      }
    }
  }

  return null
}
