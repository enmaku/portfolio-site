/**
 * Sticky faction membership events: stagger mint, peel, crystallize.
 * Domain: world-builder/CONTEXT.md — Faction, Unaligned settlement.
 */

import { computeLogisticsConnectivityComponents } from './computeLogisticsConnectivityComponents.js'
import { evaluateSupplyChainIndependence } from './evaluateSupplyChainIndependence.js'
import {
  HISTORY_KIND_CITY_STATE_FOUNDING,
  HISTORY_KIND_FACTION_ABSORPTION,
  HISTORY_KIND_FACTION_EMERGED,
} from './historyKinds.js'
import {
  FACTION_MINT_STAGGER_EPOCHS,
  MEMBERSHIP_REFRACTORY_EPOCHS,
  UNALIGNED_CRYSTALLIZE_EPOCHS,
} from './politicsConstants.js'
import { applyVassalDefections, findAdjacentFaction } from './applyVassalDefectionEvents.js'
import { applyStrategicOverstretchPeel } from './applyStrategicOverstretchPeel.js'
import { createActiveFactionRecord } from './factionCap.js'
import {
  applyPeacefulTradePartnerJoins,
  applyTradePartnerPeels,
  upgradeTradePartnersOnSurvivalDependence,
} from './softPower/applyTradePartnerMembership.js'

/** Fixed membership-event progress stages (always ticked when membership work runs). */
export const MEMBERSHIP_EVENT_PROGRESS_STAGE_COUNT = 9

/**
 * @param {{
 *   slice: import('../createDefaultColonizationSlice.js').ColonizationSlice,
 *   worldDocument: object,
 *   primaryClaim?: Record<string, Array<{ x: number, y: number }>>,
 *   justLatched?: boolean,
 *   survivalBySettlementId?: Record<string, object>,
 *   softPowerScores?: Record<string, { dominantFactionId?: string | null }>,
 * }} params
 * @param {{
 *   onProgress?: () => void,
 *   yieldToUi?: () => Promise<void>,
 *   onControlChanged?: (slice: import('../createDefaultColonizationSlice.js').ColonizationSlice) => void | Promise<void>,
 * }} [options]
 * @returns {Promise<{
 *   slice: import('../createDefaultColonizationSlice.js').ColonizationSlice,
 *   events: object[],
 * }>}
 */
