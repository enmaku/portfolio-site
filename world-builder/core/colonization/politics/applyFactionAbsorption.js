/**
 * Faction absorption (asymmetric / mutual / war) and empty-faction extinction.
 * Domain: world-builder/CONTEXT.md — Faction absorption.
 */

import { computeLogisticsConnectivityComponents } from './computeLogisticsConnectivityComponents.js'
import {
  HISTORY_KIND_FACTION_ABSORPTION,
  HISTORY_KIND_FACTION_EXTINCT,
} from './historyKinds.js'
import { ABSORPTION_SUSTAINED_EPOCHS, MEMBERSHIP_REFRACTORY_EPOCHS } from './politicsConstants.js'
import { transferRivalryOnAbsorb } from './rivalryEdges.js'

/**
 * @param {{
 *   slice: import('../createDefaultColonizationSlice.js').ColonizationSlice,
 *   worldDocument: object,
 *   survivalBySettlementId?: Record<string, object>,
 *   warOutcomes?: Array<{ loserFactionId: string, winnerFactionId: string }>,
 * }} params
 * @returns {{
 *   slice: import('../createDefaultColonizationSlice.js').ColonizationSlice,
 *   events: object[],
 * }}
 */
export function applyFactionAbsorption(params) {
  let next = params.slice
  const events = []

  if (next.increment3LatchedEpoch == null) {
    return { slice: next, events }
  }

  const warApplied = applyWarOutcomes({
    slice: next,
    warOutcomes: params.warOutcomes ?? [],
  })
  next = warApplied.slice
  events.push(...warApplied.events)

  const streaked = updateDependenceStreaks({
    slice: next,
    worldDocument: params.worldDocument,
    survivalBySettlementId: params.survivalBySettlementId ?? {},
  })
  next = streaked.slice

  const asymmetric = applyAsymmetricAbsorptions({ slice: next })
  next = asymmetric.slice
  events.push(...asymmetric.events)

  const mutual = applyMutualReintegrations({ slice: next })
  next = mutual.slice
  events.push(...mutual.events)

  const extinct = extinguishEmptyFactions({ slice: next })
  next = extinct.slice
  events.push(...extinct.events)

  return { slice: next, events }
}

/**
 * @param {{
 *   slice: import('../createDefaultColonizationSlice.js').ColonizationSlice,
 *   warOutcomes: Array<{ loserFactionId: string, winnerFactionId: string }>,
 * }} params
 */
function applyWarOutcomes(params) {
  let next = params.slice
  const events = []
  for (const outcome of params.warOutcomes) {
    if (!outcome?.loserFactionId || !outcome?.winnerFactionId) continue
    if (outcome.loserFactionId === outcome.winnerFactionId) continue
    const absorbed = absorbFaction({
      slice: next,
      loserFactionId: outcome.loserFactionId,
      survivorFactionId: outcome.winnerFactionId,
      cause: 'war',
    })
    next = absorbed.slice
    events.push(...absorbed.events)
  }
  return { slice: next, events }
}

/**
 * @param {{
 *   slice: import('../createDefaultColonizationSlice.js').ColonizationSlice,
 *   worldDocument: object,
 *   survivalBySettlementId: Record<string, object>,
 * }} params
 */
