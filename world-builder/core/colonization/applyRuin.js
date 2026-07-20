import {
  cancelObligationsForSettlement,
  recomputeBalances,
} from '../economy/ledgers/bilateralObligations.js'

/**
 * Living settlements at or below this headcount abandon: remaining people leave the map
 * and the pin becomes a ruin.
 */
export const SETTLEMENT_ABANDONMENT_POPULATION_FLOOR = 10

/**
 * Convert failed living settlements to ruins and release their claims.
 * Failure is headcount at or below {@link SETTLEMENT_ABANDONMENT_POPULATION_FLOOR}
 * (remaining people leave the map). Incident bilateral obligations are cancelled and
 * external credit is zeroed for each newly ruined settlement.
 *
 * @param {{
 *   settlements: object[],
 *   primaryClaim: Record<string, Array<{ x: number, y: number }>>,
 *   historyLog: object[],
 *   epoch: number,
 *   tradeAccounts?: import('../economy/ledgers/bilateralObligations.js').TradeAccountsState,
 *   externalTradeAccounts?: Record<string, number>,
 * }} state
 * @returns {{
 *   settlements: object[],
 *   primaryClaim: Record<string, Array<{ x: number, y: number }>>,
 *   historyLog: object[],
 *   events: object[],
 *   tradeAccounts: import('../economy/ledgers/bilateralObligations.js').TradeAccountsState,
 *   externalTradeAccounts: Record<string, number>,
 * }}
 */
export function applyRuinTransitions(state) {
  const primaryClaim = { ...state.primaryClaim }
  /** @type {object[]} */
  const events = []
  /** @type {object[]} */
  const historyLog = [...state.historyLog]
  /** @type {object[]} */
  const settlements = []

  let tradeAccounts = state.tradeAccounts
    ? {
        obligations: state.tradeAccounts.obligations.map((row) => ({ ...row })),
        balancesBySettlementId: { ...state.tradeAccounts.balancesBySettlementId },
      }
    : { obligations: [], balancesBySettlementId: {} }
  const externalTradeAccounts = { ...(state.externalTradeAccounts ?? {}) }

  for (const settlement of state.settlements) {
    if (settlement.status === 'ruin') {
      settlements.push({ ...settlement })
      continue
    }

    const headcount = Math.max(0, Math.floor(Number(settlement.population) || 0))
    if (headcount > SETTLEMENT_ABANDONMENT_POPULATION_FLOOR) {
      settlements.push({ ...settlement })
      continue
    }

    delete primaryClaim[settlement.id]
    tradeAccounts = cancelObligationsForSettlement(tradeAccounts, settlement.id)
    delete externalTradeAccounts[settlement.id]

    const abandoned = {
      ...settlement,
      population: 0,
      tier: null,
      status: 'ruin',
    }
    settlements.push(abandoned)

    historyLog.push({
      kind: 'settlement_abandoned',
      epoch: state.epoch,
      settlementId: settlement.id,
    })
    events.push({
      kind: 'settlement_abandoned',
      settlementId: settlement.id,
    })
  }

  recomputeBalances(tradeAccounts)

  return { settlements, primaryClaim, historyLog, events, tradeAccounts, externalTradeAccounts }
}
