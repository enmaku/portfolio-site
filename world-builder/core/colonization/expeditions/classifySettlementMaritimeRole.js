import {
  createFoundingLandingValidityContext,
  isValidFoundingLandingCellInContext,
} from '../isValidFoundingLandingCell.js'
import { resolveSailTraversableMask } from './expeditionRouting.js'

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

  const index = pin.y * ctx.width + pin.x
  const onSail = ctx.sailMask[index] === 1
  const isPortShore = isValidFoundingLandingCellInContext(ctx, pin.x, pin.y)

  if (isPortShore) {
    return 'port'
  }

  if (onSail) {
    return 'inland_sail'
  }

  const sailMask = resolveSailTraversableMask(doc)
  if (!sailMask) {
    return 'none'
  }

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nx = pin.x + dx
      const ny = pin.y + dy
      if (nx < 0 || ny < 0 || nx >= ctx.width || ny >= ctx.height) continue
      if (sailMask[ny * ctx.width + nx] === 1) {
        return 'inland_sail'
      }
    }
  }

  return 'none'
}

/**
 * @param {SettlementMaritimeRole} role
 * @returns {boolean}
 */
export function isPortSettlement(role) {
  return role === 'port'
}