function updateDependenceStreaks(params) {
  const next = params.slice
  /** @type {Record<string, number>} */
  const dependence = { ...(next.factionDependenceStreak ?? {}) }
  /** @type {Record<string, number>} */
  const mutual = { ...(next.mutualReintegrationStreak ?? {}) }

  const activeFactions = (next.factions ?? []).filter((f) => f.status === 'active')
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

  /** @type {Set<string>} */
  const seenDependence = new Set()
  for (const settlement of next.settlements) {
    if (settlement.status === 'ruin' || !settlement.factionId) continue
    const survival = params.survivalBySettlementId[settlement.id]
    const dependsOn = survival?.dependsOnFactionId
    if (
      typeof dependsOn === 'string' &&
      dependsOn !== settlement.factionId &&
      survival?.ok === false
    ) {
      const key = `${settlement.factionId}->${dependsOn}`
      seenDependence.add(key)
      dependence[key] = (dependence[key] ?? 0) + 1
    }
  }
  for (const key of Object.keys(dependence)) {
    if (!seenDependence.has(key)) dependence[key] = 0
  }

  /** @type {Set<string>} */
  const seenMutual = new Set()
  for (let i = 0; i < activeFactions.length; i += 1) {
    for (let j = i + 1; j < activeFactions.length; j += 1) {
      const a = activeFactions[i]
      const b = activeFactions[j]
      const aMember = next.settlements.find((s) => s.id === a.capitalSettlementId)
      const bMember = next.settlements.find((s) => s.id === b.capitalSettlementId)
      if (!aMember || !bMember) continue
      const sameComponent =
        componentBySettlement.get(aMember.id) != null &&
        componentBySettlement.get(aMember.id) === componentBySettlement.get(bMember.id)
      if (!sameComponent) continue

      const aSurvival = params.survivalBySettlementId[aMember.id]
      const bSurvival = params.survivalBySettlementId[bMember.id]
      const aDepends = aSurvival?.tradeDependenceOnFactionId === b.id
      const bDepends = bSurvival?.tradeDependenceOnFactionId === a.id
      if (!(aDepends && bDepends)) continue

      const key = [a.id, b.id].sort().join('|')
      seenMutual.add(key)
      mutual[key] = (mutual[key] ?? 0) + 1
    }
  }
  for (const key of Object.keys(mutual)) {
    if (!seenMutual.has(key)) mutual[key] = 0
  }

  // Preserve explicitly seeded streaks when survival signals are absent (tests / hooks).
  const seededDependence = next.factionDependenceStreak ?? {}
  const seededMutual = next.mutualReintegrationStreak ?? {}
  for (const [key, value] of Object.entries(seededDependence)) {
    if (!seenDependence.has(key) && value >= ABSORPTION_SUSTAINED_EPOCHS) {
      dependence[key] = value
    }
  }
  for (const [key, value] of Object.entries(seededMutual)) {
    if (!seenMutual.has(key) && value >= ABSORPTION_SUSTAINED_EPOCHS) {
      mutual[key] = value
    }
  }

  return {
    slice: {
      ...next,
      factionDependenceStreak: dependence,
      mutualReintegrationStreak: mutual,
    },
  }
}

/**
 * @param {{ slice: import('../createDefaultColonizationSlice.js').ColonizationSlice }} params
 */
function applyAsymmetricAbsorptions(params) {
  let next = params.slice
  const events = []
  const streaks = next.factionDependenceStreak ?? {}
  for (const [key, streak] of Object.entries(streaks)) {
    if (streak < ABSORPTION_SUSTAINED_EPOCHS) continue
    const [weakId, strongId] = key.split('->')
    if (!weakId || !strongId) continue
    const weak = next.factions.find((f) => f.id === weakId && f.status === 'active')
    const strong = next.factions.find((f) => f.id === strongId && f.status === 'active')
    if (!weak || !strong) continue
    const absorbed = absorbFaction({
      slice: next,
      loserFactionId: weakId,
      survivorFactionId: strongId,
      cause: 'asymmetric_dependence',
    })
    next = absorbed.slice
    events.push(...absorbed.events)
  }
  return { slice: next, events }
}

/**
 * @param {{ slice: import('../createDefaultColonizationSlice.js').ColonizationSlice }} params
 */
function applyMutualReintegrations(params) {
  let next = params.slice
  const events = []
  const streaks = next.mutualReintegrationStreak ?? {}
  for (const [key, streak] of Object.entries(streaks)) {
    if (streak < ABSORPTION_SUSTAINED_EPOCHS) continue
    const [idA, idB] = key.split('|')
    const factionA = next.factions.find((f) => f.id === idA && f.status === 'active')
    const factionB = next.factions.find((f) => f.id === idB && f.status === 'active')
    if (!factionA || !factionB) continue
    const survivor =
      factionA.emergedEpoch < factionB.emergedEpoch
        ? factionA
        : factionB.emergedEpoch < factionA.emergedEpoch
          ? factionB
          : factionA.id < factionB.id
            ? factionA
            : factionB
    const loser = survivor.id === factionA.id ? factionB : factionA
    const absorbed = absorbFaction({
      slice: next,
      loserFactionId: loser.id,
      survivorFactionId: survivor.id,
      cause: 'mutual_reintegration',
    })
    next = absorbed.slice
    events.push(...absorbed.events)
  }
  return { slice: next, events }
}

