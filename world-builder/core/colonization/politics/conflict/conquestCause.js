/**
 * Recent-conquest map chrome causes.
 * Domain: world-builder/CONTEXT.md — Conquest, Quashed rebellion.
 */

import { isSameBannerEpochReunification } from '../sameBannerReunification.js'

export const CONQUEST_CAUSE_CONQUEST = 'conquest'
export const CONQUEST_CAUSE_QUASHED_REBELLION = 'quashed_rebellion'

/**
 * Start→end same sticky banner under swords = quashed rebellion (soft-unalign,
 * mid-epoch alliance flip, or any other path that paints the same territory color).
 *
 * @param {{
 *   bannerMembershipHistoryBySettlementId?: Record<string, string[] | null | undefined> | null,
 * } | null | undefined} slice
 * @param {string} settlementId
 * @param {string} winnerFactionId
 * @returns {typeof CONQUEST_CAUSE_CONQUEST | typeof CONQUEST_CAUSE_QUASHED_REBELLION}
 */
export function resolveConquestCause(slice, settlementId, winnerFactionId) {
  if (isSameBannerEpochReunification(slice, settlementId, winnerFactionId)) {
    return CONQUEST_CAUSE_QUASHED_REBELLION
  }
  return CONQUEST_CAUSE_CONQUEST
}
