/**
 * Soft-power slice field resolvers for colonization hydrate/serialize.
 * Domain: world-builder/CONTEXT.md — Soft power; Trade partner.
 */

/**
 * @param {unknown} value
 * @returns {Record<string, string>}
 */
export function resolveSoftPowerStringMap(value) {
  if (!value || typeof value !== 'object') return {}
  /** @type {Record<string, string>} */
  const resolved = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' && entry.length > 0) resolved[key] = entry
  }
  return resolved
}

/**
 * @param {unknown} value
 * @returns {Record<string, { joinedEpoch: number, factionId?: string | null }>}
 */
export function resolveRecentTradePartnerJoinMap(value) {
  if (!value || typeof value !== 'object') return {}
  /** @type {Record<string, { joinedEpoch: number, factionId?: string | null }>} */
  const resolved = {}
  for (const [id, entry] of Object.entries(value)) {
    if (!entry || typeof entry !== 'object') continue
    const row = /** @type {{ joinedEpoch?: unknown, factionId?: unknown }} */ (entry)
    if (typeof row.joinedEpoch !== 'number' || !Number.isFinite(row.joinedEpoch)) continue
    resolved[id] = {
      joinedEpoch: Math.floor(row.joinedEpoch),
      factionId: typeof row.factionId === 'string' ? row.factionId : null,
    }
  }
  return resolved
}

/**
 * Default empty soft-power fields for a fresh colonization slice.
 * @returns {{
 *   lastOnMapGoodsBilateralCpByPair: Record<string, number>,
 *   softPowerPaintStreak: Record<string, number>,
 *   softPowerJoinHoldStreak: Record<string, number>,
 *   softPowerClearStreak: Record<string, number>,
 *   softPowerPaintBySettlementId: Record<string, string>,
 *   softPowerJoinEligibleBySettlementId: Record<string, string>,
 *   softPowerRebellionPressureStreak: Record<string, number>,
 *   recentTradePartnerJoinBySettlementId: Record<string, { joinedEpoch: number, factionId?: string | null }>,
 *   tradePartnerPeelClearStreak: Record<string, number>,
 * }}
 */
export function createEmptySoftPowerSliceFields() {
  return {
    lastOnMapGoodsBilateralCpByPair: {},
    softPowerPaintStreak: {},
    softPowerJoinHoldStreak: {},
    softPowerClearStreak: {},
    softPowerPaintBySettlementId: {},
    softPowerJoinEligibleBySettlementId: {},
    softPowerRebellionPressureStreak: {},
    recentTradePartnerJoinBySettlementId: {},
    tradePartnerPeelClearStreak: {},
  }
}

/**
 * @param {object} incoming
 * @param {(value: unknown) => Record<string, number>} resolveStreakMap
 * @param {(value: unknown) => Record<string, number>} resolveNonNegativeCpMap
 */
export function resolveSoftPowerSliceFields(incoming, resolveStreakMap, resolveNonNegativeCpMap) {
  return {
    lastOnMapGoodsBilateralCpByPair: resolveNonNegativeCpMap(
      incoming.lastOnMapGoodsBilateralCpByPair,
    ),
    softPowerPaintStreak: resolveStreakMap(incoming.softPowerPaintStreak),
    softPowerJoinHoldStreak: resolveStreakMap(incoming.softPowerJoinHoldStreak),
    softPowerClearStreak: resolveStreakMap(incoming.softPowerClearStreak),
    softPowerPaintBySettlementId: resolveSoftPowerStringMap(
      incoming.softPowerPaintBySettlementId,
    ),
    softPowerJoinEligibleBySettlementId: resolveSoftPowerStringMap(
      incoming.softPowerJoinEligibleBySettlementId,
    ),
    softPowerRebellionPressureStreak: resolveStreakMap(
      incoming.softPowerRebellionPressureStreak,
    ),
    recentTradePartnerJoinBySettlementId: resolveRecentTradePartnerJoinMap(
      incoming.recentTradePartnerJoinBySettlementId,
    ),
    tradePartnerPeelClearStreak: resolveStreakMap(incoming.tradePartnerPeelClearStreak),
  }
}