export async function applyFactionMembershipEvents(params, options = {}) {
  const { onProgress, yieldToUi, onControlChanged } = options
  const tick = async () => {
    onProgress?.()
    await yieldToUi?.()
  }
  /**
   * @param {import('../createDefaultColonizationSlice.js').ColonizationSlice} slice
   * @param {boolean} changed
   */
  async function finishStage(slice, changed) {
    if (changed) {
      await onControlChanged?.(slice)
    }
    await tick()
  }

  let next = params.slice
  const events = []
  const latched = next.increment3LatchedEpoch != null
  const hasActiveFactions = (next.factions ?? []).some((f) => f && f.status === 'active')
  if (!latched && !hasActiveFactions) {
    return { slice: next, events }
  }

  const primaryClaim = params.primaryClaim ?? next.primaryClaim

  // Stage 1 — maritime peels / latch fracture queue
  {
    let changed = false
    if (latched) {
      const evaluation = evaluateSupplyChainIndependence({
        settlements: next.settlements,
        worldDocument: params.worldDocument,
        threeDayHaulDistance: next.colonistSettings.threeDayHaulDistance,
        roads: next.roads,
        inlandSailExpeditionRange:
          next.colonistSettings.inlandSailExpeditionRange *
          next.colonistSettings.threeDayHaulDistance,
        colonistSettings: next.colonistSettings,
        primaryClaim,
      })

      if (params.justLatched || evaluation.maritimePeelSettlementIds.length > 0) {
        const peeled = applyMaritimePeels({
          slice: next,
          peelIds: evaluation.maritimePeelSettlementIds,
        })
        next = peeled.slice
        if (peeled.events.length > 0) changed = true
        events.push(...peeled.events)
      }

      if (params.justLatched) {
        const queued = fractureAndQueueStaggeredMints({
          slice: next,
          worldDocument: params.worldDocument,
        })
        next = queued.slice
        changed = true
      }
    }
    await finishStage(next, changed)
  }

  // Stage 2 — crystallize due mints
  {
    let changed = false
    if (latched) {
      const crystallized = crystallizeDueMints({ slice: next })
      next = crystallized.slice
      if (crystallized.events.length > 0) changed = true
      events.push(...crystallized.events)
    }
    await finishStage(next, changed)
  }

  // Stage 3 — capital succession
  {
    const beforeCapitals = JSON.stringify(
      (next.factions ?? []).map((f) => [f.id, f.capitalSettlementId]),
    )
    const succession = applyCapitalSuccession({ slice: next })
    next = succession.slice
    const afterCapitals = JSON.stringify(
      (next.factions ?? []).map((f) => [f.id, f.capitalSettlementId]),
    )
    await finishStage(next, beforeCapitals !== afterCapitals)
  }

  // Stage 4 — strategic overstretch peel
  {
    const overstretch = applyStrategicOverstretchPeel({
      slice: next,
      worldDocument: params.worldDocument,
    })
    next = overstretch.slice
    events.push(...overstretch.events)
    await finishStage(next, overstretch.events.length > 0)
  }

  // Stage 5 — vassal defections
  {
    const defections = applyVassalDefections({
      slice: next,
      worldDocument: params.worldDocument,
      survivalBySettlementId: params.survivalBySettlementId ?? {},
    })
    next = defections.slice
    events.push(...defections.events)
    await finishStage(next, defections.events.length > 0)
  }

  // Stage 6 — survival-dependence trade-partner upgrade
  {
    const survivalUpgrade = upgradeTradePartnersOnSurvivalDependence({
      slice: next,
      survivalBySettlementId: params.survivalBySettlementId ?? {},
    })
    next = survivalUpgrade.slice
    events.push(...survivalUpgrade.events)
    await finishStage(next, survivalUpgrade.events.length > 0)
  }

  // Stage 7 — peaceful trade-partner joins
  {
    const tradePartnerJoins = applyPeacefulTradePartnerJoins({ slice: next })
    next = tradePartnerJoins.slice
    events.push(...tradePartnerJoins.events)
    await finishStage(next, tradePartnerJoins.events.length > 0)
  }

  // Stage 8 — trade-partner peels
  {
    const tradePartnerPeels = applyTradePartnerPeels({
      slice: next,
      scores: params.softPowerScores ?? {},
    })
    next = tradePartnerPeels.slice
    events.push(...tradePartnerPeels.events)
    await finishStage(next, tradePartnerPeels.events.length > 0)
  }

  // Stage 9 — lone unaligned resolution
  {
    const unaligned = resolveLoneUnaligned({
      slice: next,
      worldDocument: params.worldDocument,
      survivalBySettlementId: params.survivalBySettlementId ?? {},
    })
    next = unaligned.slice
    events.push(...unaligned.events)
    await finishStage(next, unaligned.events.length > 0)
  }

  return { slice: next, events }
}


/**
 * @param {{
 *   slice: import('../createDefaultColonizationSlice.js').ColonizationSlice,
 *   peelIds: string[],
 * }} params
 */
