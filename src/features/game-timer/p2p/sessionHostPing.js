import { isRoomMarkedEnded } from './sessionRoomRtdb.js'

/** Legacy rooms without `hostClientId` still use ping freshness for occupancy. */
export const HOST_PING_FRESH_MS = 120_000

/**
 * @param {unknown} ts
 * @param {number} [nowMs]
 * @returns {boolean}
 */
export function isHostPingFresh(ts, nowMs = Date.now()) {
  return typeof ts === 'number' && ts > 0 && nowMs - ts < HOST_PING_FRESH_MS
}

/**
 * @param {unknown} pingVal
 * @returns {boolean}
 */
export function isHostPingPresent(pingVal) {
  return typeof pingVal === 'number' && pingVal > 0
}

/**
 * @param {unknown} pingVal
 * @param {unknown} hostClientId
 * @param {string} stableClientId
 * @param {number} [nowMs]
 * @returns {boolean}
 */
export function isRoomOccupiedByOtherHost(pingVal, hostClientId, stableClientId, nowMs = Date.now()) {
  if (!isHostPingPresent(pingVal)) return false
  if (typeof hostClientId === 'string' && hostClientId) {
    return hostClientId !== stableClientId
  }
  return isHostPingFresh(pingVal, nowMs)
}

/**
 * Same browser reclaiming its room after refresh (do not wipe RTDB session payload).
 * @param {unknown} hostClientId
 * @param {unknown} endedVal
 * @param {string} stableClientId
 * @returns {boolean}
 */
export function isReclaimOwnHostRoom(hostClientId, endedVal, stableClientId) {
  return (
    typeof hostClientId === 'string' &&
    hostClientId === stableClientId &&
    !isRoomMarkedEnded(endedVal)
  )
}

/**
 * @param {unknown} pingVal RTDB `hostPing` value.
 * @param {unknown} endedVal RTDB `ended` value.
 * @param {{
 *   nowMs?: number,
 *   hostClientId?: unknown,
 *   stableClientId?: string,
 * }} [opts]
 * @returns {boolean}
 */
export function canClaimHostRoom(pingVal, endedVal, opts = {}) {
  const nowMs = opts.nowMs ?? Date.now()
  const stableClientId = opts.stableClientId
  const hostClientId = opts.hostClientId

  if (isRoomMarkedEnded(endedVal)) return true
  if (
    typeof stableClientId === 'string' &&
    stableClientId &&
    typeof hostClientId === 'string' &&
    hostClientId === stableClientId
  ) {
    return true
  }
  if (typeof stableClientId === 'string' && stableClientId) {
    return !isRoomOccupiedByOtherHost(pingVal, hostClientId, stableClientId, nowMs)
  }
  return !isHostPingFresh(pingVal, nowMs)
}
