/**
 * Soft-power reunification flavor after soft independence.
 * Domain: world-builder/CONTEXT.md — Populace appeased; Soft power; Quashed rebellion.
 */

import { HISTORY_KIND_ALLIANCE, HISTORY_KIND_TRADE_PARTNER_JOIN, HISTORY_KIND_TRADE_PARTNER_PEEL, HISTORY_KIND_VASSAL_DEFECTION } from '../historyKinds.js'

export const POPULACE_APPEASED_CAUSE = 'populace_appeased'

/**
 * True when this seat's most recent relevant exit was soft independence (or commercial
 * peel) from `joiningFactionId`, with no intervening sticky affiliation under another banner.
 *
 * @param {{
 *   historyLog?: Array<{
 *     kind?: string,
 *     settlementId?: string,
 *     contestedSettlementId?: string,
 *     fromFactionId?: string | null,
 *     priorFactionId?: string | null,
 *     factionId?: string | null,
 *     cause?: string,
 *     winner?: string,
 *     attackerFactionId?: string | null,
 *   }> | null,
 * }} slice
 * @param {string} settlementId
 * @param {string} joiningFactionId
 * @returns {boolean}
 */
export function isPopulaceAppeasedRejoin(slice, settlementId, joiningFactionId) {
  if (!settlementId || !joiningFactionId) return false
  const log = slice?.historyLog
  if (!Array.isArray(log)) return false

  for (let index = log.length - 1; index >= 0; index -= 1) {
    const entry = log[index]
    if (!entry) continue
    const sid = entry.settlementId ?? entry.contestedSettlementId
    if (sid !== settlementId) continue

    if (
      entry.kind === HISTORY_KIND_VASSAL_DEFECTION &&
      entry.cause === 'soft_unaligned' &&
      entry.fromFactionId === joiningFactionId
    ) {
      return true
    }

    if (
      entry.kind === HISTORY_KIND_TRADE_PARTNER_PEEL &&
      entry.priorFactionId === joiningFactionId
    ) {
      return true
    }

    if (
      entry.kind === HISTORY_KIND_ALLIANCE &&
      typeof entry.factionId === 'string' &&
      entry.factionId !== joiningFactionId
    ) {
      return false
    }

    if (
      entry.kind === HISTORY_KIND_TRADE_PARTNER_JOIN &&
      typeof entry.factionId === 'string' &&
      entry.factionId !== joiningFactionId
    ) {
      return false
    }

    if (
      entry.kind === 'major_war_end' &&
      entry.winner === 'attacker' &&
      typeof entry.attackerFactionId === 'string' &&
      entry.attackerFactionId !== joiningFactionId
    ) {
      return false
    }
  }

  return false
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
