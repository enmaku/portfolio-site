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

  // Comfort/prosperity never borrow. Open-debt freezes them for the whole epoch
  // even if staple exports later create a surplus mid-pass.
  if (resourceKind === 'comfort' || resourceKind === 'prosperity') {
    if (openingNetOwed > 0) {
      return 0
    }
    return Math.max(0, -netOwed)
  }

  const overLimit = state.overLimitAtOpen?.get(importerId) === true
  if (overLimit) {
    return Math.max(0, openingNetOwed - netOwed)
  }
  return Math.max(0, (state.creditLimit?.get(importerId) ?? 0) - netOwed)
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
