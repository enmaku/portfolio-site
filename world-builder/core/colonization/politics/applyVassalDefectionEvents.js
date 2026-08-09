/**
 * Vassal defection membership events: local independence + component split.
 * Domain: world-builder/CONTEXT.md — Conditional loyalty, Vassal.
 */

import { computeLogisticsConnectivityComponents } from './computeLogisticsConnectivityComponents.js'
import {
  HISTORY_KIND_FACTION_EMERGED,
  HISTORY_KIND_VASSAL_DEFECTION,
} from './historyKinds.js'
import {
  MEMBERSHIP_CLEAR_AND_REARM_EPOCHS,
  MEMBERSHIP_REFRACTORY_EPOCHS,
  VASSAL_INDEPENDENCE_EPOCHS,
} from './politicsConstants.js'
import { createActiveFactionRecord } from './factionCap.js'
import { isVassalLocallyIndependent, resolveVassalDefection } from './resolveVassalDefection.js'

/**
 * @param {{
 *   slice: import('../createDefaultColonizationSlice.js').ColonizationSlice,
 *   worldDocument: object,
 *   survivalBySettlementId?: Record<string, object>,
 * }} params
 * @returns {{
 *   slice: import('../createDefaultColonizationSlice.js').ColonizationSlice,
 *   events: object[],
 * }}
 */
export function applyVassalDefections(params) {
  let next = params.slice
  const events = []
  const survivalBySettlementId = params.survivalBySettlementId ?? {}
  const components = computeLogisticsConnectivityComponents({
    settlements: next.settlements,
    worldDocument: params.worldDocument,
    threeDayHaulDistance: next.colonistSettings.threeDayHaulDistance,
    roads: next.roads,
    inlandSailExpeditionRange:
      next.colonistSettings.inlandSailExpeditionRange *
      next.colonistSettings.threeDayHaulDistance,
  }).components

  /** @type {Map<string, string>} */
  const componentBySettlement = new Map()
  for (const component of components) {
    for (const id of component.settlementIds) {
      componentBySettlement.set(id, component.key)
    }
  }

  const cooldownBlocked = new Set(
    (next.membershipCooldown ?? [])
      .filter((row) => row.untilEpoch >= next.epoch)
      .map((row) => row.subjectId),
  )

  /** @type {Record<string, number>} */
  const clearStreak = { ...(next.membershipCauseClearStreak ?? {}) }
  /** @type {Record<string, number>} */
  const independenceStreak = { ...(next.vassalIndependenceStreak ?? {}) }
  const pendingRearm = new Set(
    (next.membershipCooldown ?? [])
      .filter((row) => row.untilEpoch < next.epoch)
      .map((row) => row.subjectId),
  )

  const vassals = next.settlements.filter(
    (s) =>
      s.status !== 'ruin' &&
      s.vassalLiegeSettlementId &&
      s.factionId &&
      !cooldownBlocked.has(s.id),
  )

  for (const vassal of vassals) {
    const liegeId = vassal.vassalLiegeSettlementId
    const sameComponentAsLiege =
      componentBySettlement.get(vassal.id) != null &&
      componentBySettlement.get(vassal.id) === componentBySettlement.get(liegeId)

    const locallyIndependent = isVassalLocallyIndependent(survivalBySettlementId[vassal.id])
    if (locallyIndependent) {
      independenceStreak[vassal.id] = (independenceStreak[vassal.id] ?? 0) + 1
    } else {
      independenceStreak[vassal.id] = 0
    }

    const sustainedIndependence =
      (independenceStreak[vassal.id] ?? 0) >= VASSAL_INDEPENDENCE_EPOCHS
    const loyaltyBroken = sustainedIndependence || !sameComponentAsLiege

    if (pendingRearm.has(vassal.id)) {
      if (!loyaltyBroken) {
        clearStreak[vassal.id] = (clearStreak[vassal.id] ?? 0) + 1
      } else {
        clearStreak[vassal.id] = 0
      }
      if ((clearStreak[vassal.id] ?? 0) < MEMBERSHIP_CLEAR_AND_REARM_EPOCHS) {
        continue
      }
    }

    if (!loyaltyBroken) continue

    const adjacent = findAdjacentFaction({
      settlementId: vassal.id,
      currentFactionId: vassal.factionId,
      settlements: next.settlements,
      componentBySettlement,
    })

    const decision = resolveVassalDefection({
      settlement: vassal,
      linkedToLiege: false,
      adjacentFactionId: adjacent?.factionId ?? null,
      corridorDependentOnAdjacent: Boolean(adjacent) && !sustainedIndependence,
    })
    if (!decision) continue

    const applied = applyDefectionDecision({
      slice: next,
      vassalId: vassal.id,
      decision,
    })
    next = applied.slice
    events.push(...applied.events)
    clearStreak[vassal.id] = 0
    delete independenceStreak[vassal.id]
  }

  next = {
    ...next,
    membershipCauseClearStreak: clearStreak,
    vassalIndependenceStreak: independenceStreak,
  }
  return { slice: next, events }
}

