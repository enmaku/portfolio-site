/**
 * Realm-wide annual trade clearing wired into the colonization epoch.
 * Clears pairwise + off-map trade when the realm has enough living settlements, and
 * reports the food/salt each settlement effectively holds after trade for the survival
 * triad. Takes a pre-built clearing DTO — callers own colonization-specific inputs
 * (living-settlement filtering, maritime roles, fish production) and build the DTO via
 * `buildRealmTradeClearingInput` before calling in.
 * Domain: world-builder/CONTEXT.md — trade clearing, population ceiling, salt fulfillment.
 */

import { recomputeBalances } from '../ledgers/bilateralObligations.js'
import { realizedOnMapIncomeCpBySettlementId } from '../ledgers/realizedIncome.js'
import { roundMoneyCp } from '../formatMoneyCp.js'
import { buildCandidateTradeGraph } from '../tradeGraph/buildCandidateRoutes.js'
import { runTradeClearing } from './runTradeClearing.js'

/**
 * @typedef {import('../commodityCatalog.js').CommodityId} CommodityId
 * @typedef {import('../ledgers/bilateralObligations.js').TradeAccountsState} TradeAccountsState
 * @typedef {import('../tradeGraph/buildCandidateRoutes.js').TradeRouteEdge} TradeRouteEdge
 */

/** Living-settlement count at which pairwise trade activates. */
export const TRADE_ACTIVATION_MIN_SETTLEMENTS = 2

/**
 * @typedef {Object} RealmTradeClearingInput
 * @property {Array<{ id: string, x: number, y: number, population: number, maritimeRole: string }>} settlements
 *   Living settlements only, with `maritimeRole` already refreshed.
 * @property {Record<string, Record<CommodityId, number>>} production Per-settlement production (fish included).
 * @property {number} gridWidth
 * @property {number} gridHeight
 * @property {Float32Array | null} elevation
 * @property {Uint8Array | null} lakeMask
 * @property {Uint8Array | null} riverCorridorMask
 * @property {Float32Array | null} movementCost
 * @property {import('../tradeGraph/buildCandidateRoutes.js').BuildCandidateTradeGraphParams['roads']} roads
 * @property {number} threeDayHaulDistance
 * @property {number} inlandSailExpeditionRange Multiple of `threeDayHaulDistance`.
 * @property {TradeAccountsState} tradeAccounts Prior realm obligations + balances.
 * @property {Record<string, number>} externalTradeAccounts Prior port off-map credit.
 * @property {Record<string, number>} priorRealizedIncomeCp Prior on-map export+toll income (or empty to derive).
 * @property {{ candidates: TradeRouteEdge[], activeFlows: import('./clearingState.js').TradeFlow[] }} [tradeRouteState]
 *   Prior route state, preserved verbatim when pairwise trade does not activate this epoch.
 * @property {import('./runTradeClearing.js').TradeClearingResult | null} [lastTradeEpochResult]
 */

/**
 * @typedef {Object} RealmTradeResult
 * @property {boolean} active Whether pairwise clearing ran this epoch.
 * @property {Record<string, { foodLb: number, saltLb: number }>} effectiveDeliveredBySettlementId
 * @property {TradeAccountsState} tradeAccounts Netted realm obligations + balances.
 * @property {Record<string, number>} externalTradeAccounts Port off-map credit (≥ 0).
 * @property {Record<string, number>} priorRealizedIncomeCp On-map export+toll income from this clear (or preserved).
 * @property {{ candidates: TradeRouteEdge[], activeFlows: import('./clearingState.js').TradeFlow[] }} tradeRouteState
 * @property {import('./runTradeClearing.js').TradeClearingResult | null} lastTradeEpochResult
 */

/**
 * @param {RealmTradeClearingInput} input
 * @param {{
 *   hooks?: import('./runTradeClearing.js').TradeClearingHooks,
 *   yieldToUi?: () => Promise<void>,
 * }} [options]
 * @returns {Promise<RealmTradeResult>}
 */
