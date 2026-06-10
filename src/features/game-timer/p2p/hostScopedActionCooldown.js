/**
 * Host-side scoped-action cooldown: after honoring a scoped turn-control change,
 * reject competing scoped guest inbox merges for a brief settling window.
 * Uses host receive/honor time only; guest `sentAt` is wire metadata.
 */

import { isWellFormedGuestIntent } from './protocol.js'

export const HOST_SCOPED_ACTION_COOLDOWN_MS = 500

/** @type {Set<string>} */
export const SCOPED_GUEST_ACTION_KINDS = new Set([
  'selectPlayer',
  'endTurnNext',
  'registerHardPass',
  'undoHardPass',
  'goToNextRound',
  'goToPreviousRound',
])

/**
 * @param {unknown} intent
 * @returns {boolean}
 */
export function isScopedGuestAction(intent) {
  return isWellFormedGuestIntent(intent) && SCOPED_GUEST_ACTION_KINDS.has(intent.kind)
}

/**
 * @param {{ cooldownMs?: number }} [opts]
 */
export function createHostScopedActionCooldown(opts = {}) {
  const windowMs =
    typeof opts.cooldownMs === 'number' ? opts.cooldownMs : HOST_SCOPED_ACTION_COOLDOWN_MS
  /** @type {number | null} */
  let lastHonoredAt = null

  /**
   * @param {number} nowMs
   */
  function notifyHonoredScopedAction(nowMs) {
    lastHonoredAt = nowMs
  }

  /**
   * @param {number} nowMs
   * @returns {boolean}
   */
  function shouldRejectScopedGuestMessage(nowMs) {
    if (lastHonoredAt == null) return false
    return nowMs - lastHonoredAt < windowMs
  }

  return { notifyHonoredScopedAction, shouldRejectScopedGuestMessage }
}

/**
 * @param {{ intent?: unknown }} parsed
 * @param {ReturnType<typeof createHostScopedActionCooldown>} cooldown
 * @param {number} nowMs
 * @returns {boolean} whether the host should apply `parsed.snapshot`
 */
export function hostShouldApplyGuestSnapshot(parsed, cooldown, nowMs) {
  const intent = parsed.intent
  if (!isScopedGuestAction(intent)) return true
  return !cooldown.shouldRejectScopedGuestMessage(nowMs)
}

/**
 * @param {{ snapshot: import('../types.js').GameTimerSyncPayload, intent?: unknown }} parsed
 * @param {ReturnType<typeof createHostScopedActionCooldown>} cooldown
 * @param {number} nowMs
 * @param {(snap: import('../types.js').GameTimerSyncPayload) => void} applySnapshot
 * @param {() => import('../types.js').GameTimerSyncPayload} getSnapshot
 * @returns {{ broadcastSnapshot: import('../types.js').GameTimerSyncPayload, appliedGuestSnapshot: boolean, rejectedScopedGuest: boolean }}
 */
export function authoritativeSnapshotAfterGuestMessage(
  parsed,
  cooldown,
  nowMs,
  applySnapshot,
  getSnapshot,
) {
  const scoped = isScopedGuestAction(parsed.intent)
  const rejectedScopedGuest = scoped && cooldown.shouldRejectScopedGuestMessage(nowMs)
  const appliedGuestSnapshot = !rejectedScopedGuest && hostShouldApplyGuestSnapshot(parsed, cooldown, nowMs)
  if (appliedGuestSnapshot) {
    applySnapshot(parsed.snapshot)
    if (scoped) {
      cooldown.notifyHonoredScopedAction(nowMs)
    }
  }
  return { broadcastSnapshot: getSnapshot(), appliedGuestSnapshot, rejectedScopedGuest }
}
