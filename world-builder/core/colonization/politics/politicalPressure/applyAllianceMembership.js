/**
 * Alliance membership from political pressure (join-existing vassal; peer mint).
 * Domain: world-builder/CONTEXT.md — Alliance; Political pressure; ADR 0022.
 */

import {
  HISTORY_KIND_ALLIANCE,
  HISTORY_KIND_FACTION_EMERGED,
  HISTORY_KIND_FACTION_EXTINCT,
} from '../historyKinds.js'
import {
  canMintNewFaction,
  countLivingFactionMembers,
  createActiveFactionRecord,
} from '../factionCap.js'
import {
  getPoliticalPressureTuning,
  DEFAULT_POLITICAL_PRESSURE_TUNING,
} from './politicalPressureTuning.js'
import { POLITICAL_PRESSURE_COOLDOWN_KIND } from './politicalPressureStreaks.js'

/**
 * @param {{
 *   slice: import('../../createDefaultColonizationSlice.js').ColonizationSlice,
 *   armedBySettlementId?: Record<string, string> | null,
 *   claimAdjacencyPairs?: Set<string> | null,
 *   corridorPairs?: Set<string> | null,
 *   gridWidth?: number,
 *   gridHeight?: number,
 * }} params
 * @returns {{ slice: import('../../createDefaultColonizationSlice.js').ColonizationSlice }}
 */
export function applyAllianceMembership(params) {
  const tuning = getPoliticalPressureTuning()
  const refractoryEpochs =
    tuning.refractoryEpochs ?? DEFAULT_POLITICAL_PRESSURE_TUNING.refractoryEpochs
  let next = params.slice
  const armed = {
    ...(params.armedBySettlementId ?? next.politicalPressureArmedBySettlementId ?? {}),
  }
  /** @type {Record<string, { allianceEpoch: number, factionId?: string | null, kind?: string | null }>} */
  const recentAlliance = {}
  /** @type {Set<string>} */
  const joinCommitted = new Set()

  const armedIds = Object.keys(armed).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  for (const subjectId of armedIds) {
    const factionId = armed[subjectId]
    if (typeof factionId !== 'string') continue
    const settlement = next.settlements.find((s) => s.id === subjectId)
    if (!isLiving(settlement)) continue

    const target = (next.factions ?? []).find((f) => f.id === factionId && f.status === 'active')
    if (!target) continue
    // Join-existing only into a multi-pin banner; singleton pressure stays for peer mint.
    if (countLivingFactionMembers(factionId, { settlements: next.settlements }) < 2) continue
    if (settlement.factionId === factionId) continue
    if (isMultiPinCapital(settlement, next)) continue
    if (!isJoinEligibleSubject(settlement, next)) continue

    const applied = seatAsAllianceVassal({
      slice: next,
      settlementId: subjectId,
      factionId,
      epoch: next.epoch,
    })
    next = clearPressureStateForSubject(applied.slice, subjectId)
    next = {
      ...next,
      membershipCooldown: [
        ...(next.membershipCooldown ?? []),
        {
          subjectId,
          untilEpoch: next.epoch + refractoryEpochs,
          kind: POLITICAL_PRESSURE_COOLDOWN_KIND,
        },
      ],
    }
    recentAlliance[subjectId] = {
      allianceEpoch: next.epoch,
      factionId,
      kind: 'join_existing',
    }
    joinCommitted.add(subjectId)
    delete armed[subjectId]
  }

  const claimPairs = params.claimAdjacencyPairs ?? new Set()
  const corridorPairs = params.corridorPairs ?? new Set()
  const clusters = buildFreePeerClusters({
    settlements: next.settlements,
    factions: next.factions,
    claimAdjacencyPairs: claimPairs,
    corridorPairs,
    excludeIds: joinCommitted,
  })

  for (const cluster of clusters) {
    if (cluster.length < 2) continue
    if (!canMintNewFaction(next.factions)) continue

    const capitalId = pickClusterCapital(cluster, next.settlements)
    if (!capitalId) continue

    const newFactionId = `faction-alliance-${capitalId}-${next.epoch}`
    const minted = createActiveFactionRecord({
      id: newFactionId,
      capitalSettlementId: capitalId,
      settlementIds: cluster,
      emergedEpoch: next.epoch,
      factions: next.factions,
      settlements: next.settlements,
    })
    if (!minted) continue

    const mintResult = seatPeerMintCluster({
      slice: next,
      cluster,
      capitalId,
      newFactionId,
      minted,
      epoch: next.epoch,
    })
    next = mintResult.slice

    for (const id of cluster) {
      joinCommitted.add(id)
      recentAlliance[id] = {
        allianceEpoch: next.epoch,
        factionId: newFactionId,
        kind: 'peer_mint',
      }
      delete armed[id]
      next = clearPressureStateForSubject(next, id)
    }

    next = {
      ...next,
      membershipCooldown: [
        ...(next.membershipCooldown ?? []),
        ...cluster.map((subjectId) => ({
          subjectId,
          untilEpoch: next.epoch + refractoryEpochs,
          kind: POLITICAL_PRESSURE_COOLDOWN_KIND,
        })),
      ],
    }
  }

  next = {
    ...next,
    politicalPressureArmedBySettlementId: armed,
    recentAllianceBySettlementId: {
      ...(next.recentAllianceBySettlementId ?? {}),
      ...recentAlliance,
    },
  }

  return { slice: next }
}

