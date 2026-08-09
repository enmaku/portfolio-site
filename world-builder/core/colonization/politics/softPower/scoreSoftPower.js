/**
 * Soft-power on-map trade share scoring.
 * Domain: world-builder/CONTEXT.md — Soft power; ADR 0021.
 */

import { countLivingFactionMembers } from '../factionCap.js'
import { goodsPairKey } from './onMapGoodsBilateralCpByPair.js'
import { getSoftPowerTuning } from './softPowerTuning.js'

/** Majority threshold (exclusive): share must be strictly greater. */
export const SOFT_POWER_MAJORITY = 0.5

/** Clear-lead ratio vs runner-up share (or runner-up ~0). */
export const SOFT_POWER_MARGIN_RATIO = 2

/** Default absolute volume floor (cp); 0 disables. */
export const SOFT_POWER_ABS_FLOOR_CP = 0

/**
 * @param {{ share: number, runnerUpShare: number, majority?: number, marginRatio?: number }} params
 * @returns {boolean}
 */
export function isSoftPowerDominant(params) {
  const tuning = getSoftPowerTuning()
  const majority = params.majority ?? tuning.majority ?? SOFT_POWER_MAJORITY
  const marginRatio = params.marginRatio ?? tuning.marginRatio ?? SOFT_POWER_MARGIN_RATIO
  const share = Number(params.share) || 0
  const runnerUp = Math.max(0, Number(params.runnerUpShare) || 0)
  if (!(share > majority)) return false
  if (runnerUp <= 0) return true
  return share >= runnerUp * marginRatio
}

/**
 * @param {object | null | undefined} settlement
 * @returns {boolean}
 */
export function isLivingSoftPowerSettlement(settlement) {
  if (!settlement || typeof settlement.id !== 'string') return false
  if (settlement.status === 'ruin') return false
  if (settlement.population !== undefined && !(settlement.population > 0)) return false
  return true
}

/**
 * @param {object} settlement
 * @param {string} factionId
 * @returns {boolean}
 */
function isFactionCounterparty(settlement, factionId) {
  if (!isLivingSoftPowerSettlement(settlement)) return false
  if (settlement.factionId !== factionId) return false
  return true
}

/**
 * @param {{
 *   settlements?: Array<object> | null,
 *   factions?: Array<object> | null,
 *   bilateralCpByPair?: Record<string, number> | null,
 *   absFloorCp?: number,
 *   majority?: number,
 *   marginRatio?: number,
 *   requireMultiMemberDominant?: boolean,
 * }} input
 */
function prepareSoftPowerContext(input) {
  const tuning = getSoftPowerTuning()
  const settlements = Array.isArray(input.settlements) ? input.settlements : []
  const factions = Array.isArray(input.factions) ? input.factions : []
  const bilateral =
    input.bilateralCpByPair && typeof input.bilateralCpByPair === 'object'
      ? input.bilateralCpByPair
      : {}
  const absFloorCp = Number.isFinite(input.absFloorCp)
    ? Number(input.absFloorCp)
    : Number.isFinite(tuning.absFloorCp)
      ? Number(tuning.absFloorCp)
      : SOFT_POWER_ABS_FLOOR_CP
  const majority = input.majority ?? tuning.majority ?? SOFT_POWER_MAJORITY
  const marginRatio = input.marginRatio ?? tuning.marginRatio ?? SOFT_POWER_MARGIN_RATIO
  const requireMultiMemberDominant =
    input.requireMultiMemberDominant ?? tuning.requireMultiMemberDominant ?? true
  const activeFactions = factions.filter(
    (f) => f && f.status === 'active' && typeof f.id === 'string',
  )
  const livingPins = settlements.filter((pin) => isLivingSoftPowerSettlement(pin))
  return {
    settlements,
    bilateral,
    absFloorCp,
    majority,
    marginRatio,
    requireMultiMemberDominant,
    activeFactions,
    livingPins,
  }
}

/**
 * @param {object} pin
 * @param {ReturnType<typeof prepareSoftPowerContext>} ctx
 */
