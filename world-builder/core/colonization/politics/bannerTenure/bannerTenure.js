/**
 * Banner tenure — rolling membership window → preferred banner + affinity.
 * Domain: world-builder/CONTEXT.md — Banner tenure.
 */

import {
  DEFAULT_BANNER_TENURE_TUNING,
  getBannerTenureTuning,
} from './bannerTenureTuning.js'

/**
 * @typedef {{
 *   preferredFactionId: string | null,
 *   preferredCount: number,
 *   affinity: number,
 *   windowSize: number,
 * }} BannerTenurePreference
 */

/**
 * @param {unknown} history
 * @param {{ windowSize?: number }} [tuning]
 * @returns {string[]}
 */
export function normalizeMembershipHistory(history, tuning = {}) {
  const windowSize = Math.max(
    1,
    Math.floor(
      Number(tuning.windowSize) > 0
        ? Number(tuning.windowSize)
        : getBannerTenureTuning().windowSize,
    ),
  )
  if (!Array.isArray(history)) return []
  /** @type {string[]} */
  const out = []
  for (const entry of history) {
    if (typeof entry === 'string' && entry) out.push(entry)
    else if (entry == null) out.push('')
  }
  return out.slice(-windowSize)
}

/**
 * Plurality of sticky membership in the window; recency breaks ties.
 * Affinity = preferredCount / windowSize (partial windows stay mild).
 *
 * @param {string[] | null | undefined} history
 * @param {{ windowSize?: number }} [tuning]
 * @returns {BannerTenurePreference}
 */
export function resolveBannerTenurePreference(history, tuning = {}) {
  const windowSize = Math.max(
    1,
    Math.floor(
      Number(tuning.windowSize) > 0
        ? Number(tuning.windowSize)
        : getBannerTenureTuning().windowSize,
    ),
  )
  const normalized = normalizeMembershipHistory(history, { windowSize })
  /** @type {Map<string, { count: number, lastIndex: number }>} */
  const tallies = new Map()
  for (let i = 0; i < normalized.length; i += 1) {
    const id = normalized[i]
    if (!id) continue
    const row = tallies.get(id) ?? { count: 0, lastIndex: -1 }
    row.count += 1
    row.lastIndex = i
    tallies.set(id, row)
  }

  let preferredFactionId = null
  let preferredCount = 0
  let preferredLast = -1
  for (const [id, row] of tallies) {
    if (
      row.count > preferredCount ||
      (row.count === preferredCount && row.lastIndex > preferredLast)
    ) {
      preferredFactionId = id
      preferredCount = row.count
      preferredLast = row.lastIndex
    }
  }

  return {
    preferredFactionId,
    preferredCount,
    affinity: preferredFactionId ? preferredCount / windowSize : 0,
    windowSize,
  }
}

/**
 * Resistance when defending preferred while currently under it.
 * @param {{
 *   subjectStrength: number,
 *   history?: string[] | null,
 *   currentFactionId?: string | null,
 *   maxStrengthMult?: number,
 *   windowSize?: number,
 * }} params
 * @returns {number}
 */
export function computeBannerTenureResistance(params) {
  const tuning = getBannerTenureTuning()
  const strength = Number(params.subjectStrength)
  if (!(strength > 0)) return 0
  const preference = resolveBannerTenurePreference(params.history, {
    windowSize: params.windowSize ?? tuning.windowSize,
  })
  const current =
    typeof params.currentFactionId === 'string' ? params.currentFactionId : null
  if (!preference.preferredFactionId || current !== preference.preferredFactionId) {
    return 0
  }
  const maxMult =
    params.maxStrengthMult ?? tuning.maxStrengthMult ?? DEFAULT_BANNER_TENURE_TUNING.maxStrengthMult
  return strength * Math.max(0, maxMult) * preference.affinity
}

