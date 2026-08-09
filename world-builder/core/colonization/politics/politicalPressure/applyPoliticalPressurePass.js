/**
 * Political-pressure pass: score, streak/arm, then alliance membership.
 * Domain: world-builder/CONTEXT.md — Political pressure; ADR 0022.
 */

import { areBelligerentFactions } from '../conflict/belligerentTradeBlocks.js'
import { countLivingFactionMembers } from '../factionCap.js'
import { resolveMapGraySettlementIds } from '../softPower/factionalControl.js'
import { applyAllianceMembership } from './applyAllianceMembership.js'
import { buildDirectPressureCorridorPairSet } from './directCorridorPairs.js'
import { getPoliticalPressureTuning } from './politicalPressureTuning.js'
import { advancePoliticalPressureStreaks } from './politicalPressureStreaks.js'
import { buildPrimaryClaimContact, undirectedSettlementPairKey } from './primaryClaimAdjacency.js'
import { scorePoliticalPressureBySettlementAsync } from './scorePoliticalPressure.js'

/** Fixed progress ticks outside per-subject scoring: contact, streaks, alliance. */
export const PRESSURE_PASS_FIXED_PROGRESS_STAGES = 3

/**
 * @param {number} eligibleSubjectCount
 * @returns {number}
 */
export function countPoliticalPressureProgressItems(eligibleSubjectCount) {
  const n = Math.max(0, eligibleSubjectCount | 0)
  return PRESSURE_PASS_FIXED_PROGRESS_STAGES + n
}

/**
 * @param {{
 *   slice: import('../../createDefaultColonizationSlice.js').ColonizationSlice,
 *   worldDocument: { gridWidth?: number, gridHeight?: number },
 *   primaryClaim?: Record<string, Array<{ x: number, y: number }>>,
 *   capacityBySettlementId?: Record<string, number> | null,
 *   martialInputBySettlementId?: Record<string, { martialCapacity?: number } | number> | null,
 * }} params
 * @param {{
 *   onProgress?: () => void,
 *   yieldToUi?: () => Promise<void>,
 * }} [options]
 * @returns {Promise<{
 *   slice: import('../../createDefaultColonizationSlice.js').ColonizationSlice,
 *   events: object[],
 * }>}
 */
