/**
 * Colonization politics phase: latch, membership, pressure, conflict, absorption.
 * Domain: world-builder/CONTEXT.md — Faction, Supply-chain independence.
 */

import {
  annotateSurvivalFactionDependence,
  countAnnotateSurvivalProgressItems,
} from './annotateSurvivalFactionDependence.js'
import {
  applyFactionAbsorption,
  countAbsorptionProgressItems,
} from './applyFactionAbsorption.js'
import {
  applyFactionMembershipEvents,
  MEMBERSHIP_EVENT_PROGRESS_STAGE_COUNT,
} from './applyFactionMembershipEvents.js'
import { applyConflictEnginePass } from './conflict/applyConflictEnginePass.js'
import { buildConflictEngineInputs } from './conflict/buildConflictEngineInputs.js'
import { evaluateSupplyChainIndependence } from './evaluateSupplyChainIndependence.js'
import { syncFactionTerritoryPalettes } from './factionCap.js'
import { HISTORY_KIND_INCREMENT3_LATCHED } from './historyKinds.js'
import { advanceBannerTenure } from './bannerTenure/bannerTenure.js'
import {
  applyPoliticalPressurePass,
  countEligiblePoliticalPressureSubjects,
  countPoliticalPressureProgressItems,
} from './politicalPressure/applyPoliticalPressurePass.js'
import { getPoliticalPressureTuning } from './politicalPressure/politicalPressureTuning.js'
import { resolveMapGraySettlementIds } from './softPower/factionalControl.js'
import {
  countLivingSoftPowerSettlements,
  scoreSoftPowerBySettlementAsync,
} from './softPower/scoreSoftPower.js'
import { advanceSoftPowerStreaks } from './softPower/softPowerStreaks.js'
import { isTaxedFactionMember } from './softPower/taxedMembers.js'
import { createControlOverlayRefreshCue } from '../mapFxCues.js'

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
 * @property {(cue: import('../mapFxCues.js').MapFxCue, live: {
 *   slice: import('../createDefaultColonizationSlice.js').ColonizationSlice,
 *   primaryClaim?: Record<string, Array<{ x: number, y: number }>>,
 * }) => void | Promise<void>} [onMapFx]
 * @property {() => Record<string, Array<{ x: number, y: number }>> | undefined} [primaryClaimForFx]
 */

/**
 * Emit-only item counter. Callers yield via their own `yieldToUi` after `report()`.
 *
 * @param {PoliticsPhaseHooks | undefined} hooks
 * @param {string} substepId
 * @param {number} itemCount
 */
function createPoliticsItemProgress(hooks, substepId, itemCount) {
  let itemIndex = 0
  return {
    itemCount,
    report() {
      if (!(itemCount > 0)) return
      itemIndex += 1
      emitPoliticsSubstep(hooks, 'substep-item', substepId, itemIndex, itemCount)
    },
  }
}

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
 *   graphCache?: import('../tradeGraph/candidateTradeGraphCache.js').CandidateTradeGraphCache,
 * }} params
 * @param {PoliticsPhaseOptions} [options]
 * @returns {Promise<{
 *   slice: import('../createDefaultColonizationSlice.js').ColonizationSlice,
 *   events: object[],
 * }>}
 */