/**
 * Weight rival push: homecoming boost toward preferred, dampen foreign banners.
 * @param {{
 *   push: number,
 *   history?: string[] | null,
 *   pressuringFactionId?: string | null,
 *   homecomingMult?: number,
 *   foreignDampenMult?: number,
 *   windowSize?: number,
 * }} params
 * @returns {number}
 */
export function applyBannerTenurePushWeight(params) {
  const tuning = getBannerTenureTuning()
  const push = Number(params.push)
  if (!(push > 0)) return 0
  const preference = resolveBannerTenurePreference(params.history, {
    windowSize: params.windowSize ?? tuning.windowSize,
  })
  if (!preference.preferredFactionId) return push
  if (params.pressuringFactionId === preference.preferredFactionId) {
    const homecoming =
      params.homecomingMult ??
      tuning.homecomingMult ??
      DEFAULT_BANNER_TENURE_TUNING.homecomingMult
    return push * (1 + Math.max(0, homecoming) * preference.affinity)
  }
  const dampen =
    params.foreignDampenMult ??
    tuning.foreignDampenMult ??
    DEFAULT_BANNER_TENURE_TUNING.foreignDampenMult
  return push / (1 + Math.max(0, dampen) * preference.affinity)
}

/**
 * Scale tax/trade rebellion arm thresholds.
 * Above 1 when defending preferred; below 1 when current usurps preferred.
 *
 * @param {{
 *   history?: string[] | null,
 *   currentFactionId?: string | null,
 *   rebellionArmMult?: number,
 *   reconquistaEase?: number,
 *   minArmScale?: number,
 *   windowSize?: number,
 * }} params
 * @returns {number}
 */
export function rebellionArmThresholdScale(params = {}) {
  const tuning = getBannerTenureTuning()
  const preference = resolveBannerTenurePreference(params.history, {
    windowSize: params.windowSize ?? tuning.windowSize,
  })
  if (!preference.preferredFactionId) return 1
  const current =
    typeof params.currentFactionId === 'string' ? params.currentFactionId : null
  const armMult =
    params.rebellionArmMult ??
    tuning.rebellionArmMult ??
    DEFAULT_BANNER_TENURE_TUNING.rebellionArmMult
  if (current === preference.preferredFactionId) {
    return 1 + Math.max(0, armMult) * preference.affinity
  }
  const ease =
    params.reconquistaEase ??
    tuning.reconquistaEase ??
    DEFAULT_BANNER_TENURE_TUNING.reconquistaEase
  const minScale =
    params.minArmScale ?? tuning.minArmScale ?? DEFAULT_BANNER_TENURE_TUNING.minArmScale
  return Math.max(minScale, 1 - Math.max(0, ease) * preference.affinity)
}

/**
 * Append this epoch's sticky membership (or unaligned hole) into each living pin's window.
 *
 * @param {{
 *   settlements?: object[] | null,
 *   bannerMembershipHistoryBySettlementId?: Record<string, string[]> | null,
 *   windowSize?: number,
 * }} params
 * @returns {{ bannerMembershipHistoryBySettlementId: Record<string, string[]> }}
 */
export function advanceBannerTenure(params) {
  const windowSize = Math.max(
    1,
    Math.floor(
      Number(params.windowSize) > 0 ? Number(params.windowSize) : getBannerTenureTuning().windowSize,
    ),
  )
  const prior = params.bannerMembershipHistoryBySettlementId ?? {}
  /** @type {Record<string, string[]>} */
  const next = {}

  for (const settlement of params.settlements ?? []) {
    if (!settlement || settlement.status !== 'living') continue
    if (typeof settlement.id !== 'string') continue
    const priorHist = normalizeMembershipHistory(prior[settlement.id], { windowSize })
    const entry =
      typeof settlement.factionId === 'string' && settlement.factionId
        ? settlement.factionId
        : ''
    next[settlement.id] = [...priorHist, entry].slice(-windowSize)
  }

  return { bannerMembershipHistoryBySettlementId: next }
}
