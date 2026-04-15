/**
 * @import '../types.js'
 * Wire messages between game timer peers (JSON via PeerJS `serialization: 'json'`).
 */

/** Guest → hub: push snapshot after a local mutation. */
export const MSG_GUEST_UPDATE = 'gt-u'

/** Hub → guest: authoritative snapshot with monotonic sequence (per room hub). */
export const MSG_HOST_SNAPSHOT = 'gt-s'

/** Hub → guest: host is closing the room intentionally (before connections drop). */
export const MSG_HOST_ENDED = 'gt-x'

/** Hub → guest: keepalive so guests detect a stalled or backgrounded host. */
export const MSG_HOST_PING = 'gt-p'

/** Hub → guest: host tab visibility (`document.visibilityState`) for UX / liveness hints. */
export const MSG_HOST_VISIBILITY = 'gt-v'

/**
 * @param {unknown} data
 * @returns {data is { type: string, snapshot?: GameTimerSyncPayload, seq?: number }}
 */
export function isRecord(data) {
  return data != null && typeof data === 'object' && !Array.isArray(data)
}

/**
 * @param {unknown} snap
 * @returns {snap is GameTimerSyncPayload}
 */
export function isValidSnapshot(snap) {
  if (!isRecord(snap)) return false
  if (!Array.isArray(snap.players)) return false
  if (!('activePlayerId' in snap) || !('turnStartedAt' in snap) || !('turnStartedRound' in snap)) return false
  if (typeof snap.round !== 'number') return false
  if (!snap.playerOrderByRound || typeof snap.playerOrderByRound !== 'object' || Array.isArray(snap.playerOrderByRound)) {
    return false
  }
  if ('hardPassEnabled' in snap && typeof snap.hardPassEnabled !== 'boolean') return false
  if ('hardPassOrderNextRound' in snap && typeof snap.hardPassOrderNextRound !== 'boolean') return false
  if ('hardPassOrderByRound' in snap) {
    const h = snap.hardPassOrderByRound
    if (!h || typeof h !== 'object' || Array.isArray(h)) return false
  }
  return true
}

/**
 * @param {GameTimerSyncPayload} snapshot
 * @returns {{ type: typeof MSG_GUEST_UPDATE, snapshot: GameTimerSyncPayload }}
 */
export function encodeGuestUpdate(snapshot) {
  return { type: MSG_GUEST_UPDATE, snapshot }
}

/**
 * @param {GameTimerSyncPayload} snapshot
 * @param {number} seq
 * @returns {{ type: typeof MSG_HOST_SNAPSHOT, snapshot: GameTimerSyncPayload, seq: number }}
 */
export function encodeHostSnapshot(snapshot, seq) {
  return { type: MSG_HOST_SNAPSHOT, snapshot, seq }
}

/**
 * Host keepalive payload (timestamp for debugging; guests only check message type).
 * @returns {{ type: typeof MSG_HOST_PING, t: number }}
 */
export function encodeHostPing() {
  return { type: MSG_HOST_PING, t: Date.now() }
}

/**
 * @param {unknown} data
 * @returns {boolean}
 */
export function isHostPing(data) {
  return isRecord(data) && data.type === MSG_HOST_PING
}

/**
 * @param {boolean} visible Same idea as `document.visibilityState === 'visible'` on the host.
 * @returns {{ type: typeof MSG_HOST_VISIBILITY, visible: boolean, t: number }}
 */
export function encodeHostVisibility(visible) {
  return { type: MSG_HOST_VISIBILITY, visible, t: Date.now() }
}

/**
 * @param {unknown} data
 * @returns {{ type: typeof MSG_HOST_VISIBILITY, visible: boolean, t: number } | null}
 */
export function parseHostVisibility(data) {
  if (!isRecord(data) || data.type !== MSG_HOST_VISIBILITY) return null
  if (typeof data.visible !== 'boolean') return null
  return {
    type: MSG_HOST_VISIBILITY,
    visible: data.visible,
    t: typeof data.t === 'number' ? data.t : 0,
  }
}

/**
 * @param {unknown} data
 * @returns {{ type: typeof MSG_GUEST_UPDATE, snapshot: GameTimerSyncPayload } | null}
 */
export function parseGuestMessage(data) {
  if (!isRecord(data) || data.type !== MSG_GUEST_UPDATE) return null
  if (!isValidSnapshot(data.snapshot)) return null
  return { type: MSG_GUEST_UPDATE, snapshot: data.snapshot }
}

/**
 * @param {unknown} data
 * @returns {boolean}
 */
export function isHostEndedNotice(data) {
  return isRecord(data) && data.type === MSG_HOST_ENDED
}

/**
 * @param {unknown} data
 * @returns {{ type: typeof MSG_HOST_SNAPSHOT, snapshot: GameTimerSyncPayload, seq: number } | null}
 */
export function parseHostMessage(data) {
  if (!isRecord(data) || data.type !== MSG_HOST_SNAPSHOT) return null
  if (typeof data.seq !== 'number' || data.seq < 1) return null
  if (!isValidSnapshot(data.snapshot)) return null
  return { type: MSG_HOST_SNAPSHOT, snapshot: data.snapshot, seq: data.seq }
}
