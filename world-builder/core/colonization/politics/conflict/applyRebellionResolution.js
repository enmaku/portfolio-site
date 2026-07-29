/**
 * Armed rebellion over a breakaway seat.
 * Domain: world-builder/CONTEXT.md — Rebellion.
 */

import {
  HISTORY_KIND_REBELLION_END,
  HISTORY_KIND_REBELLION_START,
} from '../historyKinds.js'
import {
  MEMBERSHIP_REFRACTORY_EPOCHS,
} from '../politicsConstants.js'
import { allocateTerritoryPaletteIndex, canMintNewFaction } from '../factionCap.js'
import { resolveVassalDefection } from '../resolveVassalDefection.js'
import { applyWarExhaustion } from './applyWarExhaustion.js'
import { openBelligerentTradeBlock } from './belligerentTradeBlocks.js'
import {
  REBELLION_TAX_DRAIN_CP_THRESHOLD,
  RECENT_CONQUEST_RESENTMENT_EPOCHS,
} from './conflictConstants.js'
import { getConflictTuning } from './conflictTuning.js'
import { defenderAdvantageMultiplier } from './computeMartialCapacity.js'
import { projectMight, projectionPathHaulFraction, sumFactionProjectedMight } from './projectMight.js'
import { resolveContestedSettlement } from './resolveContestedSettlement.js'

/**
 * @param {{
 *   slice: object,
 *   capacityBySettlementId: Record<string, number>,
 *   candidateEdges: object[],
 *   strategicReachHaulFractions: object,
 *   busyFactionIds?: Set<string>,
 *   taxDrainCpBySettlementId?: Record<string, number>,
 *   adjacentFactionIdBySettlementId?: Record<string, string | null>,
 *   corridorDependentBySettlementId?: Record<string, boolean>,
 * }} params
 * @returns {{
 *   slice: object,
 *   events: object[],
 *   fought: boolean,
 *   participatingFactionIds: string[],
 * }}
 */
