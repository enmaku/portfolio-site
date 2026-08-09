/**
 * Vassal defection cause-split: join / spawn / soft-unaligned.
 * Domain: world-builder/CONTEXT.md — Conditional loyalty, Vassal.
 */

/**
 * Local claim production can feed the pin without liege trade.
 *
 * @param {{ localFoodSurplus?: number } | null | undefined} survival
 * @returns {boolean}
 */
export function isVassalLocallyIndependent(survival) {
  return typeof survival?.localFoodSurplus === 'number' && survival.localFoodSurplus > 0
}

/**
 * @param {{
 *   settlement: object,
 *   linkedToLiege: boolean,
 *   adjacentFactionId: string | null,
 *   corridorDependentOnAdjacent: boolean,
 * }} params
 * @returns {{ action: 'join' | 'spawn' | 'soft_unaligned', targetFactionId?: string } | null}
 */
export function resolveVassalDefection(params) {
  const settlement = params.settlement
  if (!settlement?.vassalLiegeSettlementId || !settlement.factionId) return null
  if (params.linkedToLiege) return null

  if (params.corridorDependentOnAdjacent && params.adjacentFactionId) {
    return { action: 'join', targetFactionId: params.adjacentFactionId }
  }

  if (isTownTierOrHigher(settlement)) {
    return { action: 'spawn' }
  }

  return { action: 'soft_unaligned' }
}

/**
 * @param {object} settlement
 */
function isTownTierOrHigher(settlement) {
  return (
    settlement.tier === 'town' ||
    settlement.tier === 'city' ||
    (settlement.population ?? 0) >= 1000
  )
}
