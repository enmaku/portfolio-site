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
 * @typedef {Object} PoliticsSubstepPayload
 * @property {'substep-start' | 'substep-complete' | 'substep-item'} type
 * @property {string} substepId
 * @property {number} [substepIndex]
 * @property {number} [itemIndex]
 * @property {number} [itemCount]
 */

/**
 * @typedef {Object} PoliticsPhaseHooks
 * @property {(payload: PoliticsSubstepPayload) => void} [onPoliticsSubstep]
 */

/**
 * @typedef {Object} PoliticsPhaseOptions
 * @property {PoliticsPhaseHooks} [hooks]
 * @property {() => Promise<void>} [yieldToUi]
 */

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
 * @param {PoliticsPhaseOptions} [options]
 * @returns {Promise<{
 *   slice: import('../createDefaultColonizationSlice.js').ColonizationSlice,
 *   events: object[],
 * }>}
 */
export async function applyPoliticsPhase(params, options = {}) {
  const { hooks, yieldToUi } = options
  const events = []
  let next = params.slice
  let justLatched = false

  emitPoliticsSubstep(hooks, 'substep-start', 'latch')
  await yieldToUi?.()
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
  emitPoliticsSubstep(hooks, 'substep-complete', 'latch')
  await yieldToUi?.()

  const latched = next.increment3LatchedEpoch != null
  const hasActiveFactions = (next.factions ?? []).some((f) => f && f.status === 'active')

  /** @type {Record<string, object>} */
  let survivalBySettlementId = params.survivalBySettlementId ?? {}

  emitPoliticsSubstep(hooks, 'substep-start', 'membership')
  await yieldToUi?.()
  if (latched || hasActiveFactions) {
    survivalBySettlementId = annotateSurvivalFactionDependence({
      settlements: next.settlements,
      factions: next.factions,
      survivalBySettlementId,
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
  }
  emitPoliticsSubstep(hooks, 'substep-complete', 'membership')
  await yieldToUi?.()

  emitPoliticsSubstep(hooks, 'substep-start', 'conflict')
  await yieldToUi?.()
  if (latched || hasActiveFactions) {
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
      const conflict = await applyConflictEnginePass({
        slice: next,
        candidateEdges: params.candidateEdges,
        capacityBySettlementId: params.capacityBySettlementId,
        resourceScoreBySettlementId:
          params.resourceScoreBySettlementId ?? derived.resourceScoreBySettlementId,
        martialInputBySettlementId:
          params.martialInputBySettlementId ?? derived.martialInputBySettlementId,
        yieldToUi,
        onSelectProgress: (itemIndex, itemCount) => {
          emitPoliticsSubstep(hooks, 'substep-item', 'conflict', itemIndex, itemCount)
        },
      })
      next = conflict.slice
      events.push(...conflict.events)
    }
  }
  emitPoliticsSubstep(hooks, 'substep-complete', 'conflict')
  await yieldToUi?.()

  emitPoliticsSubstep(hooks, 'substep-start', 'absorption')
  await yieldToUi?.()
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
  emitPoliticsSubstep(hooks, 'substep-complete', 'absorption')
  await yieldToUi?.()

  emitPoliticsSubstep(hooks, 'substep-start', 'palette')
  await yieldToUi?.()
  next = {
    ...next,
    factions: syncFactionTerritoryPalettes({
      factions: next.factions,
      settlements: next.settlements,
    }),
  }
  emitPoliticsSubstep(hooks, 'substep-complete', 'palette')
  await yieldToUi?.()

  return { slice: next, events }
}

/**
 * @param {PoliticsPhaseHooks | undefined} hooks
 * @param {PoliticsSubstepPayload['type']} type
 * @param {string} substepId
 * @param {number} [itemIndex]
 * @param {number} [itemCount]
 */
function emitPoliticsSubstep(hooks, type, substepId, itemIndex, itemCount) {
  hooks?.onPoliticsSubstep?.({
    type,
    substepId,
    ...(itemIndex != null ? { itemIndex } : {}),
    ...(itemCount != null ? { itemCount } : {}),
  })
}
