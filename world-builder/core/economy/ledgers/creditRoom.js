/**
 * Per-tier import credit room for mutual-credit clearing.
 * Domain: world-builder/CONTEXT.md — credit limit.
 */

/**
 * @param {{
 *   overLimitAtOpen?: Map<string, boolean>,
 *   openingNetOwed?: Map<string, number>,
 *   netOwed?: Map<string, number>,
 *   creditLimit?: Map<string, number>,
 * }} state
 * @param {string} importerId
 * @param {'survival' | 'comfort' | 'salt' | 'prosperity'} resourceKind
 * @returns {number}
 */
export function creditRoomCpForImport(state, importerId, resourceKind) {
  const netOwed = state.netOwed?.get(importerId) ?? 0
  const openingNetOwed = state.openingNetOwed?.get(importerId) ?? 0
  const creditLimit = state.creditLimit?.get(importerId) ?? 0

  // Debtor at epoch open: comfort/prosperity frozen all epoch. Staple exports may
  // pay debt down or fund survival, but do not reopen luxuries mid-pass.
  if (
    (resourceKind === 'comfort' || resourceKind === 'prosperity') &&
    openingNetOwed > 0
  ) {
    return 0
  }

  const overLimit = state.overLimitAtOpen?.get(importerId) === true
  if (overLimit) {
    // Survival/salt only: spend same-epoch earnings without deepening past open.
    return Math.max(0, openingNetOwed - netOwed)
  }
  return Math.max(0, creditLimit - netOwed)
}

/**
 * @param {import('../commodityCatalog.js').CommodityId} commodityId
 * @returns {'survival' | 'comfort' | 'salt' | 'prosperity'}
 */
export function offMapImportResourceKind(commodityId) {
  if (commodityId === 'salt') return 'salt'
  if (commodityId === 'grain' || commodityId === 'fish') return 'survival'
  return 'prosperity'
}
