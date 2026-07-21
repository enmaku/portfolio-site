/**
 * Port-toll income lookup for a single settlement from a clearing result.
 * Domain: world-builder/CONTEXT.md — port toll.
 */

import { realizedPortTollIncomeCpBySettlementId } from './realizedIncome.js'

/**
 * Prefer `portTollIncomeCpBySettlementId` on the result; recover from obligation
 * deltas (+ off-map credits) when the map is missing.
 *
 * @param {{
 *   portTollIncomeCpBySettlementId?: Record<string, number>,
 *   obligationDeltas?: ReadonlyArray<{
 *     toSettlementId?: string,
 *     amountCp?: number,
 *     kind?: string,
 *   }>,
 * } | null | undefined} result
 * @param {string} settlementId
 * @returns {number}
 */
export function portTollIncomeCpForSettlement(result, settlementId) {
  const mapped = result?.portTollIncomeCpBySettlementId?.[settlementId]
  if (typeof mapped === 'number' && Number.isFinite(mapped)) {
    return Math.max(0, mapped)
  }
  const recovered = realizedPortTollIncomeCpBySettlementId(result?.obligationDeltas, null)
  const amount = recovered[settlementId]
  return typeof amount === 'number' && Number.isFinite(amount) ? Math.max(0, amount) : 0
}