export async function applyPoliticsPhase(params, options = {}) {
  const { hooks, yieldToUi, onMapFx, primaryClaimForFx } = options
  const events = []
  let next = params.slice
  let justLatched = false

  /**
   * Paint control overlay as soon as factional control state changes.
   */
  async function emitControlRefresh() {
    if (!onMapFx) return
    const primaryClaim = primaryClaimForFx?.() ?? params.primaryClaim ?? next.primaryClaim
    await onMapFx(
      createControlOverlayRefreshCue({
        epoch: next.epoch,
        phaseId: 'politics',
        primaryClaim,
      }),
      { slice: next, primaryClaim },
    )
  }

  /**
   * @param {string} substepId
   */
  async function completePoliticsSubstep(substepId) {
    emitPoliticsSubstep(hooks, 'substep-complete', substepId)
    await yieldToUi?.()
  }

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
      graphCache: params.graphCache,
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
  /** @type {Record<string, { dominantFactionId?: string | null }>} */
  let softPowerScores = {}
  if (latched || hasActiveFactions) {
    const membershipItemCount =
      countAnnotateSurvivalProgressItems(next.settlements) +
      countLivingSoftPowerSettlements(next.settlements) +
      1 + // soft-power streaks
      MEMBERSHIP_EVENT_PROGRESS_STAGE_COUNT
    const membershipProgress = createPoliticsItemProgress(
      hooks,
      'membership',
      membershipItemCount,
    )

    survivalBySettlementId = await annotateSurvivalFactionDependence(
      {
        settlements: next.settlements,
        factions: next.factions,
        survivalBySettlementId,
        worldDocument: params.worldDocument,
        threeDayHaulDistance: next.colonistSettings.threeDayHaulDistance,
        roads: next.roads,
        inlandSailExpeditionRange:
          next.colonistSettings.inlandSailExpeditionRange *
          next.colonistSettings.threeDayHaulDistance,
        graphCache: params.graphCache,
      },
      {
        onItem: () => {
          membershipProgress.report()
        },
        yieldToUi,
      },
    )

    softPowerScores = await scoreSoftPowerBySettlementAsync(
      {
        settlements: next.settlements,
        factions: next.factions,
        bilateralCpByPair: next.lastOnMapGoodsBilateralCpByPair,
      },
      {
        onItem: () => {
          membershipProgress.report()
        },
        yieldToUi,
      },
    )
    const mapGray = resolveMapGraySettlementIds({
      settlements: next.settlements,
      factions: next.factions,
    })
    /** @type {Set<string>} */
    const taxedIds = new Set()
    /** @type {Record<string, string>} */
    const homeFactionBySettlementId = {}
    for (const settlement of next.settlements ?? []) {
      if (!isTaxedFactionMember(settlement)) continue
      taxedIds.add(settlement.id)
      homeFactionBySettlementId[settlement.id] = settlement.factionId
    }
    const streaked = advanceSoftPowerStreaks({
      state: next,
      scores: softPowerScores,
      epoch: next.epoch,
      mapGraySettlementIds: mapGray,
      taxedMemberSettlementIds: taxedIds,
      homeFactionBySettlementId,
    })
    next = { ...next, ...streaked.state }
    membershipProgress.report()
    await yieldToUi?.()
    await emitControlRefresh()

    const membership = await applyFactionMembershipEvents(
      {
        slice: next,
        worldDocument: params.worldDocument,
        primaryClaim: params.primaryClaim,
        justLatched,
        survivalBySettlementId,
        softPowerScores,
        graphCache: params.graphCache,
      },
      {
        onProgress: () => {
          membershipProgress.report()
        },
        yieldToUi,
        onControlChanged: async (updated) => {
          next = updated
          await emitControlRefresh()
        },
      },
    )
    next = membership.slice
    events.push(...membership.events)
  }
  await completePoliticsSubstep('membership')

  emitPoliticsSubstep(hooks, 'substep-start', 'pressure')
  await yieldToUi?.()
  if (latched || hasActiveFactions) {
    const tenure = advanceBannerTenure({
      settlements: next.settlements,
      bannerMembershipHistoryBySettlementId: next.bannerMembershipHistoryBySettlementId,
    })
    next = { ...next, ...tenure }
    const pressureItemCount = getPoliticalPressureTuning().enabled
      ? countPoliticalPressureProgressItems(countEligiblePoliticalPressureSubjects(next))
      : 0
    const pressureProgress = createPoliticsItemProgress(hooks, 'pressure', pressureItemCount)
    const pressure = await applyPoliticalPressurePass(
      {
        slice: next,
        worldDocument: params.worldDocument,
        primaryClaim: params.primaryClaim ?? next.primaryClaim,
        capacityBySettlementId: params.capacityBySettlementId,
        martialInputBySettlementId: params.martialInputBySettlementId,
      },
      {
        onProgress: () => {
          pressureProgress.report()
        },
        yieldToUi,
      },
    )
    next = pressure.slice
    events.push(...pressure.events)
    if (pressure.events.length > 0) {
      await emitControlRefresh()
    }
  }
  await completePoliticsSubstep('pressure')

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
        softPowerScores,
        yieldToUi,
        onSelectProgress: (itemIndex, itemCount) => {
          emitPoliticsSubstep(hooks, 'substep-item', 'conflict', itemIndex, itemCount)
        },
        onControlChanged: async (updated) => {
          next = updated
          await emitControlRefresh()
        },
      })
      next = conflict.slice
      events.push(...conflict.events)
    }
  }
  await completePoliticsSubstep('conflict')

  emitPoliticsSubstep(hooks, 'substep-start', 'absorption')
  await yieldToUi?.()
  if (latched) {
    const absorptionItemCount = countAbsorptionProgressItems(next.settlements)
    const absorptionProgress = createPoliticsItemProgress(
      hooks,
      'absorption',
      absorptionItemCount,
    )
    const absorption = await applyFactionAbsorption(
      {
        slice: next,
        worldDocument: params.worldDocument,
        graphCache: params.graphCache,
        survivalBySettlementId,
        warOutcomes: params.warOutcomes,
      },
      {
        onProgress: () => {
          absorptionProgress.report()
        },
        yieldToUi,
      },
    )
    next = absorption.slice
    events.push(...absorption.events)
    if (absorption.events.length > 0) {
      await emitControlRefresh()
    }
  }
  await completePoliticsSubstep('absorption')

  emitPoliticsSubstep(hooks, 'substep-start', 'palette')
  await yieldToUi?.()
  next = {
    ...next,
    factions: syncFactionTerritoryPalettes({
      factions: next.factions,
      settlements: next.settlements,
      softPowerPaintBySettlementId: next.softPowerPaintBySettlementId,
    }),
  }
  await emitControlRefresh()
  await completePoliticsSubstep('palette')

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
