/**
 * @import '../types.js'
 * Wire messages between game timer collaborators (JSON payloads on RTDB).
 */

import { isWellFormedGuestIntent } from './guestIntentDedupe.js'

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

/** Guest → hub: stable client identity presented right after attach so the
 *  host can remap this guest onto an existing participant slot instead of
 *  allocating a new one on every reconnect. */
export const MSG_GUEST_HELLO = 'gt-hi'

/**
 * @param {unknown} data
 * @returns {data is { type: string, snapshot?: GameTimerSyncPayload, seq?: number }}
 */
export function isRecord(data) {
  return data != null && typeof data === 'object' && !Array.isArray(data)
}

/**
 * RTDB stores dense JS arrays as `{ "0": …, "1": … }` maps; turn logic expects real arrays.
 * @param {unknown} value
 * @returns {string[]}
 */
export function coerceStringIdList(value) {
  if (Array.isArray(value)) {
    return value.filter((id) => typeof id === 'string' && id)
  }
  if (!isRecord(value)) return []
  const keys = Object.keys(value).filter((k) => /^\d+$/.test(k))
  keys.sort((a, b) => Number(a) - Number(b))
  /** @type {string[]} */
  const out = []
  for (const k of keys) {
    const id = value[k]
    if (typeof id === 'string' && id) out.push(id)
  }
  return out
}

/**
 * RTDB turns `{ "1": ["a"] }` into a sparse array (length 2, data at index 1).
 * A mistaken flat `["a", "b"]` write is also stored as an array. Recover both shapes.
 * @param {unknown} raw
 * @param {number} [defaultRound] Used when `raw` is a flat player-id list (no round keys).
 * @returns {Record<string, string[]>}
 */
export function coerceRoundIdMap(raw, defaultRound = 1) {
  if (Array.isArray(raw)) {
    /** @type {Record<string, string[]>} */
    const out = {}
    for (let i = 0; i < raw.length; i++) {
      const el = raw[i]
      if (el == null) continue
      const list = coerceStringIdList(el)
      if (list.length === 0) continue
      if (Array.isArray(el) || isRecord(el)) {
        out[String(i)] = list
      }
    }
    if (Object.keys(out).length > 0) return out
    const flat = coerceStringIdList(raw)
    if (flat.length > 0) return { [String(defaultRound)]: flat }
    return {}
  }
  if (!isRecord(raw)) return {}
  /** @type {Record<string, string[]>} */
  const out = {}
  for (const [roundKey, listVal] of Object.entries(raw)) {
    out[roundKey] = coerceStringIdList(listVal)
  }
  return out
}

/**
 * @param {unknown} raw
 * @returns {import('../types.js').GameTimerPlayer[]}
 */
export function coercePlayersList(raw) {
  if (Array.isArray(raw)) return raw
  if (!isRecord(raw)) return []
  const keys = Object.keys(raw).filter((k) => /^\d+$/.test(k))
  keys.sort((a, b) => Number(a) - Number(b))
  /** @type {import('../types.js').GameTimerPlayer[]} */
  const out = []
  for (const k of keys) {
    const p = raw[k]
    if (isRecord(p) && typeof p.id === 'string') {
      out.push(/** @type {import('../types.js').GameTimerPlayer} */ (p))
    }
  }
  return out
}

/**
 * RTDB deletes keys set to `null`, so snapshots read back omit nullable turn fields.
 * @param {unknown} raw
 * @returns {GameTimerSyncPayload}
 */
export function normalizeSnapshotFromRtdb(raw) {
  if (!isRecord(raw)) {
    return {
      players: [],
      activePlayerId: null,
      turnStartedAt: null,
      turnStartedRound: null,
      round: 1,
      playerOrderByRound: {},
      hardPassEnabled: false,
      hardPassOrderNextRound: false,
      hardPassOrderByRound: {},
    }
  }
  const round = typeof raw.round === 'number' ? raw.round : 1
  /** @type {GameTimerSyncPayload} */
  const out = {
    players: coercePlayersList(raw.players),
    activePlayerId: typeof raw.activePlayerId === 'string' ? raw.activePlayerId : null,
    turnStartedAt: typeof raw.turnStartedAt === 'number' ? raw.turnStartedAt : null,
    turnStartedRound: typeof raw.turnStartedRound === 'number' ? raw.turnStartedRound : null,
    round,
    playerOrderByRound: coerceRoundIdMap(raw.playerOrderByRound, round),
    hardPassEnabled: typeof raw.hardPassEnabled === 'boolean' ? raw.hardPassEnabled : false,
    hardPassOrderNextRound:
      typeof raw.hardPassOrderNextRound === 'boolean' ? raw.hardPassOrderNextRound : false,
    hardPassOrderByRound: coerceRoundIdMap(raw.hardPassOrderByRound, round),
  }
  if ('totalGameStartedAt' in raw) {
    out.totalGameStartedAt =
      typeof raw.totalGameStartedAt === 'number' ? raw.totalGameStartedAt : null
  }
  return out
}