function applyMaritimePeels(params) {
  let next = params.slice
  const events = []
  const peelIds = params.peelIds.filter((id) => {
    const s = next.settlements.find((row) => row.id === id)
    if (!s || s.status === 'ruin') return false
    if (!s.factionId) return true
    const faction = (next.factions ?? []).find((f) => f.id === s.factionId && f.status === 'active')
    if (!faction) return true
    // Solo city-state already — no remint. Peel only when leaving peers behind.
    return faction.settlementIds.some((memberId) => {
      if (memberId === id) return false
      const peer = next.settlements.find((row) => row.id === memberId)
      return peer && peer.status !== 'ruin' && (peer.population === undefined || peer.population > 0)
    })
  })
  if (peelIds.length === 0) return { slice: next, events }

  let factions = [...(next.factions ?? [])]
  let settlements = next.settlements.map((s) => ({ ...s }))
  let historyLog = [...(next.historyLog ?? [])]
  let pending = [...(next.pendingComponentMints ?? [])]

  for (const peelId of peelIds) {
    const previousFactionId = settlements.find((s) => s.id === peelId)?.factionId ?? null
    if (previousFactionId) {
      factions = factions.map((f) => {
        if (f.id !== previousFactionId) return f
        const settlementIds = f.settlementIds.filter((id) => id !== peelId)
        const capitalSettlementId =
          f.capitalSettlementId === peelId ? (settlementIds[0] ?? f.capitalSettlementId) : f.capitalSettlementId
        return { ...f, settlementIds, capitalSettlementId }
      })
    }
    const factionId = `faction-${peelId}-peel-${next.epoch}`
    const minted = createActiveFactionRecord({
      id: factionId,
      capitalSettlementId: peelId,
      settlementIds: [peelId],
      emergedEpoch: next.epoch,
      factions,
    })
    pending = pending
      .map((mint) => ({
        ...mint,
        settlementIds: mint.settlementIds.filter((id) => id !== peelId),
      }))
      .filter((mint) => mint.settlementIds.length > 0)

    if (minted) {
      factions.push(minted)
      settlements = settlements.map((s) =>
        s.id === peelId ? { ...s, factionId, vassalLiegeSettlementId: null } : s,
      )
      const emerged = {
        kind: HISTORY_KIND_FACTION_EMERGED,
        epoch: next.epoch,
        factionId,
        capitalSettlementId: peelId,
        cause: 'maritime_peel',
      }
      const cityState = {
        kind: HISTORY_KIND_CITY_STATE_FOUNDING,
        epoch: next.epoch,
        factionId,
        settlementId: peelId,
      }
      historyLog.push(emerged, cityState)
      events.push(emerged, cityState)
    } else {
      settlements = settlements.map((s) =>
        s.id === peelId ? { ...s, factionId: null, vassalLiegeSettlementId: null } : s,
      )
    }
  }

  next = {
    ...next,
    factions,
    settlements,
    historyLog,
    pendingComponentMints: pending,
  }
  return { slice: next, events }
}

/**
 * On latch: keep the senior/founding faction's logistics component intact; detach
 * other town-ready components into staggered unaligned mint queues.
 *
 * @param {{
 *   slice: import('../createDefaultColonizationSlice.js').ColonizationSlice,
 *   worldDocument: object,
 * }} params
 */
function fractureAndQueueStaggeredMints(params) {
  let next = params.slice
  const components = computeLogisticsConnectivityComponents({
    settlements: next.settlements,
    worldDocument: params.worldDocument,
    threeDayHaulDistance: next.colonistSettings.threeDayHaulDistance,
    roads: next.roads,
    inlandSailExpeditionRange:
      next.colonistSettings.inlandSailExpeditionRange *
      next.colonistSettings.threeDayHaulDistance,
  }).components

  const senior = [...(next.factions ?? [])]
    .filter((f) => f.status === 'active')
    .sort((a, b) => a.emergedEpoch - b.emergedEpoch || (a.id < b.id ? -1 : 1))[0]

  /** @type {string | null} */
  let seniorComponentKey = null
  if (senior) {
    for (const component of components) {
      if (component.settlementIds.includes(senior.capitalSettlementId)) {
        seniorComponentKey = component.key
        break
      }
    }
  }

  let settlements = next.settlements.map((s) => ({ ...s }))
  let factions = (next.factions ?? []).map((f) => ({
    ...f,
    settlementIds: [...f.settlementIds],
  }))
  const pending = [...(next.pendingComponentMints ?? [])]
  const existingKeys = new Set(pending.map((m) => m.componentKey))
  let offset = 0

  for (const component of components) {
    if (seniorComponentKey && component.key === seniorComponentKey) continue
    const hasTown = component.settlementIds.some((id) =>
      isTownTierOrHigher(settlements.find((s) => s.id === id)),
    )
    if (!hasTown) continue
    if (existingKeys.has(component.key)) continue

    for (const id of component.settlementIds) {
      const settlement = settlements.find((s) => s.id === id)
      if (!settlement || settlement.status === 'ruin') continue
      const previousFactionId = settlement.factionId
      if (previousFactionId) {
        const faction = factions.find((f) => f.id === previousFactionId)
        if (faction) {
          faction.settlementIds = faction.settlementIds.filter((memberId) => memberId !== id)
        }
      }
      settlements = settlements.map((s) =>
        s.id === id ? { ...s, factionId: null, vassalLiegeSettlementId: null } : s,
      )
    }

    pending.push({
      componentKey: component.key,
      settlementIds: [...component.settlementIds],
      dueEpoch: next.epoch + FACTION_MINT_STAGGER_EPOCHS * (offset + 1),
    })
    existingKeys.add(component.key)
    offset += 1
  }

  // Also queue already-unaligned town-ready components (no senior fracture needed).
  const unalignedComponents = computeLogisticsConnectivityComponents({
    settlements: settlements.filter((s) => !s.factionId),
    worldDocument: params.worldDocument,
    threeDayHaulDistance: next.colonistSettings.threeDayHaulDistance,
    roads: next.roads,
    inlandSailExpeditionRange:
      next.colonistSettings.inlandSailExpeditionRange *
      next.colonistSettings.threeDayHaulDistance,
  }).components
  for (const component of unalignedComponents) {
    if (existingKeys.has(component.key)) continue
    if (
      !component.settlementIds.some((id) => isTownTierOrHigher(settlements.find((s) => s.id === id)))
    ) {
      continue
    }
    pending.push({
      componentKey: component.key,
      settlementIds: [...component.settlementIds],
      dueEpoch: next.epoch + FACTION_MINT_STAGGER_EPOCHS * (offset + 1),
    })
    offset += 1
  }

  return {
    slice: {
      ...next,
      settlements,
      factions,
      pendingComponentMints: pending,
    },
  }
}


