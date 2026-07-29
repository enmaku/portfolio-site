/**
 * Colonization politics phase: latch, sticky membership events, absorption.
 * Domain: world-builder/CONTEXT.md — Faction, Supply-chain independence.
 */

import { annotateSurvivalFactionDependence } from './annotateSurvivalFactionDependence.js'
import { applyFactionAbsorption } from './applyFactionAbsorption.js'
import { applyFactionMembershipEvents } from './applyFactionMembershipEvents.js'
import { applyConflictEnginePass } from './conflict/applyConflictEnginePass.js'
import { evaluateSupplyChainIndependence } from './evaluateSupplyChainIndependence.js'
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

    if (latched) {
      const conflict = applyConflictEnginePass({
        slice: next,
        candidateEdges: params.candidateEdges,
        capacityBySettlementId: params.capacityBySettlementId,
        resourceScoreBySettlementId: params.resourceScoreBySettlementId,
        martialInputBySettlementId: params.martialInputBySettlementId,
      })
      next = conflict.slice
      events.push(...conflict.events)

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

  return { slice: next, events }
}
