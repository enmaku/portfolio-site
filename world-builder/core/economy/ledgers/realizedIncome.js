/**
 * Prior-epoch realized on-map income for credit limits.
 * Domain: world-builder/CONTEXT.md — credit limit.
 */

/**
 * Sum cp credited to each settlement as on-map goods/toll creditor.
 * Import spends are ignored; only creditor-side goods and toll deltas count.
 *
 * @param {ReadonlyArray<{
 *   fromSettlementId?: string,
 *   toSettlementId?: string,
 *   amountCp?: number,
 *   kind?: string,
 * }> | null | undefined} obligationDeltas
 * @returns {Record<string, number>}
 */
export function realizedOnMapIncomeCpBySettlementId(obligationDeltas) {
  /** @type {Record<string, number>} */
  const income = {}
  if (!Array.isArray(obligationDeltas)) {
    return income
  }
  for (const delta of obligationDeltas) {
    if (!delta || typeof delta.toSettlementId !== 'string') continue
    if (delta.kind !== 'goods' && delta.kind !== 'toll') continue
    const amount = Number(delta.amountCp)
    if (!(amount > 0)) continue
    income[delta.toSettlementId] = (income[delta.toSettlementId] ?? 0) + amount
  }
  return income
}