/**
 * @param {{
 *   settlementId: string,
 *   currentFactionId: string,
 *   settlements: object[],
 *   componentBySettlement: Map<string, string>,
 * }} params
 * @returns {{ factionId: string, settlementId: string } | null}
 */
export function findAdjacentFaction(params) {
  const ownComponent = params.componentBySettlement.get(params.settlementId)
  if (!ownComponent) return null
  for (const settlement of params.settlements) {
    if (settlement.status === 'ruin') continue
    if (!settlement.factionId || settlement.factionId === params.currentFactionId) continue
    if (params.componentBySettlement.get(settlement.id) === ownComponent) {
      return { factionId: settlement.factionId, settlementId: settlement.id }
    }
  }
  return null
}

/**
 * @param {{
 *   slice: import('../createDefaultColonizationSlice.js').ColonizationSlice,
 *   vassalId: string,
 *   decision: { action: 'join' | 'spawn' | 'soft_unaligned', targetFactionId?: string },
 * }} params
 */
function applyDefectionDecision(params) {
  const events = []
  let next = params.slice
  const vassal = next.settlements.find((s) => s.id === params.vassalId)
  if (!vassal) return { slice: next, events }

  let factions = (next.factions ?? []).map((f) => ({
    ...f,
    settlementIds: [...f.settlementIds],
  }))
  let settlements = next.settlements.map((s) => ({ ...s }))
  let historyLog = [...(next.historyLog ?? [])]
  let membershipCooldown = [...(next.membershipCooldown ?? [])]

  const previousFactionId = vassal.factionId
  const previousFaction = factions.find((f) => f.id === previousFactionId)
  if (previousFaction) {
    previousFaction.settlementIds = previousFaction.settlementIds.filter((id) => id !== vassal.id)
  }

  let nextFactionId = null
  let nextLiege = null
  let cause = params.decision.action

  if (params.decision.action === 'join' && params.decision.targetFactionId) {
    nextFactionId = params.decision.targetFactionId
    const target = factions.find((f) => f.id === nextFactionId && f.status === 'active')
    nextLiege = target?.capitalSettlementId ?? null
    if (target && !target.settlementIds.includes(vassal.id)) {
      target.settlementIds.push(vassal.id)
    }
  } else if (params.decision.action === 'spawn') {
    nextFactionId = `faction-${vassal.id}-spawn-${next.epoch}`
    const minted = createActiveFactionRecord({
      id: nextFactionId,
      capitalSettlementId: vassal.id,
      settlementIds: [vassal.id],
      emergedEpoch: next.epoch,
      factions,
    })
    if (minted) {
      factions.push(minted)
      nextLiege = null
      const emerged = {
        kind: HISTORY_KIND_FACTION_EMERGED,
        epoch: next.epoch,
        factionId: nextFactionId,
        capitalSettlementId: vassal.id,
        cause: 'vassal_defection',
      }
      historyLog.push(emerged)
      events.push(emerged)
    } else {
      // At cap: soft unaligned (join-first already preferred upstream).
      nextFactionId = null
      nextLiege = null
      cause = 'soft_unaligned'
    }
  } else {
    nextFactionId = null
    nextLiege = null
    cause = 'soft_unaligned'
  }

  settlements = settlements.map((s) =>
    s.id === vassal.id
      ? { ...s, factionId: nextFactionId, vassalLiegeSettlementId: nextLiege }
      : s,
  )

  const defection = {
    kind: HISTORY_KIND_VASSAL_DEFECTION,
    epoch: next.epoch,
    settlementId: vassal.id,
    fromFactionId: previousFactionId,
    toFactionId: nextFactionId,
    cause,
  }
  historyLog.push(defection)
  events.push(defection)

  membershipCooldown.push({
    subjectId: vassal.id,
    untilEpoch: next.epoch + MEMBERSHIP_REFRACTORY_EPOCHS,
    kind: HISTORY_KIND_VASSAL_DEFECTION,
  })

  next = {
    ...next,
    factions,
    settlements,
    historyLog,
    membershipCooldown,
  }
  return { slice: next, events }
}
