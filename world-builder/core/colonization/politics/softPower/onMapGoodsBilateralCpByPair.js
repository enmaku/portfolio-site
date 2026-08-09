/**
 * Aggregate last-clearing on-map goods obligation volumes by settlement pair.
 * Domain: world-builder/CONTEXT.md — Soft power.
 */

import { roundMoneyCp } from '../../../economy/formatMoneyCp.js'

/**
 * Sorted pair key for two distinct settlement ids.
 *
 * @param {string} a
 * @param {string} b
 * @returns {string}
 */
export function goodsPairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/**
 * Sum absolute goods cp (both directions) per unordered settlement pair.
 * Excludes tolls, tax, off-ledger kinds, non-positive amounts, and self pairs.
 *
 * @param {ReadonlyArray<{
 *   fromSettlementId?: string,
 *   toSettlementId?: string,
 *   amountCp?: number,
 *   kind?: string,
 * } | null | undefined> | null | undefined} obligationDeltas
 * @returns {Record<string, number>}
 */
export function onMapGoodsBilateralCpByPair(obligationDeltas) {
  /** @type {Record<string, number>} */
  const byPair = {}
  if (!Array.isArray(obligationDeltas)) {
    return byPair
  }
  for (const delta of obligationDeltas) {
    if (!delta || delta.kind !== 'goods') continue
    const fromId = delta.fromSettlementId
    const toId = delta.toSettlementId
    if (typeof fromId !== 'string' || typeof toId !== 'string') continue
    if (fromId === toId) continue
    const amount = roundMoneyCp(Number(delta.amountCp))
    if (!(amount > 0)) continue
    const key = goodsPairKey(fromId, toId)
    byPair[key] = roundMoneyCp((byPair[key] ?? 0) + amount)
  }
  return byPair
}
