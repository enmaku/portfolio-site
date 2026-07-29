/**
 * Resolve one resource conquest over a contested settlement.
 * Domain: world-builder/CONTEXT.md — Conquest; ADR 0020.
 */

import {
  HISTORY_KIND_MAJOR_WAR_END,
  HISTORY_KIND_MAJOR_WAR_START,
} from '../historyKinds.js'
import { applyWarExhaustion } from './applyWarExhaustion.js'
import { openBelligerentTradeBlock } from './belligerentTradeBlocks.js'
import { defenderAdvantageMultiplier } from './computeMartialCapacity.js'
import { projectMight, sumFactionProjectedMight } from './projectMight.js'
import { resolveContestedSettlement } from './resolveContestedSettlement.js'
import { transferSettlementAsVassal } from './transferSettlementAsVassal.js'
import { taxedMemberSettlementIds } from '../softPower/taxedMembers.js'

/**
 * @param {{
 *   slice: object,
 *   attackerFactionId: string,
 *   contestedSettlementId: string,
 *   capacityBySettlementId: Record<string, number>,
 *   candidateEdges: object[],
 *   strategicReachHaulFractions: object,
 * }} params
 * @returns {{
 *   slice: object,
 *   events: object[],
 *   fought: boolean,
 *   winner: 'attacker' | 'defender' | 'unreachable',
 *   participatingFactionIds: string[],
 * }}
 */
export function applyConquestResolution(params) {
  const events = []
  let next = params.slice
  const stake = (next.settlements ?? []).find((s) => s.id === params.contestedSettlementId)
  if (!stake || stake.status !== 'living') {
    return {
      slice: next,
      events,
      fought: false,
      winner: 'unreachable',
      participatingFactionIds: [],
    }
  }

  const attacker = (next.factions ?? []).find(
    (f) => f.id === params.attackerFactionId && f.status === 'active',
  )
  if (!attacker) {
    return {
      slice: next,
      events,
      fought: false,
      winner: 'unreachable',
      participatingFactionIds: [],
    }
  }

  const defenderFactionId = stake.factionId ?? null
  const defenderFaction = defenderFactionId
    ? (next.factions ?? []).find((f) => f.id === defenderFactionId && f.status === 'active')
    : null

  const attackerMemberIds = taxedMemberSettlementIds({
    factionId: params.attackerFactionId,
    settlements: next.settlements,
    settlementIds: attacker.settlementIds,
  })
  const aloneDefense =
    !defenderFaction ||
    stake.isTradePartner === true ||
    !stake.factionId
  const defenderMemberIds = aloneDefense
    ? [params.contestedSettlementId]
    : taxedMemberSettlementIds({
        factionId: defenderFactionId,
        settlements: next.settlements,
        settlementIds: defenderFaction.settlementIds,
      })

  /** @type {Record<string, number>} */
  const contributions = {}
  for (const id of [...new Set([...attackerMemberIds, ...defenderMemberIds])]) {
    const might = projectMight({
      contributorCapacity: params.capacityBySettlementId[id] ?? 0,
      fromSettlementId: id,
      contestedSettlementId: params.contestedSettlementId,
      candidateEdges: params.candidateEdges,
      strategicReachHaulFractions: params.strategicReachHaulFractions,
    })
    if (might > 0) contributions[id] = might
  }

  const attackerProjectedMight = sumFactionProjectedMight({
    memberSettlementIds: attackerMemberIds,
    capacityBySettlementId: params.capacityBySettlementId,
    contestedSettlementId: params.contestedSettlementId,
    candidateEdges: params.candidateEdges,
    strategicReachHaulFractions: params.strategicReachHaulFractions,
  })

  const defenderProjectedMight = sumFactionProjectedMight({
    memberSettlementIds: defenderMemberIds,
    capacityBySettlementId: params.capacityBySettlementId,
    contestedSettlementId: params.contestedSettlementId,
    candidateEdges: params.candidateEdges,
    strategicReachHaulFractions: params.strategicReachHaulFractions,
  })

  const stakeDefenderProjectedMight = projectMight({
    contributorCapacity: params.capacityBySettlementId[params.contestedSettlementId] ?? 0,
    fromSettlementId: params.contestedSettlementId,
    contestedSettlementId: params.contestedSettlementId,
    candidateEdges: params.candidateEdges,
    strategicReachHaulFractions: params.strategicReachHaulFractions,
  })

  const isFactionCapital =
    Boolean(defenderFaction) && defenderFaction.capitalSettlementId === params.contestedSettlementId
  const defenderAdvantageOnStake = defenderAdvantageMultiplier({
    tier: stake.tier,
    isFactionCapital,
  })

  const startEvent = {
    kind: HISTORY_KIND_MAJOR_WAR_START,
    epoch: next.epoch,
    attackerFactionId: params.attackerFactionId,
    defenderFactionId,
    contestedSettlementId: params.contestedSettlementId,
    cause: 'resource',
  }
  events.push(startEvent)
  next = { ...next, historyLog: [...(next.historyLog ?? []), startEvent] }

  const winner = resolveContestedSettlement({
    attackerProjectedMight,
    defenderProjectedMight,
    stakeDefenderProjectedMight,
    defenderAdvantageOnStake,
  })

  const participatingFactionIds = [params.attackerFactionId]
  if (defenderFactionId) participatingFactionIds.push(defenderFactionId)

  if (winner === 'unreachable') {
    const endEvent = {
      kind: HISTORY_KIND_MAJOR_WAR_END,
      epoch: next.epoch,
      attackerFactionId: params.attackerFactionId,
      defenderFactionId,
      contestedSettlementId: params.contestedSettlementId,
      winner: 'defender',
      fought: false,
    }
    events.push(endEvent)
    next = { ...next, historyLog: [...(next.historyLog ?? []), endEvent] }
    return { slice: next, events, fought: false, winner, participatingFactionIds }
  }

  const exhausted = applyWarExhaustion({
    slice: next,
    contributionsBySettlementId: contributions,
    contestedSettlementId: params.contestedSettlementId,
    epoch: next.epoch,
    fought: true,
  })
  next = exhausted.slice

  if (winner === 'attacker') {
    next = transferSettlementAsVassal({
      slice: next,
      settlementId: params.contestedSettlementId,
      winnerFactionId: params.attackerFactionId,
      conqueredEpoch: next.epoch,
    })
    next = repairLoserCapitalAfterPinLoss({
      slice: next,
      lostSettlementId: params.contestedSettlementId,
      priorFactionId: defenderFactionId,
    })
  }

  if (defenderFactionId) {
    next = openBelligerentTradeBlock({
      slice: next,
      aFactionId: params.attackerFactionId,
      bFactionId: defenderFactionId,
      epoch: next.epoch,
    })
  }

  const endEvent = {
    kind: HISTORY_KIND_MAJOR_WAR_END,
    epoch: next.epoch,
    attackerFactionId: params.attackerFactionId,
    defenderFactionId,
    contestedSettlementId: params.contestedSettlementId,
    winner,
    fought: true,
  }
  events.push(endEvent)
  next = { ...next, historyLog: [...(next.historyLog ?? []), endEvent] }

  return {
    slice: next,
    events,
    fought: true,
    winner,
    participatingFactionIds,
  }
}