export function applyRebellionResolution(params) {
  const busy = params.busyFactionIds ?? new Set()
  const stake = pickRebellionStake(params)
  if (!stake) {
    return { slice: params.slice, events: [], fought: false, participatingFactionIds: [] }
  }

  const events = []
  let next = params.slice
  const loyalistFactionId = stake.factionId
  const faction = (next.factions ?? []).find(
    (f) => f.id === loyalistFactionId && f.status === 'active',
  )
  if (!faction || faction.capitalSettlementId === stake.id) {
    return { slice: next, events, fought: false, participatingFactionIds: [] }
  }

  const loyalistMemberIds = (faction.settlementIds ?? []).filter((id) => id !== stake.id)
  const startEvent = {
    kind: HISTORY_KIND_REBELLION_START,
    epoch: next.epoch,
    contestedSettlementId: stake.id,
    loyalistFactionId,
    cause: stake.rebellionCause,
  }
  events.push(startEvent)
  next = { ...next, historyLog: [...(next.historyLog ?? []), startEvent] }

  const attackerProjectedMight = sumFactionProjectedMight({
    memberSettlementIds: loyalistMemberIds,
    capacityBySettlementId: params.capacityBySettlementId,
    contestedSettlementId: stake.id,
    candidateEdges: params.candidateEdges,
    strategicReachHaulFractions: params.strategicReachHaulFractions,
  })

  const rebelProjectedMight = projectMight({
    contributorCapacity: params.capacityBySettlementId[stake.id] ?? 0,
    fromSettlementId: stake.id,
    contestedSettlementId: stake.id,
    candidateEdges: params.candidateEdges,
    strategicReachHaulFractions: params.strategicReachHaulFractions,
  })

  const defenderAdvantageOnStake = defenderAdvantageMultiplier({
    tier: stake.tier,
    isFactionCapital: false,
  })

  /** @type {Record<string, number>} */
  const contributions = {}
  for (const id of [...loyalistMemberIds, stake.id]) {
    const might = projectMight({
      contributorCapacity: params.capacityBySettlementId[id] ?? 0,
      fromSettlementId: id,
      contestedSettlementId: stake.id,
      candidateEdges: params.candidateEdges,
      strategicReachHaulFractions: params.strategicReachHaulFractions,
    })
    if (might > 0) contributions[id] = might
  }

  // Loyalists are the attackers into the breakaway seat's walls.
  const outcome = resolveContestedSettlement({
    attackerProjectedMight,
    defenderProjectedMight: rebelProjectedMight,
    stakeDefenderProjectedMight: rebelProjectedMight,
    defenderAdvantageOnStake,
  })

  const participatingFactionIds = [loyalistFactionId]

  if (outcome === 'unreachable') {
    next = applyRebelVictoryExit({
      slice: next,
      settlementId: stake.id,
      adjacentFactionId: params.adjacentFactionIdBySettlementId?.[stake.id] ?? null,
      corridorDependentOnAdjacent:
        params.corridorDependentBySettlementId?.[stake.id] ?? false,
    })
    const endEvent = {
      kind: HISTORY_KIND_REBELLION_END,
      epoch: next.epoch,
      contestedSettlementId: stake.id,
      loyalistFactionId,
      winner: 'rebel',
      fought: false,
    }
    events.push(endEvent)
    next = { ...next, historyLog: [...(next.historyLog ?? []), endEvent] }
    busy.add(loyalistFactionId)
    return { slice: next, events, fought: false, participatingFactionIds }
  }

  const exhausted = applyWarExhaustion({
    slice: next,
    contributionsBySettlementId: contributions,
    contestedSettlementId: stake.id,
    epoch: next.epoch,
    fought: true,
  })
  next = exhausted.slice

  if (outcome === 'defender') {
    // Rebel holds the walls → rebel victory
    next = applyRebelVictoryExit({
      slice: next,
      settlementId: stake.id,
      adjacentFactionId: params.adjacentFactionIdBySettlementId?.[stake.id] ?? null,
      corridorDependentOnAdjacent:
        params.corridorDependentBySettlementId?.[stake.id] ?? false,
    })
    const breakawayFactionId = next.settlements.find((s) => s.id === stake.id)?.factionId
    if (breakawayFactionId && breakawayFactionId !== loyalistFactionId) {
      next = openBelligerentTradeBlock({
        slice: next,
        aFactionId: loyalistFactionId,
        bFactionId: breakawayFactionId,
        epoch: next.epoch,
      })
      participatingFactionIds.push(breakawayFactionId)
    } else if (!breakawayFactionId) {
      // soft-unaligned: no faction pair block
    }
  } else {
    // Loyalist suppressor wins → stay + refractory
    next = {
      ...next,
      membershipCooldown: [
        ...(next.membershipCooldown ?? []),
        {
          subjectId: stake.id,
          untilEpoch: next.epoch + MEMBERSHIP_REFRACTORY_EPOCHS,
          kind: 'rebellion_failed',
        },
      ],
    }
  }

  const endEvent = {
    kind: HISTORY_KIND_REBELLION_END,
    epoch: next.epoch,
    contestedSettlementId: stake.id,
    loyalistFactionId,
    winner: outcome === 'defender' ? 'rebel' : 'loyalist',
    fought: true,
  }
  events.push(endEvent)
  next = { ...next, historyLog: [...(next.historyLog ?? []), endEvent] }
  for (const id of participatingFactionIds) busy.add(id)

  return {
    slice: next,
    events,
    fought: true,
    participatingFactionIds,
  }
}

/**
 * @param {object} params
 * @returns {(object & { rebellionCause: string }) | null}
 */
