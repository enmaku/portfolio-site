/**
 * Score political pressure (neighbor push) for alliance arming.
 * Domain: world-builder/CONTEXT.md — Political pressure; ADR 0022.
 */

import {
  applyBannerTenurePushWeight,
  computeBannerTenureResistance,
} from '../bannerTenure/bannerTenure.js'
import {
  buildPrimaryClaimContact,
  directedSettlementPairKey,
  undirectedSettlementPairKey,
} from './primaryClaimAdjacency.js'
import {
  DEFAULT_POLITICAL_PRESSURE_TUNING,
  getPoliticalPressureTuning,
} from './politicalPressureTuning.js'

/**
 * @param {{ share: number, runnerUpShare: number, majority?: number, marginRatio?: number }} params
 * @returns {boolean}
 */
export function isPoliticalPressureDominant(params) {
  const tuning = getPoliticalPressureTuning()
  const majority = params.majority ?? tuning.majority ?? DEFAULT_POLITICAL_PRESSURE_TUNING.majority
  const marginRatio =
    params.marginRatio ?? tuning.marginRatio ?? DEFAULT_POLITICAL_PRESSURE_TUNING.marginRatio
  const { share, runnerUpShare } = params
  if (!(share > majority)) return false
  if (!(runnerUpShare > 0)) return true
  return share >= runnerUpShare * marginRatio
}

/**
 * @param {object | null | undefined} settlement
 * @returns {boolean}
 */
function isLiving(settlement) {
  return Boolean(settlement && settlement.status === 'living' && typeof settlement.id === 'string')
}

/**
 * @param {object} settlement
 * @returns {number}
 */