/**
 * @param {unknown} snap
 * @returns {snap is GameTimerSyncPayload}
 */
export function isValidSnapshot(snap) {
  if (!isRecord(snap)) return false
  if (!Array.isArray(snap.players) && !isRecord(snap.players)) return false
  if (snap.activePlayerId != null && typeof snap.activePlayerId !== 'string') return false
  if (snap.turnStartedAt != null && typeof snap.turnStartedAt !== 'number') return false
  if (snap.turnStartedRound != null && typeof snap.turnStartedRound !== 'number') return false
  if (typeof snap.round !== 'number') return false
  if (!snap.playerOrderByRound || typeof snap.playerOrderByRound !== 'object' || Array.isArray(snap.playerOrderByRound)) {
    return false
  }
  if (
    'totalGameStartedAt' in snap &&
    snap.totalGameStartedAt !== null &&
    typeof snap.totalGameStartedAt !== 'number'
  ) {
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
 * @param {{ kind: 'selectPlayer' | 'registerHardPass', playerId: string, sentAt: number } | undefined} [intent]
 * @returns {{ type: typeof MSG_GUEST_UPDATE, snapshot: GameTimerSyncPayload, intent?: typeof intent }}
 */
export function encodeGuestUpdate(snapshot, intent) {
  if (intent != null) {
    return { type: MSG_GUEST_UPDATE, snapshot, intent }
  }
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
 * @returns {{ type: typeof MSG_GUEST_UPDATE, snapshot: GameTimerSyncPayload, intent?: { kind: 'selectPlayer' | 'registerHardPass', playerId: string, sentAt: number } } | null}
 */
export function parseGuestMessage(data) {
  if (!isRecord(data) || data.type !== MSG_GUEST_UPDATE) return null
  const snapshot = normalizeSnapshotFromRtdb(data.snapshot)
  if (!isValidSnapshot(snapshot)) return null
  /** @type {{ type: typeof MSG_GUEST_UPDATE, snapshot: GameTimerSyncPayload, intent?: { kind: 'selectPlayer' | 'registerHardPass', playerId: string, sentAt: number } }} */
  const out = { type: MSG_GUEST_UPDATE, snapshot }
  if (!('intent' in data)) return out
  if (isWellFormedGuestIntent(data.intent)) {
    out.intent = {
      kind: data.intent.kind,
      playerId: data.intent.playerId,
      sentAt: data.intent.sentAt,
    }
    return out
  }
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
    console.warn('[gameTimer P2P] malformed guest intent ignored')
  }
  return out
}

/**
 * @param {unknown} data
 * @returns {boolean}
 */
export function isHostEndedNotice(data) {
  return isRecord(data) && data.type === MSG_HOST_ENDED
}

/**
 * @param {string} stableId
 * @returns {{ type: typeof MSG_GUEST_HELLO, stableId: string }}
 */
export function encodeGuestHello(stableId) {
  return { type: MSG_GUEST_HELLO, stableId }
}

/**
 * @param {unknown} data
 * @returns {{ stableId: string } | null}
 */
export function parseGuestHello(data) {
  if (!isRecord(data) || data.type !== MSG_GUEST_HELLO) return null
  if (typeof data.stableId !== 'string' || !data.stableId) return null
  return { stableId: data.stableId }
}

/**
 * @param {unknown} data
 * @returns {{ type: typeof MSG_HOST_SNAPSHOT, snapshot: GameTimerSyncPayload, seq: number } | null}
 */
export function parseHostMessage(data) {
  if (!isRecord(data)) return null
  if (data.type != null && data.type !== MSG_HOST_SNAPSHOT) return null
  if (typeof data.seq !== 'number' || data.seq < 1) return null
  const snapshot = normalizeSnapshotFromRtdb(data.snapshot)
  if (!isValidSnapshot(snapshot)) return null
  return { type: MSG_HOST_SNAPSHOT, snapshot, seq: data.seq }
}