function scoreSoftPowerForPin(pin, ctx) {
  const {
    settlements,
    bilateral,
    absFloorCp,
    majority,
    marginRatio,
    requireMultiMemberDominant,
    activeFactions,
  } = ctx
  /** @type {Set<string>} */
  const multiMemberFactionIds = new Set()
  if (requireMultiMemberDominant) {
    for (const faction of activeFactions) {
      if (countLivingFactionMembers(faction.id, { settlements }) >= 2) {
        multiMemberFactionIds.add(faction.id)
      }
    }
  }

  /** @type {Record<string, number>} */
  const volumeByFactionId = {}
  let totalVolumeCp = 0

  for (const faction of activeFactions) {
    if (requireMultiMemberDominant && !multiMemberFactionIds.has(faction.id)) continue
    let volume = 0
    for (const other of settlements) {
      if (!isFactionCounterparty(other, faction.id)) continue
      if (other.id === pin.id) continue
      const key = goodsPairKey(pin.id, other.id)
      const pairCp = Number(bilateral[key]) || 0
      if (pairCp > 0) volume += pairCp
    }
    if (volume > 0) {
      volumeByFactionId[faction.id] = volume
      totalVolumeCp += volume
    }
  }

  /** @type {Record<string, number>} */
  const sharesByFactionId = {}
  for (const [factionId, volume] of Object.entries(volumeByFactionId)) {
    sharesByFactionId[factionId] = totalVolumeCp > 0 ? volume / totalVolumeCp : 0
  }

  let dominantFactionId = null
  let majorityOk = false
  let marginOk = false

  if (totalVolumeCp >= absFloorCp && totalVolumeCp > 0) {
    const ranked = Object.entries(sharesByFactionId).sort((a, b) => b[1] - a[1])
    if (ranked.length > 0) {
      const [topId, topShare] = ranked[0]
      const runnerUpShare = ranked.length > 1 ? ranked[1][1] : 0
      majorityOk = topShare > majority
      marginOk = runnerUpShare <= 0 || topShare >= runnerUpShare * marginRatio
      if (isSoftPowerDominant({ share: topShare, runnerUpShare, majority, marginRatio })) {
        dominantFactionId = topId
      }
    }
  }

  return {
    sharesByFactionId,
    volumeByFactionId,
    totalVolumeCp,
    dominantFactionId,
    majority: majorityOk,
    marginOk,
  }
}

/**
 * @param {{
 *   settlements?: Array<object> | null,
 *   factions?: Array<object> | null,
 *   bilateralCpByPair?: Record<string, number> | null,
 *   absFloorCp?: number,
 *   majority?: number,
 *   marginRatio?: number,
 * }} input
 * @returns {Record<string, {
 *   sharesByFactionId: Record<string, number>,
 *   volumeByFactionId: Record<string, number>,
 *   totalVolumeCp: number,
 *   dominantFactionId: string | null,
 *   majority: boolean,
 *   marginOk: boolean,
 * }>}
 */
export function scoreSoftPowerBySettlement(input) {
  const ctx = prepareSoftPowerContext(input)
  /** @type {Record<string, ReturnType<typeof scoreSoftPowerForPin>>} */
  const out = {}
  for (const pin of ctx.livingPins) {
    out[pin.id] = scoreSoftPowerForPin(pin, ctx)
  }
  return out
}

/**
 * Async soft-power scoring with per-settlement progress ticks.
 *
 * @param {Parameters<typeof scoreSoftPowerBySettlement>[0]} input
 * @param {{
 *   onItem?: () => void,
 *   yieldToUi?: () => Promise<void>,
 * }} [options]
 * @returns {Promise<ReturnType<typeof scoreSoftPowerBySettlement>>}
 */
export async function scoreSoftPowerBySettlementAsync(input, options = {}) {
  const { onItem, yieldToUi } = options
  const ctx = prepareSoftPowerContext(input)
  /** @type {Record<string, ReturnType<typeof scoreSoftPowerForPin>>} */
  const out = {}
  for (const pin of ctx.livingPins) {
    out[pin.id] = scoreSoftPowerForPin(pin, ctx)
    onItem?.()
    await yieldToUi?.()
  }
  return out
}

/**
 * @param {Array<object> | null | undefined} settlements
 * @returns {number}
 */
export function countLivingSoftPowerSettlements(settlements) {
  if (!Array.isArray(settlements)) return 0
  return settlements.reduce(
    (count, settlement) => count + (isLivingSoftPowerSettlement(settlement) ? 1 : 0),
    0,
  )
}
