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

  const sailIndex = resolveNearbySailCellIndex(ctx, pin.x, pin.y)
  if (sailIndex === null) {
    return 'none'
  }

  if (ctx.sailReachesOcean[sailIndex] === 1) {
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
 * @param {import('../isValidFoundingLandingCell.js').FoundingLandingValidityContext} ctx
 * @param {number} x
 * @param {number} y
 * @returns {number | null}
 */
function resolveNearbySailCellIndex(ctx, x, y) {
  const index = y * ctx.width + x
  if (ctx.sailMask[index] === 1) {
    return index
  }

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= ctx.width || ny >= ctx.height) continue
      const neighborIndex = ny * ctx.width + nx
      if (ctx.sailMask[neighborIndex] === 1) {
        return neighborIndex
      }
    }
  }

  return null
}
