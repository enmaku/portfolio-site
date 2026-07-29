/**
 * Colonization politics phase: latch, sticky membership events, absorption.
 * Domain: world-builder/CONTEXT.md — Faction, Supply-chain independence.
 */

import { annotateSurvivalFactionDependence } from './annotateSurvivalFactionDependence.js'
import { applyFactionAbsorption } from './applyFactionAbsorption.js'
import { applyFactionMembershipEvents } from './applyFactionMembershipEvents.js'
import { applyConflictEnginePass } from './conflict/applyConflictEnginePass.js'
import { buildConflictEngineInputs } from './conflict/buildConflictEngineInputs.js'
import { evaluateSupplyChainIndependence } from './evaluateSupplyChainIndependence.js'
import { syncFactionTerritoryPalettes } from './factionCap.js'
import { HISTORY_KIND_INCREMENT3_LATCHED } from './historyKinds.js'

/**
 * @param {{
 *   slice: import('../createDefaultColonizationSlice.js').ColonizationSlice,
 *   worldDocument: object,
 *   primaryClaim?: Record<string, Array<{ x: number, y: number }>>,
 *   survivalBySettlementId?: Record<string, object>,
 *   warOutcomes?: Array<{ loserFactionId: string, winnerFactionId: string }>,
 *   candidateEdges?: object[],
 *   capacityBySettlementId?: Record<string, number>,
 *   resourceScoreBySettlementId?: Record<string, number>,
 *   martialInputBySettlementId?: Record<string, object>,
 *   baseMetalsLbBySettlementId?: Record<string, number>,
 * }} params
 * @returns {{
 *   slice: import('../createDefaultColonizationSlice.js').ColonizationSlice,
 *   events: object[],
 * }}
 */
export function applyPoliticsPhase(params) {
  const events = []
  let next = params.slice
  let justLatched = false

  if (next.increment3LatchedEpoch == null) {
    const evaluation = evaluateSupplyChainIndependence({
      settlements: next.settlements,
      worldDocument: params.worldDocument,
      threeDayHaulDistance: next.colonistSettings.threeDayHaulDistance,
      roads: next.roads,
      inlandSailExpeditionRange:
        next.colonistSettings.inlandSailExpeditionRange *
        next.colonistSettings.threeDayHaulDistance,
      colonistSettings: next.colonistSettings,
      primaryClaim: params.primaryClaim ?? next.primaryClaim,
    })

    if (evaluation.latched) {
      const historyEntry = {
        kind: HISTORY_KIND_INCREMENT3_LATCHED,
        epoch: next.epoch,
        landBranch: evaluation.landBranch,
        maritimeBranch: evaluation.maritimeBranch,
        maritimePeelSettlementIds: evaluation.maritimePeelSettlementIds,
      }
      next = {
        ...next,
        increment3LatchedEpoch: next.epoch,
        historyLog: [...(next.historyLog ?? []), historyEntry],
      }
      events.push(historyEntry)
      justLatched = true
    }
  }

  const latched = next.increment3LatchedEpoch != null
  const hasActiveFactions = (next.factions ?? []).some((f) => f && f.status === 'active')

  if (latched || hasActiveFactions) {
    const survivalBySettlementId = annotateSurvivalFactionDependence({
      settlements: next.settlements,
      factions: next.factions,
      survivalBySettlementId: params.survivalBySettlementId ?? {},
      worldDocument: params.worldDocument,
      threeDayHaulDistance: next.colonistSettings.threeDayHaulDistance,
      roads: next.roads,
      inlandSailExpeditionRange:
        next.colonistSettings.inlandSailExpeditionRange *
        next.colonistSettings.threeDayHaulDistance,
    })

    const membership = applyFactionMembershipEvents({
      slice: next,
      worldDocument: params.worldDocument,
      primaryClaim: params.primaryClaim,
      justLatched,
      survivalBySettlementId,
    })
    next = membership.slice
    events.push(...membership.events)

    const activeFactionCount = (next.factions ?? []).filter((f) => f.status === 'active').length
    const hasUnalignedStake = (next.settlements ?? []).some(
      (s) => s.status === 'living' && s.factionId == null,
    )
    const runConflict = latched || activeFactionCount >= 2 || hasUnalignedStake
    // Conquest/rebellion once there are rival actors or free towns — not only after
    // haul-shed latch (default haul often never latches on mid-size maps).
    if (runConflict) {
      const derived = buildConflictEngineInputs({
        slice: next,
        survivalBySettlementId,
        baseMetalsLbBySettlementId: params.baseMetalsLbBySettlementId,
      })
      const conflict = applyConflictEnginePass({
        slice: next,
        candidateEdges: params.candidateEdges,
        capacityBySettlementId: params.capacityBySettlementId,
        resourceScoreBySettlementId:
          params.resourceScoreBySettlementId ?? derived.resourceScoreBySettlementId,
        martialInputBySettlementId:
          params.martialInputBySettlementId ?? derived.martialInputBySettlementId,
      })
      next = conflict.slice
      events.push(...conflict.events)
    }

    if (latched) {
      const absorption = applyFactionAbsorption({
        slice: next,
        worldDocument: params.worldDocument,
        survivalBySettlementId,
        warOutcomes: params.warOutcomes,
      })
      next = absorption.slice
      events.push(...absorption.events)
    }
  }

  next = {
    ...next,
    factions: syncFactionTerritoryPalettes({
      factions: next.factions,
      settlements: next.settlements,
    }),
  }
  return { slice: next, events }
}
