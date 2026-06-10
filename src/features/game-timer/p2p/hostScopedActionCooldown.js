/**
 * Host-side scoped-action cooldown: after honoring a scoped turn-control change,
 * reject competing scoped guest inbox merges for a brief settling window.
 * Uses host receive/honor time only; guest `sentAt` is wire metadata.
 */

import { isScopedGuestIntent } from './protocol.js'

export const HOST_SCOPED_ACTION_COOLDOWN_MS = 500

/**
 * @param {unknown} intent
 * @returns {boolean}
 */
export function isScopedGuestAction(intent) {
  return isScopedGuestIntent(intent)
}

/**
 * @param {ReturnType<typeof createHostScopedActionCooldown>} cooldown
 * @param {unknown} intent
 * @param {number} nowMs
 */
export function honorScopedGuestAction(cooldown, intent, nowMs) {
  if (isScopedGuestIntent(intent)) {
    cooldown.notifyHonoredScopedAction(nowMs)
  }
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
  const scoped = isScopedGuestIntent(parsed.intent)
  const rejectedScopedGuest = scoped && cooldown.shouldRejectScopedGuestMessage(nowMs)
  if (!rejectedScopedGuest) {
    applySnapshot(parsed.snapshot)
    honorScopedGuestAction(cooldown, parsed.intent, nowMs)
  }
  return {
    broadcastSnapshot: getSnapshot(),
    appliedGuestSnapshot: !rejectedScopedGuest,
    rejectedScopedGuest,
  }
}
