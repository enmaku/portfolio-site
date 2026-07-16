/**
 * Residual off-map trade against the unseen world.
 * Domain: world-builder/CONTEXT.md — off-map trade, off-map shipping cost.
 */

/**
 * @param {{
 *   referencePriceCp: number,
 *   offMapShippingCost: number,
 *   direction: 'import' | 'export',
 * }} params
 * @returns {number}
 */
export function offMapUnitPriceCp(params) {
  const multiplier = Math.max(1, params.offMapShippingCost)
  if (params.direction === 'import') {
    return params.referencePriceCp * multiplier
  }
  return params.referencePriceCp / multiplier
}

/**
 * Placeholder residual — full off-map clearing lands with #431.
 *
 * @returns {{ flows: never[], externalAccountDeltas: Record<string, number> }}
 */
export function runOffMapResidual() {
  return { flows: [], externalAccountDeltas: {} }
}
