/**
 * Realm-wide annual trade clearing wired into the colonization epoch.
 * Clears pairwise + off-map trade when the realm has enough living settlements, and
 * reports the food/salt each settlement effectively holds after trade for the survival
 * triad. Takes a pre-built clearing DTO — callers own colonization-specific inputs
 * (living-settlement filtering, maritime roles, fish production, candidate graph) and
 * build the DTO via `buildRealmTradeClearingInput` before calling in.
 * Domain: world-builder/CONTEXT.md — trade clearing, population ceiling, salt fulfillment.
 */

import { recomputeBalances } from '../ledgers/bilateralObligations.js'
import { realizedOnMapIncomeCpBySettlementId } from '../ledgers/realizedIncome.js'
import { roundMoneyCp } from '../formatMoneyCp.js'
import { projectEconomyEpochSnapshot } from '../economyEpochSnapshot.js'
import { runTradeClearing } from './runTradeClearing.js'
import { filterCandidateEdgesForBelligerents } from '../../colonization/politics/conflict/belligerentTradeBlocks.js'
import { onMapGoodsBilateralCpByPair } from '../../colonization/politics/softPower/onMapGoodsBilateralCpByPair.js'

/**
 * @typedef {import('../commodityCatalog.js').CommodityId} CommodityId
 * @typedef {import('../ledgers/bilateralObligations.js').TradeAccountsState} TradeAccountsState
 * @typedef {import('../../colonization/tradeGraph/buildCandidateRoutes.js').TradeRouteEdge} TradeRouteEdge
 * @typedef {import('../../colonization/tradeGraph/buildCandidateRoutes.js').CandidateTradeGraph} CandidateTradeGraph
 * @typedef {import('../economyEpochSnapshot.js').EconomyEpochSnapshot} EconomyEpochSnapshot
 */

/** Living-settlement count at which pairwise trade activates. */
export const TRADE_ACTIVATION_MIN_SETTLEMENTS = 2

/**
 * @typedef {Object} RealmTradeClearingInput
 * @property {Array<{ id: string, x: number, y: number, population: number, maritimeRole: string }>} settlements
 *   Living settlements only, with `maritimeRole` already refreshed.
 * @property {Record<string, Record<CommodityId, number>>} production Per-settlement production (fish included).
 * @property {CandidateTradeGraph | null} graph Prebuilt candidate routes (null when trade inactive).
 * @property {TradeAccountsState} tradeAccounts Prior realm obligations + balances.
 * @property {Record<string, number>} externalTradeAccounts Prior port off-map credit.
 * @property {Record<string, number>} priorRealizedIncomeCp Prior on-map export+toll income (or empty).
 * @property {{ candidates: TradeRouteEdge[], activeFlows: import('./clearingState.js').TradeFlow[] }} [tradeRouteState]
 *   Prior route state, preserved verbatim when pairwise trade does not activate this epoch.
 * @property {EconomyEpochSnapshot | null} [lastTradeEpochResult]
 * @property {Record<string, number>} [lastOnMapGoodsBilateralCpByPair]
 * @property {import('../../colonization/politics/conflict/belligerentTradeBlocks.js').BelligerentTradeBlock[]} [belligerentTradeBlocks]
 * @property {Record<string, string | null | undefined>} [factionIdBySettlementId]
 */

/**
 * @typedef {Object} RealmTradeResult
 * @property {boolean} active Whether pairwise clearing ran this epoch.
 * @property {Record<string, { foodLb: number, saltLb: number }>} effectiveDeliveredBySettlementId
 * @property {TradeAccountsState} tradeAccounts Netted realm obligations + balances.
 * @property {Record<string, number>} externalTradeAccounts Port off-map credit (≥ 0).
 * @property {Record<string, number>} priorRealizedIncomeCp On-map export+toll income from this clear (or preserved).
 * @property {{ candidates: TradeRouteEdge[], activeFlows: import('./clearingState.js').TradeFlow[] }} tradeRouteState
 * @property {EconomyEpochSnapshot | null} lastTradeEpochResult
 * @property {Record<string, number>} lastOnMapGoodsBilateralCpByPair On-map goods pair volumes from this clear (or preserved).
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
    graph,
    tradeAccounts: priorTradeAccounts,
    externalTradeAccounts: priorExternalTradeAccounts,
    priorRealizedIncomeCp: priorRealizedIncomeCpInput,
    tradeRouteState: priorTradeRouteState,
    lastTradeEpochResult: priorTradeEpochResult,
    lastOnMapGoodsBilateralCpByPair: priorGoodsBilateral,
    belligerentTradeBlocks,
    factionIdBySettlementId,
  } = input

  if (settlements.length < TRADE_ACTIVATION_MIN_SETTLEMENTS || !graph) {
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
      lastOnMapGoodsBilateralCpByPair: { ...(priorGoodsBilateral ?? {}) },
    }
  }

  const clearingSettlements = settlements.map((settlement) => ({
    id: settlement.id,
    population: settlement.population,
    maritimeRole: settlement.maritimeRole ?? 'none',
  }))

  const priorRealizedIncomeCp = { ...(priorRealizedIncomeCpInput ?? {}) }

  const clearingEdges = filterCandidateEdgesForBelligerents({
    edges: graph.edges,
    blocks: belligerentTradeBlocks,
    factionIdBySettlementId: factionIdBySettlementId ?? {},
  })
  const clearingGraph = { edges: clearingEdges }

  const result = await runTradeClearing(
    {
      settlements: clearingSettlements,
      graph: clearingGraph,
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
    lastTradeEpochResult: projectEconomyEpochSnapshot(result),
    lastOnMapGoodsBilateralCpByPair: onMapGoodsBilateralCpByPair(result.obligationDeltas),
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
