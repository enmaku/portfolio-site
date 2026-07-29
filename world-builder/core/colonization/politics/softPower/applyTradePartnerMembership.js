/**
 * Peaceful trade-partner join and commercial peel.
 * Domain: world-builder/CONTEXT.md — Trade partner; Soft power.
 */

import {
  HISTORY_KIND_FACTION_EXTINCT,
  HISTORY_KIND_TRADE_PARTNER_JOIN,
  HISTORY_KIND_TRADE_PARTNER_PEEL,
} from '../historyKinds.js'
import {
  MEMBERSHIP_REFRACTORY_EPOCHS,
} from '../politicsConstants.js'
import {
  SOFT_POWER_CLEAR_AND_REARM_EPOCHS,
  SOFT_POWER_REFRACTORY_EPOCHS,
} from './softPowerStreaks.js'

/**
 * @param {{ slice: import('../../createDefaultColonizationSlice.js').ColonizationSlice }} params
 */
export function applyPeacefulTradePartnerJoins(params) {
  let next = params.slice
  const events = []
  const eligible = { ...(next.softPowerJoinEligibleBySettlementId ?? {}) }
  const paint = { ...(next.softPowerPaintBySettlementId ?? {}) }
  const recentJoin = { ...(next.recentTradePartnerJoinBySettlementId ?? {}) }

  for (const [settlementId, factionId] of Object.entries(eligible)) {
    const settlement = next.settlements.find((s) => s.id === settlementId)
    if (!settlement || settlement.status === 'ruin') {
      delete eligible[settlementId]
      continue
    }
    if ((settlement.population ?? 0) <= 0) {
      delete eligible[settlementId]
      continue
    }
    // Survival dependence reabsorb wins earlier; only map-gray / singleton seats join.
    if (settlement.factionId && !isSingletonCapital(settlement, next)) {
      delete eligible[settlementId]
      continue
    }
    const target = (next.factions ?? []).find((f) => f.id === factionId && f.status === 'active')
    if (!target) {
      delete eligible[settlementId]
      continue
    }

    const priorFactionId = settlement.factionId
    let factions = (next.factions ?? []).map((f) => {
      if (f.id !== factionId) return { ...f, settlementIds: [...(f.settlementIds ?? [])] }
      const ids = f.settlementIds.includes(settlementId)
        ? [...f.settlementIds]
        : [...f.settlementIds, settlementId]
      return { ...f, settlementIds: ids }
    })

    const settlements = next.settlements.map((s) =>
      s.id === settlementId
        ? {
            ...s,
            factionId,
            isTradePartner: true,
            vassalLiegeSettlementId: null,
          }
        : s,
    )

    if (priorFactionId && priorFactionId !== factionId) {
      factions = factions.map((f) => {
        if (f.id !== priorFactionId) return f
        const settlementIds = (f.settlementIds ?? []).filter((id) => id !== settlementId)
        if (settlementIds.length === 0) {
          return { ...f, settlementIds, status: 'extinct' }
        }
        return { ...f, settlementIds }
      })
      const extinct = factions.find((f) => f.id === priorFactionId && f.status === 'extinct')
      if (extinct) {
        const extinctEvent = {
          kind: HISTORY_KIND_FACTION_EXTINCT,
          epoch: next.epoch,
          factionId: priorFactionId,
          cause: 'trade_partner_join',
        }
        events.push(extinctEvent)
        next = {
          ...next,
          historyLog: [...(next.historyLog ?? []), extinctEvent],
        }
      }
    }

    const joinEvent = {
      kind: HISTORY_KIND_TRADE_PARTNER_JOIN,
      epoch: next.epoch,
      settlementId,
      factionId,
      cause: 'soft_power_peaceful',
    }
    events.push(joinEvent)
    recentJoin[settlementId] = { joinedEpoch: next.epoch, factionId }
    delete eligible[settlementId]
    delete paint[settlementId]

    next = {
      ...next,
      factions,
      settlements,
      historyLog: [...(next.historyLog ?? []), joinEvent],
      softPowerJoinEligibleBySettlementId: eligible,
      softPowerPaintBySettlementId: paint,
      softPowerJoinHoldStreak: omitKey(next.softPowerJoinHoldStreak, settlementId),
      softPowerPaintStreak: omitKey(next.softPowerPaintStreak, settlementId),
      recentTradePartnerJoinBySettlementId: recentJoin,
      membershipCooldown: [
        ...(next.membershipCooldown ?? []),
        {
          subjectId: settlementId,
          untilEpoch: next.epoch + SOFT_POWER_REFRACTORY_EPOCHS,
          kind: 'trade_partner_join',
        },
      ],
    }
  }

  next = {
    ...next,
    softPowerJoinEligibleBySettlementId: eligible,
    softPowerPaintBySettlementId: paint,
    recentTradePartnerJoinBySettlementId: recentJoin,
  }
  return { slice: next, events }
}