export async function clearRealmTrade(input, options = {}) {
  const {
    settlements,
    production,
    gridWidth,
    gridHeight,
    elevation,
    lakeMask,
    riverCorridorMask,
    movementCost,
    roads,
    threeDayHaulDistance,
    inlandSailExpeditionRange,
    tradeAccounts: priorTradeAccounts,
    externalTradeAccounts: priorExternalTradeAccounts,
    priorRealizedIncomeCp: priorRealizedIncomeCpInput,
    tradeRouteState: priorTradeRouteState,
    lastTradeEpochResult: priorTradeEpochResult,
  } = input

  if (settlements.length < TRADE_ACTIVATION_MIN_SETTLEMENTS) {
    return {
      active: false,
      effectiveDeliveredBySettlementId: localDelivered(production),
      tradeAccounts: {
        obligations: (priorTradeAccounts?.obligations ?? []).map((row) => ({ ...row })),
        balancesBySettlementId: { ...(priorTradeAccounts?.balancesBySettlementId ?? {}) },
      },
      externalTradeAccounts: { ...priorExternalTradeAccounts },
      priorRealizedIncomeCp: { ...(priorRealizedIncomeCpInput ?? {}) },
      tradeRouteState: {
        candidates: [...(priorTradeRouteState?.candidates ?? [])],
        activeFlows: [],
      },
      lastTradeEpochResult: priorTradeEpochResult ?? null,
    }
  }

  const graphSettlements = settlements.map((settlement) => ({
    id: settlement.id,
    x: settlement.x,
    y: settlement.y,
    population: settlement.population,
    status: 'living',
    maritimeRole: settlement.maritimeRole ?? 'none',
  }))
  const clearingSettlements = settlements.map((settlement) => ({
    id: settlement.id,
    population: settlement.population,
    maritimeRole: settlement.maritimeRole ?? 'none',
  }))

  const graph = buildCandidateTradeGraph({
    settlements: graphSettlements,
    gridWidth,
    gridHeight,
    threeDayHaulDistance,
    inlandSailExpeditionRange: inlandSailExpeditionRange * threeDayHaulDistance,
    movementCost,
    elevation,
    roads,
    lakeMask,
    riverCorridorMask,
  })
  await options.yieldToUi?.()

  const priorRealizedIncomeCp =
    priorRealizedIncomeCpInput && Object.keys(priorRealizedIncomeCpInput).length > 0
      ? priorRealizedIncomeCpInput
      : realizedOnMapIncomeCpBySettlementId(priorTradeEpochResult?.obligationDeltas)

  const result = await runTradeClearing(
    {
      settlements: clearingSettlements,
      graph,
      production,
      externalAccountsCp: priorExternalTradeAccounts,
      priorTradeAccounts,
      priorRealizedIncomeCp,
    },
    options,
  )
  /** @type {Record<string, number>} */
  const externalTradeAccounts = { ...priorExternalTradeAccounts }
  for (const [id, delta] of Object.entries(result.externalAccountDeltas)) {
    externalTradeAccounts[id] = Math.max(
      0,
      roundMoneyCp((externalTradeAccounts[id] ?? 0) + delta),
    )
  }

  /** @type {TradeAccountsState} */
  const tradeAccounts = {
    obligations: result.nettedObligations.map((row) => ({ ...row })),
    balancesBySettlementId: {},
  }
  recomputeBalances(tradeAccounts)

  return {
    active: true,
    effectiveDeliveredBySettlementId: result.effectiveDelivered,
    tradeAccounts,
    externalTradeAccounts,
    priorRealizedIncomeCp: realizedOnMapIncomeCpBySettlementId(result.obligationDeltas),
    tradeRouteState: { candidates: graph.edges, activeFlows: result.flows },
    lastTradeEpochResult: result,
  }
}

/**
 * Effective food/salt with no pairwise trade: each settlement holds only its own output.
 *
 * @param {Record<string, Record<CommodityId, number>>} production
 * @returns {Record<string, { foodLb: number, saltLb: number }>}
 */
function localDelivered(production) {
  /** @type {Record<string, { foodLb: number, saltLb: number }>} */
  const delivered = {}
  for (const [id, amounts] of Object.entries(production)) {
    delivered[id] = {
      foodLb: (amounts.grain ?? 0) + (amounts.fish ?? 0),
      saltLb: amounts.salt ?? 0,
    }
  }
  return delivered
}
