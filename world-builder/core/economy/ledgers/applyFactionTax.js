/**
 * Faction tax levy: non-capital members → capital after trade clearing.
 * Domain: world-builder/CONTEXT.md — faction tax.
 */

import { FACTION_TAX_RATE } from '../tradeClearing/tradeConstants.js'
import { applyObligation, createEmptyTradeAccounts } from './bilateralObligations.js'

/**
 * @typedef {import('./bilateralObligations.js').TradeAccountsState} TradeAccountsState
 */

/**
 * @param {{
 *   id?: string,
 *   status?: string,
 *   population?: number,
 *   factionId?: string | null,
 * } | null | undefined} settlement
 * @returns {boolean}
 */
function isLivingSettlement(settlement) {
  if (!settlement || typeof settlement.id !== 'string') return false
  if (settlement.status === 'ruin') return false
  if (settlement.population !== undefined && !(settlement.population > 0)) return false
  return true
}

/**
 * Assess and book faction tax. Mutates a copy of trade accounts; does not touch
 * Want / history / membership.
 *
 * @param {{
 *   settlements?: Array<{
 *     id?: string,
 *     status?: string,
 *     population?: number,
 *     factionId?: string | null,
 *   }>,
 *   factions?: Array<{
 *     id?: string,
 *     capitalSettlementId?: string,
 *     status?: string,
 *   }>,
 *   tradeAccounts?: TradeAccountsState | null,
 *   taxAssessmentIncomeCp?: Record<string, number> | null,
 * }} input
 * @returns {{
 *   tradeAccounts: TradeAccountsState,
 *   factionTaxNetCpBySettlementId: Record<string, number>,
 *   taxIncomeCpBySettlementId: Record<string, number>,
 * }}
 */
export function applyFactionTax(input) {
  const settlements = Array.isArray(input.settlements) ? input.settlements : []
  const factions = Array.isArray(input.factions) ? input.factions : []
  const taxAssessmentIncomeCp =
    input.taxAssessmentIncomeCp && typeof input.taxAssessmentIncomeCp === 'object'
      ? input.taxAssessmentIncomeCp
      : {}

  /** @type {TradeAccountsState} */
  let tradeAccounts = input.tradeAccounts
    ? {
        obligations: (input.tradeAccounts.obligations ?? []).map((row) => ({ ...row })),
        balancesBySettlementId: { ...(input.tradeAccounts.balancesBySettlementId ?? {}) },
      }
    : createEmptyTradeAccounts()

  /** @type {Record<string, number>} */
  const paidCpBySettlementId = {}
  /** @type {Record<string, number>} */
  const taxIncomeCpBySettlementId = {}

  for (const faction of factions) {
    if (!faction || faction.status === 'extinct') continue
    if (typeof faction.id !== 'string' || typeof faction.capitalSettlementId !== 'string') {
      continue
    }
    const capitalId = faction.capitalSettlementId
    const capital = settlements.find((s) => s && s.id === capitalId)
    if (!isLivingSettlement(capital) || capital.factionId !== faction.id) continue

    for (const settlement of settlements) {
      if (!isLivingSettlement(settlement)) continue
      if (settlement.factionId !== faction.id) continue
      if (settlement.id === capitalId) continue

      const income = Math.max(0, Number(taxAssessmentIncomeCp[settlement.id]) || 0)
      const amountCp = Math.floor(income * FACTION_TAX_RATE)
      if (!(amountCp > 0)) continue

      tradeAccounts = applyObligation(tradeAccounts, {
        fromSettlementId: settlement.id,
        toSettlementId: capitalId,
        amountCp,
      })
      paidCpBySettlementId[settlement.id] =
        (paidCpBySettlementId[settlement.id] ?? 0) + amountCp
      taxIncomeCpBySettlementId[capitalId] =
        (taxIncomeCpBySettlementId[capitalId] ?? 0) + amountCp
    }
  }

  /** @type {Record<string, number>} */
  const factionTaxNetCpBySettlementId = {}
  for (const settlement of settlements) {
    if (!isLivingSettlement(settlement)) continue
    const collected = taxIncomeCpBySettlementId[settlement.id] ?? 0
    const paid = paidCpBySettlementId[settlement.id] ?? 0
    factionTaxNetCpBySettlementId[settlement.id] = collected - paid
  }

  return {
    tradeAccounts,
    factionTaxNetCpBySettlementId,
    taxIncomeCpBySettlementId,
  }
}
