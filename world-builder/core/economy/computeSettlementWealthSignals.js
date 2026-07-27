/**
 * Realm-relative settlement wealth signals for inspect and wealth overlay paint.
 * Domain: world-builder/CONTEXT.md — wealth overlay, realm balance.
 */

import { combinedSettlementWealthCp } from './ledgers/combinedSettlementWealthCp.js'

/**
 * @typedef {Object} SettlementWealthSignal
 * @property {string} id
 * @property {number} x
 * @property {number} y
 * @property {number} balanceCp Realm mutual-credit balance.
 * @property {number} externalClaimCp Off-map credit (ports).
 * @property {number} netWealthCp Same combined figure as the settlement trade tooltip.
 * @property {number} normalized Realm-relative netWealthCp in [-1, 1]; full |1| is the living extreme this paint.
 */

/**
 * @typedef {Object} EconomyInspectSource
 * @property {Array<{ id: string, x?: number, y?: number }>} [settlements]
 * @property {import('./ledgers/bilateralObligations.js').TradeAccountsState} [tradeAccounts]
 * @property {Record<string, number>} [balancesBySettlementId]
 * @property {Record<string, number>} [externalTradeAccounts]
 * @property {import('./economyEpochSnapshot.js').EconomyEpochSnapshot | null} [lastTradeEpochResult]
 */

/**
 * Live mutual-credit balances for wealth display (not stale clearing snapshot).
 *
 * @param {EconomyInspectSource | null | undefined} source
 * @returns {Record<string, number>}
 */
export function balancesFromEconomyInspectSource(source) {
  return (
    source?.balancesBySettlementId ??
    source?.tradeAccounts?.balancesBySettlementId ??
    {}
  )
}

/**
 * @param {EconomyInspectSource} economyInspectSource
 * @returns {SettlementWealthSignal[]}
 */
export function computeSettlementWealthSignals(economyInspectSource) {
  const settlements = economyInspectSource?.settlements ?? []
  const balancesBySettlementId = balancesFromEconomyInspectSource(economyInspectSource)
  const external = economyInspectSource?.externalTradeAccounts ?? {}

  /** @type {Array<{
   *   id: string,
   *   x: number,
   *   y: number,
   *   balanceCp: number,
   *   externalClaimCp: number,
   *   netWealthCp: number,
   * }>} */
  const drafts = []
  let maxAbsNet = 0
  for (const settlement of settlements) {
    if (!settlement || !Number.isFinite(settlement.x) || !Number.isFinite(settlement.y)) continue
    const balanceCp = balancesBySettlementId[settlement.id] ?? 0
    const externalClaimCp = Math.max(0, Number(external[settlement.id]) || 0)
    const netWealthCp = combinedSettlementWealthCp({
      settlementId: settlement.id,
      balancesBySettlementId,
      externalTradeAccounts: external,
    })
    maxAbsNet = Math.max(maxAbsNet, Math.abs(netWealthCp))
    drafts.push({
      id: settlement.id,
      x: Math.trunc(settlement.x),
      y: Math.trunc(settlement.y),
      balanceCp,
      externalClaimCp,
      netWealthCp,
    })
  }

  const scale = maxAbsNet > 0 ? maxAbsNet : 1

  /** @type {SettlementWealthSignal[]} */
  const signals = []
  for (const draft of drafts) {
    signals.push({
      id: draft.id,
      x: draft.x,
      y: draft.y,
      balanceCp: draft.balanceCp,
      externalClaimCp: draft.externalClaimCp,
      netWealthCp: draft.netWealthCp,
      normalized: draft.netWealthCp / scale,
    })
  }
  return signals
}