function pickRebellionStake(params) {
  const busy = params.busyFactionIds ?? new Set()
  const tax = params.taxDrainCpBySettlementId ?? {}
  const recent = params.slice.recentConquestBySettlementId ?? {}
  /** @type {Array<object & { rebellionCause: string, pressure: number }>} */
  const candidates = []

  for (const settlement of params.slice.settlements ?? []) {
    if (settlement.status !== 'living' || !settlement.factionId) continue
    if (busy.has(settlement.factionId)) continue
    const faction = (params.slice.factions ?? []).find(
      (f) => f.id === settlement.factionId && f.status === 'active',
    )
    if (!faction || faction.capitalSettlementId === settlement.id) continue

    const taxDrain = Math.max(0, -(tax[settlement.id] ?? 0))
    const conquest = recent[settlement.id]
    const resentful =
      conquest &&
      params.slice.epoch - conquest.conqueredEpoch <= RECENT_CONQUEST_RESENTMENT_EPOCHS

    let pressure = 0
    /** @type {string | null} */
    let cause = null
    if (taxDrain >= REBELLION_TAX_DRAIN_CP_THRESHOLD) {
      pressure += taxDrain / 10
      cause = 'tax'
    }
    if (resentful) {
      // Nearby holdings stay under the capital's projected grip; only distant
      // resentful vassals break for conquest-resentment alone (CONTEXT / ADR 0020).
      const capitalId = faction.capitalSettlementId
      const haul =
        capitalId == null
          ? null
          : projectionPathHaulFraction({
              fromSettlementId: capitalId,
              contestedSettlementId: settlement.id,
              candidateEdges: params.candidateEdges,
            })
      const reach = params.strategicReachHaulFractions ?? {}
      const landReach = Math.max(
        1,
        Number(reach.road) || Number(reach.overland) || 1,
      )
      const distantFraction = Math.max(
        0,
        Number(getConflictTuning().rebellionDistantHaulFraction) || 0.4,
      )
      const distantHolding = haul == null || haul >= landReach * distantFraction
      if (distantHolding || cause === 'tax') {
        pressure += 40
        cause = cause ? 'tax_and_conquest' : 'recent_conquest'
      }
    }
    if (!(pressure > 0) || !cause) continue
    candidates.push({ ...settlement, rebellionCause: cause, pressure })
  }

  candidates.sort((a, b) => {
    if (b.pressure !== a.pressure) return b.pressure - a.pressure
    return a.id.localeCompare(b.id)
  })
  return candidates[0] ?? null
}

/**
 * @param {{
 *   slice: object,
 *   settlementId: string,
 *   adjacentFactionId: string | null,
 *   corridorDependentOnAdjacent: boolean,
 * }} params
 */
function applyRebelVictoryExit(params) {
  const settlement = params.slice.settlements.find((s) => s.id === params.settlementId)
  if (!settlement) return params.slice

  const decision = resolveVassalDefection({
    settlement,
    linkedToLiege: false,
    adjacentFactionId: params.adjacentFactionId,
    corridorDependentOnAdjacent: params.corridorDependentOnAdjacent,
  })
  if (!decision) return params.slice

  const priorFactionId = settlement.factionId
  let next = params.slice

  if (decision.action === 'join' && decision.targetFactionId) {
    const target = (next.factions ?? []).find(
      (f) => f.id === decision.targetFactionId && f.status === 'active',
    )
    if (!target) return next
    next = {
      ...next,
      settlements: next.settlements.map((s) =>
        s.id === params.settlementId
          ? {
              ...s,
              factionId: target.id,
              vassalLiegeSettlementId: target.capitalSettlementId,
            }
          : s,
      ),
      factions: next.factions.map((f) => {
        if (f.id === target.id) {
          return {
            ...f,
            settlementIds: f.settlementIds.includes(params.settlementId)
              ? f.settlementIds
              : [...f.settlementIds, params.settlementId],
          }
        }
        if (f.id === priorFactionId) {
          return {
            ...f,
            settlementIds: f.settlementIds.filter((id) => id !== params.settlementId),
          }
        }
        return f
      }),
    }
    return next
  }

  if (decision.action === 'spawn') {
    if (!canMintNewFaction(next.factions)) {
      decision.action = 'soft_unaligned'
    } else {
      const newFactionId = `faction-rebel-${params.settlementId}-${next.epoch}`
      const palette = allocateTerritoryPaletteIndex(next.factions)
      const newFaction = {
        id: newFactionId,
        capitalSettlementId: params.settlementId,
        settlementIds: [params.settlementId],
        status: 'active',
        emergedEpoch: next.epoch,
        ...(palette != null ? { territoryPaletteIndex: palette } : {}),
      }
      next = {
        ...next,
        settlements: next.settlements.map((s) =>
          s.id === params.settlementId
            ? { ...s, factionId: newFactionId, vassalLiegeSettlementId: null }
            : s,
        ),
        factions: [
          ...next.factions.map((f) =>
            f.id === priorFactionId
              ? {
                  ...f,
                  settlementIds: f.settlementIds.filter((id) => id !== params.settlementId),
                }
              : f,
          ),
          newFaction,
        ],
      }
      return next
    }
  }

  // soft_unaligned
  return {
    ...next,
    settlements: next.settlements.map((s) =>
      s.id === params.settlementId
        ? { ...s, factionId: null, vassalLiegeSettlementId: null }
        : s,
    ),
    factions: next.factions.map((f) =>
      f.id === priorFactionId
        ? {
            ...f,
            settlementIds: f.settlementIds.filter((id) => id !== params.settlementId),
          }
        : f,
    ),
  }
}
