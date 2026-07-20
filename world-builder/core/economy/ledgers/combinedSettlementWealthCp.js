/**
 * Combined settlement wealth: realm mutual-credit + nonnegative external claim.
 * Survival growth gates on combined < 0; attrition on combined ≤ 0 — those policies
 * stay at their call sites.
 * Domain: world-builder/CONTEXT.md — settlement trade account, external trade account,
 * wealth overlay, settlement trade tooltip.
 */

/**
 * @param {{
 *   settlementId: string,
 *   realmBalancesCp?: Record<string, number> | null,
 *   balancesBySettlementId?: Record<string, number> | null,
 *   externalTradeAccounts?: Record<string, number> | null,
 * }} params
 * @returns {number}
 */
export function combinedSettlementWealthCp(params) {
  const realmRaw =
    params.realmBalancesCp?.[params.settlementId] ??
    params.balancesBySettlementId?.[params.settlementId]
  const realmCp = Number(realmRaw) || 0
  const externalCp = Math.max(0, Number(params.externalTradeAccounts?.[params.settlementId]) || 0)
  return realmCp + externalCp
}