/**
 * Peel trade partners when host commercial dominance has cleared long enough.
 * Rival dominance peels to unaligned (no one-step hop).
 *
 * @param {{
 *   slice: import('../../createDefaultColonizationSlice.js').ColonizationSlice,
 *   scores?: Record<string, { dominantFactionId?: string | null }>,
 *   clearAndRearmEpochs?: number,
 * }} params
 */
export function applyTradePartnerPeels(params) {
  let next = params.slice
  const events = []
  const scores = params.scores ?? {}
  const clearNeed = params.clearAndRearmEpochs ?? SOFT_POWER_CLEAR_AND_REARM_EPOCHS
  /** @type {Record<string, number>} */
  const peelClear = { ...(next.tradePartnerPeelClearStreak ?? {}) }

  for (const settlement of [...next.settlements]) {
    if (settlement.status === 'ruin') continue
    if (!settlement.isTradePartner || !settlement.factionId) continue
    const hostId = settlement.factionId
    const dominant = scores[settlement.id]?.dominantFactionId ?? null
    const hostStillDominant = dominant === hostId

    if (hostStillDominant) {
      delete peelClear[settlement.id]
      continue
    }

    peelClear[settlement.id] = (peelClear[settlement.id] ?? 0) + 1
    if (peelClear[settlement.id] < clearNeed) continue

    const settlementId = settlement.id
    const factions = (next.factions ?? []).map((f) => {
      if (f.id !== hostId) return f
      return {
        ...f,
        settlementIds: (f.settlementIds ?? []).filter((id) => id !== settlementId),
      }
    })
    const settlements = next.settlements.map((s) =>
      s.id === settlementId
        ? {
            ...s,
            factionId: null,
            isTradePartner: false,
            vassalLiegeSettlementId: null,
          }
        : s,
    )
    const peelEvent = {
      kind: HISTORY_KIND_TRADE_PARTNER_PEEL,
      epoch: next.epoch,
      settlementId,
      priorFactionId: hostId,
      cause: 'commercial_dominance_cleared',
    }
    events.push(peelEvent)
    delete peelClear[settlementId]

    next = {
      ...next,
      factions,
      settlements,
      historyLog: [...(next.historyLog ?? []), peelEvent],
      membershipCooldown: [
        ...(next.membershipCooldown ?? []),
        {
          subjectId: settlementId,
          untilEpoch: next.epoch + (MEMBERSHIP_REFRACTORY_EPOCHS || SOFT_POWER_REFRACTORY_EPOCHS),
          kind: 'trade_partner_peel',
        },
      ],
    }
  }

  next = { ...next, tradePartnerPeelClearStreak: peelClear }
  return { slice: next, events }
}

/**
 * @param {object} settlement
 * @param {import('../../createDefaultColonizationSlice.js').ColonizationSlice} slice
 */
function isSingletonCapital(settlement, slice) {
  if (!settlement.factionId) return false
  const living = (slice.settlements ?? []).filter(
    (s) =>
      s &&
      s.factionId === settlement.factionId &&
      s.status !== 'ruin' &&
      (s.population === undefined || s.population > 0),
  )
  return living.length === 1 && living[0].id === settlement.id
}

/**
 * @param {Record<string, number> | null | undefined} map
 * @param {string} key
 */
function omitKey(map, key) {
  const next = { ...(map ?? {}) }
  delete next[key]
  return next
}

/**
 * Survival / corridor dependence upgrades a trade partner into a taxed vassal.
 *
 * @param {{
 *   slice: import('../../createDefaultColonizationSlice.js').ColonizationSlice,
 *   survivalBySettlementId?: Record<string, { dependsOnFactionId?: string | null, ok?: boolean }>,
 * }} params
 */
export function upgradeTradePartnersOnSurvivalDependence(params) {
  let next = params.slice
  const survival = params.survivalBySettlementId ?? {}
  const events = []

  for (const settlement of next.settlements) {
    if (!settlement?.isTradePartner || !settlement.factionId) continue
    const dep = survival[settlement.id]
    const dependsOn =
      typeof dep?.dependsOnFactionId === 'string' ? dep.dependsOnFactionId : null
    if (!dependsOn || dependsOn !== settlement.factionId) continue
    const faction = (next.factions ?? []).find(
      (f) => f.id === settlement.factionId && f.status === 'active',
    )
    if (!faction) continue
    const settlementId = settlement.id
    const capitalSettlementId = faction.capitalSettlementId
    next = {
      ...next,
      settlements: next.settlements.map((s) =>
        s.id === settlementId
          ? {
              ...s,
              isTradePartner: false,
              vassalLiegeSettlementId: capitalSettlementId,
            }
          : s,
      ),
    }
  }

  return { slice: next, events }
}
