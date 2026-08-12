/**
 * Mid-run strategic overstretch hinterland peel.
 * Domain: world-builder/CONTEXT.md — Strategic overstretch.
 */

import {
  buildLandAdminAdjacency,
  landHopsBetween,
} from './landAdminSettlementGraph.js'
import { HISTORY_KIND_FACTION_EMERGED } from './historyKinds.js'
import {
  MEMBERSHIP_REFRACTORY_EPOCHS,
  OVERSTRETCH_STREAK_EPOCHS,
} from './politicsConstants.js'
import { createActiveFactionRecord } from './factionCap.js'
import { openLegacyRivalry } from './rivalryEdges.js'

/**
 * @param {{
 *   slice: import('../createDefaultColonizationSlice.js').ColonizationSlice,
 *   worldDocument: object,
 *   graphCache?: import('../tradeGraph/candidateTradeGraphCache.js').CandidateTradeGraphCache,
 * }} params
 * @returns {{
 *   slice: import('../createDefaultColonizationSlice.js').ColonizationSlice,
 *   events: object[],
 * }}
 */
export function applyStrategicOverstretchPeel(params) {
  let next = params.slice
  const events = []
  const span = Number(next.colonistSettings?.strategicOverstretchSpan)
  if (!(span > 0)) return { slice: next, events }

  const living = next.settlements.filter(
    (s) => s.status !== 'ruin' && (s.population === undefined || s.population > 0),
  )
  const adjacency = buildLandAdminAdjacency({
    settlements: living,
    worldDocument: params.worldDocument,
    threeDayHaulDistance: next.colonistSettings.threeDayHaulDistance,
    roads: next.roads,
    inlandSailExpeditionRange:
      next.colonistSettings.inlandSailExpeditionRange *
      next.colonistSettings.threeDayHaulDistance,
    graphCache: params.graphCache,
  })

  /** @type {Record<string, number>} */
  const streaks = { ...(next.factionOverstretchStreak ?? {}) }
  const cooldownBlocked = new Set(
    (next.membershipCooldown ?? [])
      .filter((row) => row.untilEpoch >= next.epoch)
      .map((row) => row.subjectId),
  )

  const activeFactions = (next.factions ?? []).filter((f) => f.status === 'active')
  for (const factionId of activeFactions.map((f) => f.id)) {
    const faction = (next.factions ?? []).find((f) => f.id === factionId && f.status === 'active')
    if (!faction) continue
    if (cooldownBlocked.has(faction.id)) {
      streaks[faction.id] = 0
      continue
    }
    const members = (next.settlements ?? []).filter(
      (s) =>
        s.factionId === faction.id &&
        s.status !== 'ruin' &&
        (s.population === undefined || s.population > 0),
    )
    if (members.length > span) {
      streaks[faction.id] = (streaks[faction.id] ?? 0) + 1
    } else {
      streaks[faction.id] = 0
      continue
    }
    if ((streaks[faction.id] ?? 0) < OVERSTRETCH_STREAK_EPOCHS) continue

    const capital = members.find((s) => s.id === faction.capitalSettlementId) ?? members[0]
    if (!capital) continue
    const towns = members.filter((m) => m.id !== capital.id && isTownTierOrHigher(m))
    if (!towns.length) continue

    towns.sort((a, b) => {
      const ha = landHopsBetween(adjacency, a.id, capital.id)
      const hb = landHopsBetween(adjacency, b.id, capital.id)
      const aFinite = Number.isFinite(ha)
      const bFinite = Number.isFinite(hb)
      if (aFinite && bFinite) return hb - ha
      if (aFinite) return -1
      if (bFinite) return 1
      return dist(b, capital) - dist(a, capital)
    })
    const seed = towns[0]

    const branch = members.filter((m) => {
      if (m.id === seed.id) return true
      const hs = landHopsBetween(adjacency, m.id, seed.id)
      const hc = landHopsBetween(adjacency, m.id, capital.id)
      if (Number.isFinite(hs) && Number.isFinite(hc)) return hs < hc
      return dist(m, seed) < dist(m, capital)
    })
    if (branch.length < 2) continue
    if (branch.length >= members.length) continue

    const branchIds = new Set(branch.map((m) => m.id))
    const parentRemainder = members.filter((m) => !branchIds.has(m.id))
    if (parentRemainder.length < 1) continue

    const newFactionId = `faction-${seed.id}-overstretch-${next.epoch}`
    const peeled = applyPeelMint({
      slice: next,
      parentFactionId: faction.id,
      capitalSettlementId: seed.id,
      memberIds: [...branchIds],
      newFactionId,
    })
    next = peeled.slice
    events.push(...peeled.events)
    streaks[faction.id] = 0
    if (peeled.mintedFactionId) {
      streaks[peeled.mintedFactionId] = 0
      cooldownBlocked.add(peeled.mintedFactionId)
    }
    cooldownBlocked.add(faction.id)
  }

  // Drop streaks for extinct / missing factions
  for (const id of Object.keys(streaks)) {
    if (!(next.factions ?? []).some((f) => f.id === id && f.status === 'active')) {
      delete streaks[id]
    }
  }

  return {
    slice: {
      ...next,
      factionOverstretchStreak: Object.fromEntries(
        Object.entries(streaks).filter(([, v]) => v > 0),
      ),
    },
    events,
  }
}