/**
 * @param {object | null | undefined} settlement
 */
function isLiving(settlement) {
  if (!settlement || settlement.status === 'ruin') return false
  if (settlement.population !== undefined && !(settlement.population > 0)) return false
  return true
}

/**
 * @param {object} settlement
 * @param {import('../../createDefaultColonizationSlice.js').ColonizationSlice} slice
 */
function isSingletonCapital(settlement, slice) {
  if (!settlement.factionId) return false
  const living = countLivingFactionMembers(settlement.factionId, { settlements: slice.settlements })
  if (living !== 1) return false
  const faction = (slice.factions ?? []).find((f) => f.id === settlement.factionId)
  return Boolean(faction && faction.capitalSettlementId === settlement.id)
}

/**
 * @param {object} settlement
 * @param {import('../../createDefaultColonizationSlice.js').ColonizationSlice} slice
 */
function isMultiPinCapital(settlement, slice) {
  if (!settlement.factionId) return false
  const faction = (slice.factions ?? []).find((f) => f.id === settlement.factionId)
  if (!faction || faction.capitalSettlementId !== settlement.id) return false
  return countLivingFactionMembers(settlement.factionId, { settlements: slice.settlements }) > 1
}

/**
 * @param {object} settlement
 * @param {import('../../createDefaultColonizationSlice.js').ColonizationSlice} slice
 */
function isJoinEligibleSubject(settlement, slice) {
  if (!settlement.factionId) return true
  if (isSingletonCapital(settlement, slice)) return true
  // Sticky non-capital members of another faction (vassal / ordinary / trade partner)
  const faction = (slice.factions ?? []).find((f) => f.id === settlement.factionId)
  if (!faction) return true
  return faction.capitalSettlementId !== settlement.id
}

/**
 * @param {object} settlement
 * @param {import('../../createDefaultColonizationSlice.js').ColonizationSlice} slice
 */
function isPeerMintEligible(settlement, slice) {
  if (!isLiving(settlement)) return false
  if (!settlement.factionId) return true
  return isSingletonCapital(settlement, slice)
}

/**
 * @param {{
 *   slice: object,
 *   settlementId: string,
 *   factionId: string,
 *   epoch: number,
 * }} params
 */
function seatAsAllianceVassal(params) {
  const winner = (params.slice.factions ?? []).find(
    (f) => f.id === params.factionId && f.status === 'active',
  )
  if (!winner) return { slice: params.slice }

  const stake = (params.slice.settlements ?? []).find((s) => s.id === params.settlementId)
  if (!stake || !isLiving(stake)) return { slice: params.slice }

  const priorFactionId = stake.factionId ?? null
  /** @type {object[]} */
  const events = []

  let factions = (params.slice.factions ?? []).map((faction) => {
    if (faction.id === params.factionId) {
      const settlementIds = faction.settlementIds.includes(params.settlementId)
        ? [...faction.settlementIds]
        : [...faction.settlementIds, params.settlementId]
      return { ...faction, settlementIds }
    }
    if (faction.id === priorFactionId) {
      const settlementIds = (faction.settlementIds ?? []).filter((id) => id !== params.settlementId)
      if (settlementIds.length === 0) {
        return { ...faction, settlementIds, status: 'extinct' }
      }
      return { ...faction, settlementIds }
    }
    return faction
  })

  const settlements = (params.slice.settlements ?? []).map((settlement) => {
    if (settlement.id !== params.settlementId) return settlement
    return {
      ...settlement,
      factionId: params.factionId,
      isTradePartner: false,
      vassalLiegeSettlementId: winner.capitalSettlementId,
    }
  })

  if (priorFactionId && priorFactionId !== params.factionId) {
    const extinct = factions.find((f) => f.id === priorFactionId && f.status === 'extinct')
    if (extinct) {
      events.push({
        kind: HISTORY_KIND_FACTION_EXTINCT,
        epoch: params.epoch,
        factionId: priorFactionId,
        cause: 'alliance',
      })
    }
  }

  events.push({
    kind: HISTORY_KIND_ALLIANCE,
    epoch: params.epoch,
    settlementId: params.settlementId,
    factionId: params.factionId,
    cause: 'join_existing',
  })

  return {
    slice: {
      ...params.slice,
      settlements,
      factions,
      historyLog: [...(params.slice.historyLog ?? []), ...events],
    },
  }
}

/**
 * @param {{
 *   slice: object,
 *   cluster: string[],
 *   capitalId: string,
 *   newFactionId: string,
 *   minted: object,
 *   epoch: number,
 * }} params
 */