/**
 * @param {{ slice: import('../createDefaultColonizationSlice.js').ColonizationSlice }} params
 */
function crystallizeDueMints(params) {
  let next = params.slice
  const events = []
  const due = (next.pendingComponentMints ?? []).filter((m) => m.dueEpoch <= next.epoch)
  if (due.length === 0) return { slice: next, events }

  let factions = [...(next.factions ?? [])]
  let settlements = next.settlements.map((s) => ({ ...s }))
  let historyLog = [...(next.historyLog ?? [])]
  const remaining = (next.pendingComponentMints ?? []).filter((m) => m.dueEpoch > next.epoch)

  for (const mint of due) {
    const livingIds = mint.settlementIds.filter((id) => {
      const s = settlements.find((row) => row.id === id)
      return s && s.status !== 'ruin' && !s.factionId
    })
    if (livingIds.length === 0) continue
    if (!livingIds.some((id) => isTownTierOrHigher(settlements.find((s) => s.id === id)))) {
      remaining.push(mint)
      continue
    }

    const capitalSettlementId = pickCapitalId(livingIds, settlements)
    const factionId = `faction-${mint.componentKey}-${next.epoch}`
    const faction = createActiveFactionRecord({
      id: factionId,
      capitalSettlementId,
      settlementIds: livingIds,
      emergedEpoch: next.epoch,
      factions,
    })
    if (!faction) {
      // At cap: keep waiting until an active faction frees a slot.
      remaining.push({
        ...mint,
        dueEpoch: next.epoch + FACTION_MINT_STAGGER_EPOCHS,
      })
      continue
    }
    factions.push(faction)
    settlements = settlements.map((s) => {
      if (!livingIds.includes(s.id)) return s
      const isCapital = s.id === capitalSettlementId
      return {
        ...s,
        factionId,
        vassalLiegeSettlementId: isCapital ? null : capitalSettlementId,
      }
    })
    const emerged = {
      kind: HISTORY_KIND_FACTION_EMERGED,
      epoch: next.epoch,
      factionId,
      capitalSettlementId,
      cause: 'component_mint',
      componentKey: mint.componentKey,
    }
    historyLog.push(emerged)
    events.push(emerged)
  }

  next = {
    ...next,
    factions,
    settlements,
    historyLog,
    pendingComponentMints: remaining,
  }
  return { slice: next, events }
}

/**
 * @param {string[]} livingIds
 * @param {object[]} settlements
 */