/**
 * When a capital pin is conquered, pick a new capital among remaining living members.
 *
 * @param {{
 *   slice: object,
 *   lostSettlementId: string,
 *   priorFactionId: string | null,
 * }} params
 * @returns {object}
 */
function repairLoserCapitalAfterPinLoss(params) {
  if (!params.priorFactionId) return params.slice
  const factions = (params.slice.factions ?? []).map((faction) => {
    if (faction.id !== params.priorFactionId || faction.status !== 'active') return faction
    if (faction.capitalSettlementId !== params.lostSettlementId) return faction
    const livingIds = faction.settlementIds.filter((id) => {
      const settlement = (params.slice.settlements ?? []).find((row) => row.id === id)
      return (
        settlement &&
        settlement.status === 'living' &&
        (settlement.population ?? 0) > 0 &&
        settlement.factionId === faction.id
      )
    })
    if (livingIds.length === 0) return faction
    const newCapitalId = livingIds.slice().sort((a, b) => {
      const popA = params.slice.settlements.find((s) => s.id === a)?.population ?? 0
      const popB = params.slice.settlements.find((s) => s.id === b)?.population ?? 0
      if (popB !== popA) return popB - popA
      return a.localeCompare(b)
    })[0]
    return { ...faction, capitalSettlementId: newCapitalId }
  })

  const settlements = (params.slice.settlements ?? []).map((settlement) => {
    if (settlement.factionId !== params.priorFactionId) return settlement
    const faction = factions.find((f) => f.id === params.priorFactionId)
    if (!faction) return settlement
    if (settlement.id === faction.capitalSettlementId) {
      return { ...settlement, vassalLiegeSettlementId: null }
    }
    if (
      settlement.vassalLiegeSettlementId === params.lostSettlementId ||
      !settlement.vassalLiegeSettlementId
    ) {
      return { ...settlement, vassalLiegeSettlementId: faction.capitalSettlementId }
    }
    return settlement
  })

  return { ...params.slice, factions, settlements }
}
