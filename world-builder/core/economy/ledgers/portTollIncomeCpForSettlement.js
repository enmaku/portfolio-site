/**
 * Port-toll income lookup for a single settlement from a clearing result.
 * Domain: world-builder/CONTEXT.md — port toll.
 */

/**
 * Read `portTollIncomeCpBySettlementId` only. A missing map is explicit 0 — do not
 * reconstruct from obligation deltas (off-map tolls never appear there).
 *
 * @param {{
 *   portTollIncomeCpBySettlementId?: Record<string, number>,
 * } | null | undefined} result
 * @param {string} settlementId
 * @returns {number}
 */
export function portTollIncomeCpForSettlement(result, settlementId) {
  const mapped = result?.portTollIncomeCpBySettlementId?.[settlementId]
  if (typeof mapped === 'number' && Number.isFinite(mapped)) {
    return Math.max(0, mapped)
  }
  return 0
}