function pickCapitalId(livingIds, settlements) {
  const ranked = [...livingIds].sort((a, b) => {
    const sa = settlements.find((s) => s.id === a)
    const sb = settlements.find((s) => s.id === b)
    const tierDelta = tierRank(sb) - tierRank(sa)
    if (tierDelta !== 0) return tierDelta
    const popDelta = (sb?.population ?? 0) - (sa?.population ?? 0)
    if (popDelta !== 0) return popDelta
    return a < b ? -1 : a > b ? 1 : 0
  })
  return ranked[0]
}

/**
 * @param {object | undefined} settlement
 */
function tierRank(settlement) {
  const tier = settlement?.tier
  if (tier === 'city') return 5
  if (tier === 'town') return 4
  if (tier === 'village') return 3
  if (tier === 'hamlet') return 2
  if (tier === 'outpost') return 1
  return 0
}

/**
 * @param {object} settlement
 */
function isTownTierOrHigher(settlement) {
  if (!settlement) return false
  return (
    settlement.tier === 'town' ||
    settlement.tier === 'city' ||
    (settlement.population ?? 0) >= 1000
  )
}

/**
 * @param {{ slice: import('../createDefaultColonizationSlice.js').ColonizationSlice }} params
 */
function applyCapitalSuccession(params) {
  let next = params.slice
  let factions = (next.factions ?? []).map((f) => ({
    ...f,
    settlementIds: [...f.settlementIds],
  }))
  let settlements = next.settlements.map((s) => ({ ...s }))
  let changed = false

  for (const faction of factions) {
    if (faction.status !== 'active') continue
    const capital = settlements.find((s) => s.id === faction.capitalSettlementId)
    const capitalLiving =
      capital && capital.status !== 'ruin' && (capital.population ?? 0) > 0
    if (capitalLiving) continue

    const livingIds = faction.settlementIds.filter((id) => {
      const s = settlements.find((row) => row.id === id)
      return s && s.status !== 'ruin' && (s.population ?? 0) > 0
    })
    if (livingIds.length === 0) continue

    const newCapitalId = pickCapitalId(livingIds, settlements)
    faction.capitalSettlementId = newCapitalId
    settlements = settlements.map((s) => {
      if (s.factionId !== faction.id) return s
      if (s.id === newCapitalId) {
        return { ...s, vassalLiegeSettlementId: null }
      }
      if (s.vassalLiegeSettlementId === capital?.id || !s.vassalLiegeSettlementId) {
        return { ...s, vassalLiegeSettlementId: newCapitalId }
      }
      return s
    })
    changed = true
  }

  if (!changed) return { slice: next }
  return { slice: { ...next, factions, settlements } }
}

/**
 * @param {{
 *   slice: import('../createDefaultColonizationSlice.js').ColonizationSlice,
 *   worldDocument: object,
 *   survivalBySettlementId: Record<string, object>,
 * }} params
 */
