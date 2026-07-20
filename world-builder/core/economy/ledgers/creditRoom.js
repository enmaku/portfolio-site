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
  const overLimit = state.overLimitAtOpen?.get(importerId) === true
  if (overLimit) {
    if (resourceKind === 'comfort' || resourceKind === 'prosperity') {
      return 0
    }
    const opening = state.openingNetOwed?.get(importerId) ?? 0
    const current = state.netOwed?.get(importerId) ?? 0
    return Math.max(0, opening - current)
  }
  return Math.max(0, (state.creditLimit?.get(importerId) ?? 0) - (state.netOwed?.get(importerId) ?? 0))
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
