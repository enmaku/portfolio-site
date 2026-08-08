/**
 * Recent-conquest map chrome causes.
 * Domain: world-builder/CONTEXT.md — Conquest, Quashed rebellion.
 */

import { HISTORY_KIND_VASSAL_DEFECTION } from '../historyKinds.js'

export const CONQUEST_CAUSE_CONQUEST = 'conquest'
export const CONQUEST_CAUSE_QUASHED_REBELLION = 'quashed_rebellion'

/**
 * Same-epoch soft independence from the winner banner, then reconquest = quashed rebellion.
 *
 * @param {{
 *   historyLog?: Array<{
 *     kind?: string,
 *     epoch?: number,
 *     settlementId?: string,
 *     fromFactionId?: string | null,
 *     cause?: string,
 *   }> | null,
 * }} slice
 * @param {string} settlementId
 * @param {string} winnerFactionId
 * @param {number} conqueredEpoch
 * @returns {boolean}
 */
export function isQuashedRebellionConquest(slice, settlementId, winnerFactionId, conqueredEpoch) {
  const log = slice?.historyLog
  if (!Array.isArray(log)) return false
  for (const entry of log) {
    if (!entry || entry.kind !== HISTORY_KIND_VASSAL_DEFECTION) continue
    if (entry.settlementId !== settlementId) continue
    if (entry.epoch !== conqueredEpoch) continue
    if (entry.cause !== 'soft_unaligned') continue
    if (entry.fromFactionId !== winnerFactionId) continue
    return true
  }
  return false
}

/**
 * @param {{
 *   historyLog?: Array<object> | null,
 * }} slice
 * @param {string} settlementId
 * @param {string} winnerFactionId
 * @param {number} conqueredEpoch
 * @param {string | null} priorFactionId
 * @returns {typeof CONQUEST_CAUSE_CONQUEST | typeof CONQUEST_CAUSE_QUASHED_REBELLION}
 */
export function resolveConquestCause(
  slice,
  settlementId,
  winnerFactionId,
  conqueredEpoch,
  priorFactionId,
) {
  if (
    priorFactionId == null &&
    isQuashedRebellionConquest(slice, settlementId, winnerFactionId, conqueredEpoch)
  ) {
    return CONQUEST_CAUSE_QUASHED_REBELLION
  }
  return CONQUEST_CAUSE_CONQUEST
}