/**
 * @param {{
 *   slice: import('../createDefaultColonizationSlice.js').ColonizationSlice,
 *   loserFactionId: string,
 *   survivorFactionId: string,
 *   cause: string,
 * }} params
 */
function absorbFaction(params) {
  const events = []
  let next = params.slice
  const loser = next.factions.find((f) => f.id === params.loserFactionId && f.status === 'active')
  const survivor = next.factions.find(
    (f) => f.id === params.survivorFactionId && f.status === 'active',
  )
  if (!loser || !survivor) return { slice: next, events }

  const memberIds = [...loser.settlementIds]
  let factions = (next.factions ?? []).map((f) => {
    if (f.id === loser.id) {
      return { ...f, status: /** @type {const} */ ('extinct'), settlementIds: [] }
    }
    if (f.id === survivor.id) {
      const merged = new Set([...f.settlementIds, ...memberIds])
      return { ...f, settlementIds: [...merged] }
    }
    return { ...f, settlementIds: [...f.settlementIds] }
  })

  const settlements = next.settlements.map((s) => {
    if (!memberIds.includes(s.id)) return s
    return {
      ...s,
      factionId: survivor.id,
      vassalLiegeSettlementId: survivor.capitalSettlementId,
    }
  })

  const historyEntry = {
    kind: HISTORY_KIND_FACTION_ABSORPTION,
    epoch: next.epoch,
    absorbedFactionId: loser.id,
    survivorFactionId: survivor.id,
    cause: params.cause,
  }
  const extinctEntry = {
    kind: HISTORY_KIND_FACTION_EXTINCT,
    epoch: next.epoch,
    factionId: loser.id,
    cause: params.cause,
  }

  const membershipCooldown = [
    ...(next.membershipCooldown ?? []),
    ...memberIds.map((subjectId) => ({
      subjectId,
      untilEpoch: next.epoch + MEMBERSHIP_REFRACTORY_EPOCHS,
      kind: HISTORY_KIND_FACTION_ABSORPTION,
    })),
  ]

  next = {
    ...next,
    factions,
    settlements,
    historyLog: [...(next.historyLog ?? []), historyEntry, extinctEntry],
    membershipCooldown,
    rivalryEdges: transferRivalryOnAbsorb(next.rivalryEdges ?? [], {
      loserFactionId: loser.id,
      survivorFactionId: survivor.id,
      createdEpoch: next.epoch,
    }),
  }
  events.push(historyEntry, extinctEntry)
  return { slice: next, events }
}

/**
 * @param {{ slice: import('../createDefaultColonizationSlice.js').ColonizationSlice }} params
 */
function extinguishEmptyFactions(params) {
  let next = params.slice
  const events = []
  const livingByFaction = new Map()
  for (const settlement of next.settlements) {
    if (settlement.status === 'ruin' || !settlement.factionId) continue
    if ((settlement.population ?? 0) <= 0) continue
    livingByFaction.set(
      settlement.factionId,
      (livingByFaction.get(settlement.factionId) ?? 0) + 1,
    )
  }

  let factions = [...(next.factions ?? [])]
  let historyLog = [...(next.historyLog ?? [])]
  factions = factions.map((faction) => {
    if (faction.status !== 'active') return faction
    if ((livingByFaction.get(faction.id) ?? 0) > 0) return faction
    const entry = {
      kind: HISTORY_KIND_FACTION_EXTINCT,
      epoch: next.epoch,
      factionId: faction.id,
      cause: 'no_living_members',
    }
    historyLog.push(entry)
    events.push(entry)
    return { ...faction, status: /** @type {const} */ ('extinct'), settlementIds: [] }
  })

  next = { ...next, factions, historyLog }
  return { slice: next, events }
}