/**
 * @param {{
 *   slice: import('../createDefaultColonizationSlice.js').ColonizationSlice,
 *   parentFactionId: string,
 *   capitalSettlementId: string,
 *   memberIds: string[],
 *   newFactionId: string,
 * }} params
 */
function applyPeelMint(params) {
  const { slice, parentFactionId, capitalSettlementId, memberIds, newFactionId } = params
  const memberSet = new Set(memberIds)
  const events = []

  const factions = (slice.factions ?? []).map((f) => {
    if (f.id !== parentFactionId) return { ...f, settlementIds: [...f.settlementIds] }
    return {
      ...f,
      settlementIds: f.settlementIds.filter((id) => !memberSet.has(id)),
    }
  })

  const minted = createActiveFactionRecord({
    id: newFactionId,
    capitalSettlementId,
    settlementIds: [...memberIds],
    emergedEpoch: slice.epoch,
    factions,
  })

  let rivalryEdges = slice.rivalryEdges ?? []
  let membershipCooldown = [...(slice.membershipCooldown ?? [])]
  let historyLog = [...(slice.historyLog ?? [])]
  let settlements

  if (minted) {
    factions.push(minted)
    settlements = slice.settlements.map((s) => {
      if (!memberSet.has(s.id)) return s
      return {
        ...s,
        factionId: newFactionId,
        vassalLiegeSettlementId: s.id === capitalSettlementId ? null : capitalSettlementId,
      }
    })
    const historyEntry = {
      kind: HISTORY_KIND_FACTION_EMERGED,
      epoch: slice.epoch,
      factionId: newFactionId,
      capitalSettlementId,
      cause: 'strategic_overstretch_peel',
      parentFactionId,
    }
    events.push(historyEntry)
    historyLog.push(historyEntry)
    rivalryEdges = openLegacyRivalry(rivalryEdges, {
      aFactionId: parentFactionId,
      bFactionId: newFactionId,
      cause: 'legacy',
      createdEpoch: slice.epoch,
    })
    membershipCooldown.push(
      {
        subjectId: parentFactionId,
        untilEpoch: slice.epoch + MEMBERSHIP_REFRACTORY_EPOCHS,
        kind: 'strategic_overstretch',
      },
      {
        subjectId: newFactionId,
        untilEpoch: slice.epoch + MEMBERSHIP_REFRACTORY_EPOCHS,
        kind: 'strategic_overstretch',
      },
    )
  } else {
    // At cap: peel hinterland to unaligned; crystallize when a slot frees.
    settlements = slice.settlements.map((s) => {
      if (!memberSet.has(s.id)) return s
      return {
        ...s,
        factionId: null,
        vassalLiegeSettlementId: null,
      }
    })
    membershipCooldown.push({
      subjectId: parentFactionId,
      untilEpoch: slice.epoch + MEMBERSHIP_REFRACTORY_EPOCHS,
      kind: 'strategic_overstretch',
    })
  }

  return {
    slice: {
      ...slice,
      factions,
      settlements,
      rivalryEdges,
      membershipCooldown,
      historyLog,
    },
    events,
    mintedFactionId: minted?.id ?? null,
  }
}

/**
 * @param {object | undefined} settlement
 */
function isTownTierOrHigher(settlement) {
  return (
    settlement &&
    (settlement.tier === 'town' ||
      settlement.tier === 'city' ||
      settlement.tier === 'drain_city' ||
      settlement.tier === 'capital')
  )
}

/**
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 */
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