function seatPeerMintCluster(params) {
  const { cluster, capitalId, newFactionId, minted, epoch } = params
  /** @type {object[]} */
  const events = []
  /** @type {Set<string>} */
  const priorFactionIds = new Set()

  for (const id of cluster) {
    const stake = params.slice.settlements.find((s) => s.id === id)
    if (stake?.factionId) priorFactionIds.add(stake.factionId)
  }

  let factions = (params.slice.factions ?? []).map((faction) => {
    if (!priorFactionIds.has(faction.id)) return faction
    const settlementIds = (faction.settlementIds ?? []).filter((id) => !cluster.includes(id))
    if (settlementIds.length === 0) {
      return { ...faction, settlementIds, status: 'extinct' }
    }
    return { ...faction, settlementIds }
  })

  for (const priorId of [...priorFactionIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    const extinct = factions.find((f) => f.id === priorId && f.status === 'extinct')
    if (extinct) {
      events.push({
        kind: HISTORY_KIND_FACTION_EXTINCT,
        epoch,
        factionId: priorId,
        cause: 'alliance_peer_mint',
      })
    }
  }

  factions = [...factions, minted]

  const settlements = params.slice.settlements.map((settlement) => {
    if (!cluster.includes(settlement.id)) return settlement
    return {
      ...settlement,
      factionId: newFactionId,
      isTradePartner: false,
      vassalLiegeSettlementId: null,
    }
  })

  const sortedCluster = [...cluster].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  for (const settlementId of sortedCluster) {
    events.push({
      kind: HISTORY_KIND_ALLIANCE,
      epoch,
      settlementId,
      factionId: newFactionId,
      cause: 'peer_mint',
    })
  }
  events.push({
    kind: HISTORY_KIND_FACTION_EMERGED,
    epoch,
    factionId: newFactionId,
    capitalSettlementId: capitalId,
    cause: 'alliance_peer_mint',
    settlementIds: sortedCluster,
  })

  return {
    slice: {
      ...params.slice,
      settlements,
      factions,
      historyLog: [...(params.slice.historyLog ?? []), ...events],
    },
  }
}

/**
 * @param {{
 *   settlements: object[],
 *   factions: object[] | null | undefined,
 *   claimAdjacencyPairs: Set<string>,
 *   corridorPairs: Set<string>,
 *   excludeIds: Set<string>,
 * }} params
 * @returns {string[][]}
 */
function buildFreePeerClusters(params) {
  const freeIds = params.settlements
    .filter((s) => isPeerMintEligible(s, { settlements: params.settlements, factions: params.factions }))
    .map((s) => s.id)
    .filter((id) => !params.excludeIds.has(id))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

  if (freeIds.length < 2) return []

  /** @type {Map<string, Set<string>>} */
  const graph = new Map()
  for (const id of freeIds) graph.set(id, new Set())

  const link = (a, b) => {
    if (!graph.has(a) || !graph.has(b)) return
    graph.get(a).add(b)
    graph.get(b).add(a)
  }

  for (const pairKey of params.claimAdjacencyPairs) {
    const [a, b] = String(pairKey).split('|')
    if (a && b) link(a, b)
  }
  for (const pairKey of params.corridorPairs) {
    const [a, b] = String(pairKey).split('|')
    if (a && b) link(a, b)
  }

  const seen = new Set()
  /** @type {string[][]} */
  const clusters = []
  for (const start of freeIds) {
    if (seen.has(start)) continue
    const stack = [start]
    const component = []
    seen.add(start)
    while (stack.length) {
      const id = stack.pop()
      component.push(id)
      for (const n of graph.get(id) ?? []) {
        if (seen.has(n)) continue
        seen.add(n)
        stack.push(n)
      }
    }
    if (component.length >= 2) {
      component.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      clusters.push(component)
    }
  }
  return clusters
}

/**
 * @param {string[]} freeIds
 * @param {object[]} settlements
 */
function pickClusterCapital(freeIds, settlements) {
  const ranked = [...freeIds].sort((a, b) => {
    const sa = settlements.find((s) => s.id === a)
    const sb = settlements.find((s) => s.id === b)
    const tierDelta = tierRank(sb) - tierRank(sa)
    if (tierDelta !== 0) return tierDelta
    const popDelta = (sb?.population ?? 0) - (sa?.population ?? 0)
    if (popDelta !== 0) return popDelta
    return a < b ? -1 : a > b ? 1 : 0
  })
  return ranked[0] ?? null
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
 * @param {object} slice
 * @param {string} subjectId
 */
function clearPressureStateForSubject(slice, subjectId) {
  return {
    ...slice,
    politicalPressureStreak: omitKey(slice.politicalPressureStreak, subjectId),
    politicalPressureClearStreak: omitKey(slice.politicalPressureClearStreak, subjectId),
    politicalPressureArmedBySettlementId: omitKey(
      slice.politicalPressureArmedBySettlementId,
      subjectId,
    ),
  }
}

/**
 * @param {Record<string, unknown> | null | undefined} map
 * @param {string} key
 */
function omitKey(map, key) {
  const next = { ...(map ?? {}) }
  delete next[key]
  return next
}