export async function applyPoliticalPressurePass(params, options = {}) {
  const { onProgress, yieldToUi } = options
  let next = params.slice
  if (!getPoliticalPressureTuning().enabled) {
    return { slice: next, events: [] }
  }

  const gridWidth = Number(params.worldDocument?.gridWidth) || 0
  const gridHeight = Number(params.worldDocument?.gridHeight) || 0
  const primaryClaim = params.primaryClaim ?? next.primaryClaim ?? {}

  const livingIds = (next.settlements ?? [])
    .filter((s) => isLiving(s))
    .map((s) => s.id)

  // Contact graph is the expensive prelude — tick first so UI can paint 1/n.
  onProgress?.()
  await yieldToUi?.()

  const { adjacencyPairs: claimAdjacencyPairs, borderCountByDirectedPair } =
    buildPrimaryClaimContact({
      primaryClaim,
      settlementIds: livingIds,
      gridWidth,
      gridHeight,
    })

  // Built roads / inland sail only — trade candidate edges are haul graph, not corridors.
  const corridorPairs = buildDirectPressureCorridorPairSet({
    roads: next.roads,
  })

  const martialBySettlementId = gatherMartialBySettlementId({
    capacityBySettlementId: params.capacityBySettlementId,
    martialInputBySettlementId: params.martialInputBySettlementId,
  })

  const bilateralCpByPair = bilateralWithWartimeZero({
    bilateral: next.lastOnMapGoodsBilateralCpByPair ?? {},
    settlements: next.settlements,
    blocks: next.belligerentTradeBlocks,
  })

  /** @type {Set<string>} */
  const eligibleSubjectIds = new Set()
  for (const settlement of next.settlements ?? []) {
    if (!isLiving(settlement)) continue
    if (isMultiPinCapital(settlement, next)) continue
    eligibleSubjectIds.add(settlement.id)
  }

  const scores = await scorePoliticalPressureBySettlementAsync(
    {
      settlements: next.settlements,
      factions: next.factions,
      borderCountByDirectedPair,
      corridorPairs,
      bilateralCpByPair,
      martialBySettlementId,
      bannerMembershipHistoryBySettlementId: next.bannerMembershipHistoryBySettlementId,
      subjectIds: [...eligibleSubjectIds],
    },
    {
      onItem: () => {
        onProgress?.()
      },
      yieldToUi,
    },
  )

  /** @type {Record<string, string | null | undefined>} */
  const homeFactionBySettlementId = {}
  for (const settlement of next.settlements ?? []) {
    if (!settlement?.id) continue
    homeFactionBySettlementId[settlement.id] = settlement.factionId ?? null
  }

  const mapGraySettlementIds = resolveMapGraySettlementIds({
    settlements: next.settlements,
    factions: next.factions,
  })

  const streaked = advancePoliticalPressureStreaks({
    state: next,
    scores,
    epoch: next.epoch,
    eligibleSubjectIds,
    homeFactionBySettlementId,
    mapGraySettlementIds,
  })
  next = { ...next, ...streaked.state }
  onProgress?.()
  await yieldToUi?.()

  const historyBefore = next.historyLog?.length ?? 0
  const alliance = applyAllianceMembership({
    slice: next,
    armedBySettlementId: next.politicalPressureArmedBySettlementId,
    claimAdjacencyPairs,
    corridorPairs,
    gridWidth,
    gridHeight,
  })
  next = alliance.slice
  const events = (next.historyLog ?? []).slice(historyBefore)
  onProgress?.()
  await yieldToUi?.()

  return { slice: next, events }
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
function isMultiPinCapital(settlement, slice) {
  if (!settlement.factionId) return false
  const faction = (slice.factions ?? []).find((f) => f.id === settlement.factionId)
  if (!faction || faction.capitalSettlementId !== settlement.id) return false
  return countLivingFactionMembers(settlement.factionId, { settlements: slice.settlements }) > 1
}

/**
 * Eligible pressure subjects (living, not multi-pin capitals).
 * @param {import('../../createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @returns {number}
 */
export function countEligiblePoliticalPressureSubjects(slice) {
  let n = 0
  for (const settlement of slice?.settlements ?? []) {
    if (!isLiving(settlement)) continue
    if (isMultiPinCapital(settlement, slice)) continue
    n += 1
  }
  return n
}

/**
 * @param {{
 *   capacityBySettlementId?: Record<string, number> | null,
 *   martialInputBySettlementId?: Record<string, { martialCapacity?: number } | number> | null,
 * }} params
 * @returns {Record<string, number>}
 */
function gatherMartialBySettlementId(params) {
  /** @type {Record<string, number>} */
  const out = {}
  if (params.capacityBySettlementId && typeof params.capacityBySettlementId === 'object') {
    for (const [id, value] of Object.entries(params.capacityBySettlementId)) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        out[id] = value
      }
    }
  }
  if (params.martialInputBySettlementId && typeof params.martialInputBySettlementId === 'object') {
    for (const [id, value] of Object.entries(params.martialInputBySettlementId)) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        if (out[id] == null) out[id] = value
        continue
      }
      if (value && typeof value === 'object') {
        const n = value.martialCapacity
        if (typeof n === 'number' && Number.isFinite(n) && n > 0 && out[id] == null) {
          out[id] = n
        }
      }
    }
  }
  return out
}

/**
 * @param {{
 *   bilateral: Record<string, number>,
 *   settlements?: object[] | null,
 *   blocks?: Array<{ aFactionId?: string, bFactionId?: string }> | null,
 * }} params
 * @returns {Record<string, number>}
 */
function bilateralWithWartimeZero(params) {
  const blocks = params.blocks
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return { ...params.bilateral }
  }
  /** @type {Record<string, string | null>} */
  const factionById = {}
  for (const settlement of params.settlements ?? []) {
    if (!settlement?.id) continue
    factionById[settlement.id] = settlement.factionId ?? null
  }
  /** @type {Record<string, number>} */
  const out = {}
  for (const [key, value] of Object.entries(params.bilateral)) {
    const [a, b] = String(key).split('|')
    if (!a || !b) {
      out[key] = value
      continue
    }
    const fa = factionById[a]
    const fb = factionById[b]
    if (areBelligerentFactions(blocks, fa, fb)) {
      out[undirectedSettlementPairKey(a, b)] = 0
      continue
    }
    out[key] = value
  }
  return out
}

/** @type {typeof bilateralWithWartimeZero} */
export const bilateralWithWartimeZeroForTests = bilateralWithWartimeZero
