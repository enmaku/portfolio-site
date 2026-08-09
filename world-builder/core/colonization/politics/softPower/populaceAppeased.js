/**
 * Soft-power reunification flavor after unrest settled without lasting color change.
 * Domain: world-builder/CONTEXT.md — Populace appeased; Soft power; Quashed rebellion.
 */

import { isSameBannerEpochReunification } from '../sameBannerReunification.js'

export const POPULACE_APPEASED_CAUSE = 'populace_appeased'

/**
 * Handshake flash on a pin whose sticky banner matches epoch start.
 *
 * @param {{
 *   bannerMembershipHistoryBySettlementId?: Record<string, string[] | null | undefined> | null,
 * } | null | undefined} slice
 * @param {string} settlementId
 * @param {string} joiningFactionId
 * @returns {boolean}
 */
export function isPopulaceAppeasedRejoin(slice, settlementId, joiningFactionId) {
  return isSameBannerEpochReunification(slice, settlementId, joiningFactionId)
}

/**
 * @param {object} slice
 * @param {string} settlementId
 * @param {string} joiningFactionId
 * @param {string} ordinaryCause
 * @returns {string}
 */
export function resolveSoftPowerRejoinCause(slice, settlementId, joiningFactionId, ordinaryCause) {
  if (isPopulaceAppeasedRejoin(slice, settlementId, joiningFactionId)) {
    return POPULACE_APPEASED_CAUSE
  }
  return ordinaryCause
}
