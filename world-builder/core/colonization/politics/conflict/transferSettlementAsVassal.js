/**
 * Pin-level conquest transfer into a victor faction as vassal.
 * Domain: world-builder/CONTEXT.md — Conquest, Contested settlement, Vassal, Quashed rebellion.
 */

import { resolveConquestCause } from './conquestCause.js'

/**
 * Transfer one living settlement into the winner faction as a vassal of the capital.
 * Tags recent conquest for rebellion resentment. Does not absorb the rest of a loser faction.
 *
 * @param {{
 *   slice: object,
 *   settlementId: string,
 *   winnerFactionId: string,
 *   conqueredEpoch: number,
 * }} params
 * @returns {object}
 */
export function transferSettlementAsVassal(params) {
  const winner = (params.slice.factions ?? []).find(
    (faction) => faction.id === params.winnerFactionId && faction.status === 'active',
  )
  if (!winner) return params.slice

  const stake = (params.slice.settlements ?? []).find((s) => s.id === params.settlementId)
  if (!stake || stake.status !== 'living') return params.slice

  const priorFactionId = stake.factionId ?? null
  if (priorFactionId === params.winnerFactionId) return params.slice

  const settlements = (params.slice.settlements ?? []).map((settlement) => {
    if (settlement.id !== params.settlementId) return settlement
    return {
      ...settlement,
      factionId: params.winnerFactionId,
      isTradePartner: false,
      vassalLiegeSettlementId: winner.capitalSettlementId,
    }
  })

  const factions = (params.slice.factions ?? []).map((faction) => {
    if (faction.id === params.winnerFactionId) {
      const settlementIds = faction.settlementIds.includes(params.settlementId)
        ? faction.settlementIds
        : [...faction.settlementIds, params.settlementId]
      return { ...faction, settlementIds }
    }
    if (faction.id === priorFactionId) {
      return {
        ...faction,
        settlementIds: faction.settlementIds.filter((id) => id !== params.settlementId),
      }
    }
    return faction
  })

  const cause = resolveConquestCause(
    params.slice,
    params.settlementId,
    params.winnerFactionId,
    params.conqueredEpoch,
    priorFactionId,
  )

  return {
    ...params.slice,
    settlements,
    factions,
    recentConquestBySettlementId: {
      ...(params.slice.recentConquestBySettlementId ?? {}),
      [params.settlementId]: {
        conqueredEpoch: params.conqueredEpoch,
        priorFactionId,
        cause,
      },
    },
  }
}