function populationOf(settlement) {
  const n = settlement.population
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * @param {object} settlement
 * @returns {number}
 */
function wealthOf(settlement) {
  const n = settlement.wealthCp ?? settlement.wealth
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * @param {object} settlement
 * @param {Record<string, number> | null | undefined} martialBySettlementId
 * @returns {number}
 */
function martialOf(settlement, martialBySettlementId) {
  const fromMap = martialBySettlementId?.[settlement.id]
  if (typeof fromMap === 'number' && Number.isFinite(fromMap) && fromMap > 0) return fromMap
  const n = settlement.martialCapacity
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Raw weighted factor from source pin toward subject (before resistance).
 * @param {{
 *   subject: object,
 *   source: object,
 *   borderCells: number,
 *   hasCorridor: boolean,
 *   tradeCp: number,
 *   martialBySettlementId?: Record<string, number> | null,
 *   tuning?: ReturnType<typeof getPoliticalPressureTuning>,
 * }} params
 * @returns {number}
 */
export function computePoliticalPressureRawPush(params) {
  const tuning = params.tuning ?? getPoliticalPressureTuning()
  const source = params.source
  const border = Math.max(0, params.borderCells) * tuning.weightBorder
  const corridor = params.hasCorridor ? tuning.weightCorridor : 0
  const population = populationOf(source) * tuning.weightPopulation
  const wealth = wealthOf(source) * tuning.weightWealth
  const martial = martialOf(source, params.martialBySettlementId) * tuning.weightMartial
  const trade = Math.max(0, params.tradeCp) * tuning.weightTrade
  return border + corridor + population + wealth + martial + trade
}

/**
 * @param {{
 *   settlements?: object[] | null,
 *   factions?: object[] | null,
 *   primaryClaim?: Record<string, Array<{ x: number, y: number }>> | null,
 *   gridWidth?: number,
 *   gridHeight?: number,
 *   borderCountByDirectedPair?: Map<string, number> | Record<string, number> | null,
 *   corridorPairs?: Set<string> | null,
 *   bilateralCpByPair?: Record<string, number> | null,
 *   martialBySettlementId?: Record<string, number> | null,
 *   bannerMembershipHistoryBySettlementId?: Record<string, string[]> | null,
 *   subjectIds?: string[] | null,
 *   majority?: number,
 *   marginRatio?: number,
 * }} input
 */
function preparePoliticalPressureContext(input) {
  const tuning = getPoliticalPressureTuning()
  const majority = input.majority ?? tuning.majority
  const marginRatio = input.marginRatio ?? tuning.marginRatio
  const settlements = (input.settlements ?? []).filter(isLiving)
  const byId = Object.fromEntries(settlements.map((s) => [s.id, s]))
  const factions = (input.factions ?? []).filter(
    (f) => f && f.status === 'active' && typeof f.id === 'string',
  )
  const subjectIds = input.subjectIds ?? settlements.map((s) => s.id)
  const corridorPairs = input.corridorPairs ?? new Set()
  const bilateral = input.bilateralCpByPair ?? {}
  const membershipHistory = input.bannerMembershipHistoryBySettlementId ?? {}
  const borderCounts = resolveBorderCountLookup(input)

  /** @type {Record<string, string[]>} */
  const membersByFaction = {}
  for (const faction of factions) {
    const ids = Array.isArray(faction.settlementIds) ? faction.settlementIds : []
    membersByFaction[faction.id] = ids.filter((id) => byId[id])
  }

  return {
    byId,
    factions,
    membersByFaction,
    subjectIds,
    corridorPairs,
    bilateral,
    membershipHistory,
    borderCounts,
    martialBySettlementId: input.martialBySettlementId,
    majority,
    marginRatio,
    tuning,
  }
}

/**
 * @param {Map<string, number> | Record<string, number>} raw
 * @returns {(from: string, to: string) => number}
 */
function lookupFromBorderCounts(raw) {
  if (raw instanceof Map) {
    return (from, to) => raw.get(directedSettlementPairKey(from, to)) ?? 0
  }
  return (from, to) => {
    const n = raw[directedSettlementPairKey(from, to)]
    return typeof n === 'number' && Number.isFinite(n) ? n : 0
  }
}

/**
 * Prefer precomputed directed frontier counts; otherwise one contact sweep from primaryClaim.
 * @param {{
 *   borderCountByDirectedPair?: Map<string, number> | Record<string, number> | null,
 *   primaryClaim?: Record<string, Array<{ x: number, y: number }>> | null,
 *   settlements?: object[] | null,
 *   subjectIds?: string[] | null,
 *   gridWidth?: number,
 *   gridHeight?: number,
 * }} input
 * @returns {(from: string, to: string) => number}
 */
function resolveBorderCountLookup(input) {
  if (input.borderCountByDirectedPair) {
    return lookupFromBorderCounts(input.borderCountByDirectedPair)
  }
  const gridWidth = Number(input.gridWidth) || 0
  const gridHeight = Number(input.gridHeight) || 0
  if (!(gridWidth > 0) || !(gridHeight > 0)) {
    return () => 0
  }
  const livingIds = (input.settlements ?? []).filter(isLiving).map((s) => s.id)
  const settlementIds =
    livingIds.length > 0 ? livingIds : Object.keys(input.primaryClaim ?? {})
  const { borderCountByDirectedPair } = buildPrimaryClaimContact({
    primaryClaim: input.primaryClaim,
    settlementIds,
    gridWidth,
    gridHeight,
  })
  return lookupFromBorderCounts(borderCountByDirectedPair)
}

/**
 * @param {{
 *   settlements?: object[] | null,
 *   factions?: object[] | null,
 *   primaryClaim?: Record<string, Array<{ x: number, y: number }>> | null,
 *   gridWidth?: number,
 *   gridHeight?: number,
 *   borderCountByDirectedPair?: Map<string, number> | Record<string, number> | null,
 *   corridorPairs?: Set<string> | null,
 *   bilateralCpByPair?: Record<string, number> | null,
 *   martialBySettlementId?: Record<string, number> | null,
 *   bannerMembershipHistoryBySettlementId?: Record<string, string[]> | null,
 *   subjectIds?: string[] | null,
 *   majority?: number,
 *   marginRatio?: number,
 * }} input
 * @returns {Record<string, {
 *   pushByFactionId: Record<string, number>,
 *   totalPush: number,
 *   subjectStrength: number,
 *   bannerTenureResistance: number,
 *   sharesByFactionId: Record<string, number>,
 *   dominantFactionId: string | null,
 *   majority: boolean,
 *   marginOk: boolean,
 * }>}
 */
export function scorePoliticalPressureBySettlement(input) {
  const ctx = preparePoliticalPressureContext(input)
  /** @type {Record<string, ReturnType<typeof scoreOne>>} */
  const out = {}
  for (const subjectId of ctx.subjectIds) {
    const subject = ctx.byId[subjectId]
    if (!subject) continue
    out[subjectId] = scoreOne(subject, ctx)
  }
  return out
}

/**
 * Async scoring with per-subject progress ticks.
 *
 * @param {Parameters<typeof scorePoliticalPressureBySettlement>[0]} input
 * @param {{
 *   onItem?: () => void,
 *   yieldToUi?: () => Promise<void>,
 * }} [options]
 * @returns {Promise<ReturnType<typeof scorePoliticalPressureBySettlement>>}
 */
export async function scorePoliticalPressureBySettlementAsync(input, options = {}) {
  const { onItem, yieldToUi } = options
  const ctx = preparePoliticalPressureContext(input)
  /** @type {Record<string, ReturnType<typeof scoreOne>>} */
  const out = {}
  for (const subjectId of ctx.subjectIds) {
    const subject = ctx.byId[subjectId]
    if (!subject) {
      onItem?.()
      await yieldToUi?.()
      continue
    }
    out[subjectId] = scoreOne(subject, ctx)
    onItem?.()
    await yieldToUi?.()
  }
  return out
}

/**
 * @param {object} subject
 * @param {ReturnType<typeof preparePoliticalPressureContext>} ctx
 */
function scoreOne(subject, ctx) {
  const {
    byId,
    membersByFaction,
    factions,
    corridorPairs,
    bilateral,
    membershipHistory,
    borderCounts,
    martialBySettlementId,
    majority,
    marginRatio,
    tuning,
  } = ctx

  /** @type {Record<string, number>} */
  const rawPushByFactionId = {}
  for (const faction of factions) {
    let push = 0
    for (const memberId of membersByFaction[faction.id] ?? []) {
      if (memberId === subject.id) continue
      // Push comes from rival / external banners only — not the subject's own faction.
      if (subject.factionId && subject.factionId === faction.id) continue
      const source = byId[memberId]
      if (!source) continue
      const pairKey = undirectedSettlementPairKey(subject.id, memberId)
      const hasCorridor = corridorPairs.has(pairKey)
      const borderCells = borderCounts(subject.id, memberId)
      // Only neighbor contact counts: require border or corridor (trade alone still needs contact)
      if (borderCells <= 0 && !hasCorridor) continue
      const tradeCp =
        bilateral[pairKey] ??
        bilateral[`${subject.id}|${memberId}`] ??
        bilateral[`${memberId}|${subject.id}`] ??
        0
      push += computePoliticalPressureRawPush({
        subject,
        source,
        borderCells,
        hasCorridor,
        tradeCp,
        martialBySettlementId,
        tuning,
      })
    }
    if (push > 0) rawPushByFactionId[faction.id] = push
  }

  const subjectStrength = computePoliticalPressureRawPush({
    subject,
    source: subject,
    borderCells: 0,
    hasCorridor: false,
    tradeCp: 0,
    martialBySettlementId,
    tuning,
  })

  const sticky =
    typeof subject.factionId === 'string' && subject.factionId ? subject.factionId : null

  /** @type {Record<string, number>} */
  const pushByFactionId = {}
  for (const [fid, push] of Object.entries(rawPushByFactionId)) {
    const weighted = sticky
      ? applyBannerTenurePushWeight({
          push,
          history: membershipHistory[subject.id] ?? [],
          pressuringFactionId: fid,
        })
      : push
    if (weighted > 0) pushByFactionId[fid] = weighted
  }

  const bannerTenureResistance = sticky
    ? computeBannerTenureResistance({
        subjectStrength,
        history: membershipHistory[subject.id] ?? [],
        currentFactionId: sticky,
      })
    : 0

  const totalPush = Object.values(pushByFactionId).reduce((a, b) => a + b, 0)
  /** @type {Record<string, number>} */
  const sharesByFactionId = {}
  // marginShare resistance: subject strength + preferred-banner habit + (homecoming-weighted) pushes
  const denom = totalPush + subjectStrength + bannerTenureResistance
  if (denom > 0) {
    for (const [fid, push] of Object.entries(pushByFactionId)) {
      sharesByFactionId[fid] = push / denom
    }
  }

  let dominantFactionId = null
  let topShare = 0
  let runnerUpShare = 0
  for (const [fid, share] of Object.entries(sharesByFactionId)) {
    if (share > topShare) {
      runnerUpShare = topShare
      topShare = share
      dominantFactionId = fid
    } else if (share > runnerUpShare) {
      runnerUpShare = share
    }
  }

  const majorityOk = topShare > majority
  const marginOk = runnerUpShare <= 0 || topShare >= runnerUpShare * marginRatio
  const dominant =
    majorityOk && marginOk && isPoliticalPressureDominant({ share: topShare, runnerUpShare, majority, marginRatio })
      ? dominantFactionId
      : null

  return {
    pushByFactionId,
    totalPush,
    subjectStrength,
    bannerTenureResistance,
    sharesByFactionId,
    dominantFactionId: dominant,
    majority: majorityOk,
    marginOk,
  }
}