function resolveLoneUnaligned(params) {
  let next = params.slice
  const events = []
  const pendingIds = new Set(
    (next.pendingComponentMints ?? []).flatMap((mint) => mint.settlementIds),
  )
  /** @type {Record<string, number>} */
  const viability = { ...(next.unalignedViabilityStreak ?? {}) }

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

  const loneUnaligned = next.settlements.filter(
    (s) =>
      s.status !== 'ruin' &&
      (s.population ?? 0) > 0 &&
      !s.factionId &&
      !pendingIds.has(s.id),
  )

  for (const settlement of loneUnaligned) {
    const survival = params.survivalBySettlementId[settlement.id]
    const dependsOn =
      typeof survival?.dependsOnFactionId === 'string' ? survival.dependsOnFactionId : null

    if (dependsOn) {
      const target = (next.factions ?? []).find((f) => f.id === dependsOn && f.status === 'active')
      if (target) {
        const absorbed = reabsorbUnaligned({
          slice: next,
          settlementId: settlement.id,
          targetFactionId: target.id,
          capitalSettlementId: target.capitalSettlementId,
        })
        next = absorbed.slice
        events.push(...absorbed.events)
        delete viability[settlement.id]
        continue
      }
    }

    const adjacent = findAdjacentFaction({
      settlementId: settlement.id,
      currentFactionId: '',
      settlements: next.settlements,
      componentBySettlement,
    })
    if (adjacent && survival?.ok === false) {
      const target = next.factions.find((f) => f.id === adjacent.factionId)
      const absorbed = reabsorbUnaligned({
        slice: next,
        settlementId: settlement.id,
        targetFactionId: adjacent.factionId,
        capitalSettlementId: target?.capitalSettlementId ?? adjacent.settlementId,
      })
      next = absorbed.slice
      events.push(...absorbed.events)
      delete viability[settlement.id]
      continue
    }

    if (isTownTierOrHigher(settlement)) {
      viability[settlement.id] = (viability[settlement.id] ?? 0) + 1
    } else {
      viability[settlement.id] = 0
    }

    if (
      (viability[settlement.id] ?? 0) >= UNALIGNED_CRYSTALLIZE_EPOCHS &&
      isTownTierOrHigher(settlement)
    ) {
      const factionId = `faction-${settlement.id}-unaligned-${next.epoch}`
      const minted = createActiveFactionRecord({
        id: factionId,
        capitalSettlementId: settlement.id,
        settlementIds: [settlement.id],
        emergedEpoch: next.epoch,
        factions: next.factions ?? [],
      })
      if (!minted) {
        // At cap: prefer join-first when an adjacent faction exists; else hold streak.
        if (adjacent) {
          const target = next.factions.find((f) => f.id === adjacent.factionId)
          const absorbed = reabsorbUnaligned({
            slice: next,
            settlementId: settlement.id,
            targetFactionId: adjacent.factionId,
            capitalSettlementId: target?.capitalSettlementId ?? adjacent.settlementId,
          })
          next = absorbed.slice
          events.push(...absorbed.events)
          delete viability[settlement.id]
        }
        continue
      }
      const factions = [...(next.factions ?? []), minted]
      const settlements = next.settlements.map((s) =>
        s.id === settlement.id ? { ...s, factionId, vassalLiegeSettlementId: null } : s,
      )
      const emerged = {
        kind: HISTORY_KIND_FACTION_EMERGED,
        epoch: next.epoch,
        factionId,
        capitalSettlementId: settlement.id,
        cause: 'unaligned_crystallize',
      }
      next = {
        ...next,
        factions,
        settlements,
        historyLog: [...(next.historyLog ?? []), emerged],
      }
      events.push(emerged)
      delete viability[settlement.id]
    }
  }

  next = { ...next, unalignedViabilityStreak: viability }
  return { slice: next, events }
}

/**
 * @param {{
 *   slice: import('../createDefaultColonizationSlice.js').ColonizationSlice,
 *   settlementId: string,
 *   targetFactionId: string,
 *   capitalSettlementId: string,
 * }} params
 */
function reabsorbUnaligned(params) {
  const events = []
  let next = params.slice
  const factions = (next.factions ?? []).map((f) => {
    if (f.id !== params.targetFactionId) return { ...f, settlementIds: [...f.settlementIds] }
    if (f.settlementIds.includes(params.settlementId)) {
      return { ...f, settlementIds: [...f.settlementIds] }
    }
    return { ...f, settlementIds: [...f.settlementIds, params.settlementId] }
  })
  const settlements = next.settlements.map((s) =>
    s.id === params.settlementId
      ? {
          ...s,
          factionId: params.targetFactionId,
          vassalLiegeSettlementId: params.capitalSettlementId,
        }
      : s,
  )
  const entry = {
    kind: HISTORY_KIND_FACTION_ABSORPTION,
    epoch: next.epoch,
    absorbedFactionId: null,
    survivorFactionId: params.targetFactionId,
    settlementId: params.settlementId,
    cause: 'unaligned_reabsorb',
  }
  next = {
    ...next,
    factions,
    settlements,
    historyLog: [...(next.historyLog ?? []), entry],
    membershipCooldown: [
      ...(next.membershipCooldown ?? []),
      {
        subjectId: params.settlementId,
        untilEpoch: next.epoch + MEMBERSHIP_REFRACTORY_EPOCHS,
        kind: HISTORY_KIND_FACTION_ABSORPTION,
      },
    ],
  }
  events.push(entry)
  return { slice: next, events }
}
