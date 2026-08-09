/**
 * Same-banner reunification flash for map chrome (orange swords / handshake).
 * Domain: world-builder/CONTEXT.md — Quashed rebellion; Populace appeased.
 *
 * Epoch-start sticky banner comes from banner tenure: after politics membership,
 * tenure appends this epoch's post-membership snapshot. The previous window entry
 * is prior-epoch end ≈ on-map color at the start of this epoch.
 */

/**
 * @param {{
 *   bannerMembershipHistoryBySettlementId?: Record<string, string[] | null | undefined> | null,
 * } | null | undefined} slice
 * @param {string} settlementId
 * @returns {string | null}
 */
export function resolveEpochStartFactionId(slice, settlementId) {
  if (!settlementId) return null
  const hist = slice?.bannerMembershipHistoryBySettlementId?.[settlementId]
  if (!Array.isArray(hist) || hist.length < 2) return null
  const raw = hist[hist.length - 2]
  return typeof raw === 'string' && raw.length > 0 ? raw : null
}

/**
 * True when a swords/handshake flash lands on a pin whose sticky banner color
 * matches epoch start (no start→end territory color change).
 *
 * @param {{
 *   bannerMembershipHistoryBySettlementId?: Record<string, string[] | null | undefined> | null,
 * } | null | undefined} slice
 * @param {string} settlementId
 * @param {string | null | undefined} endFactionId
 * @returns {boolean}
 */
export function isSameBannerEpochReunification(slice, settlementId, endFactionId) {
  if (!endFactionId) return false
  return resolveEpochStartFactionId(slice, settlementId) === endFactionId
}
