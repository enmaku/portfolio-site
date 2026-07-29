/**
 * Soft-power on-map trade share scoring.
 * Domain: world-builder/CONTEXT.md — Soft power; ADR 0021.
 */

import { goodsPairKey } from './onMapGoodsBilateralCpByPair.js'

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
  const majority = params.majority ?? SOFT_POWER_MAJORITY
  const marginRatio = params.marginRatio ?? SOFT_POWER_MARGIN_RATIO
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
function isLiving(settlement) {
  if (!settlement || typeof settlement.id !== 'string') return false
  if (settlement.status === 'ruin') return false
  if (settlement.population !== undefined && !(settlement.population > 0)) return false
  return true
}

/**
 * Taxed members + trade partners count as commercial counterparties for a banner.
 *
 * @param {object} settlement
 * @param {string} factionId
 * @returns {boolean}
 */
function isFactionCounterparty(settlement, factionId) {
  if (!isLiving(settlement)) return false
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
  const settlements = Array.isArray(input.settlements) ? input.settlements : []
  const factions = Array.isArray(input.factions) ? input.factions : []
  const bilateral = input.bilateralCpByPair && typeof input.bilateralCpByPair === 'object'
    ? input.bilateralCpByPair
    : {}
  const absFloorCp = Number.isFinite(input.absFloorCp)
    ? Number(input.absFloorCp)
    : SOFT_POWER_ABS_FLOOR_CP
  const majority = input.majority ?? SOFT_POWER_MAJORITY
  const marginRatio = input.marginRatio ?? SOFT_POWER_MARGIN_RATIO

  /** @type {Map<string, object>} */
  const byId = new Map()
  for (const settlement of settlements) {
    if (settlement?.id) byId.set(settlement.id, settlement)
  }

  const activeFactions = factions.filter(
    (f) => f && f.status === 'active' && typeof f.id === 'string',
  )

  /** @type {Record<string, {
   *   sharesByFactionId: Record<string, number>,
   *   volumeByFactionId: Record<string, number>,
   *   totalVolumeCp: number,
   *   dominantFactionId: string | null,
   *   majority: boolean,
   *   marginOk: boolean,
   * }>} */
  const out = {}

  for (const pin of settlements) {
    if (!isLiving(pin)) continue
    /** @type {Record<string, number>} */
    const volumeByFactionId = {}
    let totalVolumeCp = 0

    for (const faction of activeFactions) {
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

    out[pin.id] = {
      sharesByFactionId,
      volumeByFactionId,
      totalVolumeCp,
      dominantFactionId,
      majority: majorityOk,
      marginOk,
    }
  }

  return out
}
