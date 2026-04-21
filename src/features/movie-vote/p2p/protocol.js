/**
 * @import '../types.js'
 * @import '../irv.js'
 */

export const MSG_MV_HOST_PING = 'mv-p'
export const MSG_MV_HOST_ENDED = 'mv-x'
export const MSG_MV_HOST_VISIBILITY = 'mv-v'
export const MSG_MV_WELCOME = 'mv-w'
export const MSG_MV_STATE = 'mv-s'

/** Guest → host: stable client identity presented right after `open` so the
 *  host can remap this connection onto an existing participant slot instead of
 *  allocating a new one on every reconnect. */
export const MSG_MV_HELLO = 'mv-hi'

/** Guest → host: draft picks + ready flag */
export const MSG_MV_DRAFT = 'mv-d'
/** Guest → host: final IRV ranking */
export const MSG_MV_VOTE = 'mv-vt'

/**
 * @param {unknown} data
 * @returns {data is Record<string, unknown>}
 */
export function isRecord(data) {
  return data != null && typeof data === 'object' && !Array.isArray(data)
}

/**
 * @param {unknown} data
 * @returns {boolean}
 */
export function isHostPing(data) {
  return isRecord(data) && data.type === MSG_MV_HOST_PING
}

/**
 * @returns {{ type: typeof MSG_MV_HOST_PING, t: number }}
 */
export function encodeHostPing() {
  return { type: MSG_MV_HOST_PING, t: Date.now() }
}

/**
 * @returns {boolean}
 */
export function isHostEndedNotice(data) {
  return isRecord(data) && data.type === MSG_MV_HOST_ENDED
}

/**
 * @param {boolean} visible
 */
export function encodeHostVisibility(visible) {
  return { type: MSG_MV_HOST_VISIBILITY, visible, t: Date.now() }
}

/**
 * @param {unknown} data
 */
export function parseHostVisibility(data) {
  if (!isRecord(data) || data.type !== MSG_MV_HOST_VISIBILITY) return null
  if (typeof data.visible !== 'boolean') return null
  return { visible: data.visible, t: typeof data.t === 'number' ? data.t : 0 }
}

/**
 * @param {string} stableId
 */
export function encodeHello(stableId) {
  return { v: 1, type: MSG_MV_HELLO, stableId }
}

/**
 * @param {unknown} data
 * @returns {{ stableId: string } | null}
 */
export function parseHello(data) {
  if (!isRecord(data) || data.type !== MSG_MV_HELLO) return null
  if (typeof data.stableId !== 'string' || !data.stableId) return null
  return { stableId: data.stableId }
}

/**
 * @param {string} participantId
 * @param {boolean} [resumed] True if host reused an existing participant slot.
 */
export function encodeWelcome(participantId, resumed = false) {
  return { v: 1, type: MSG_MV_WELCOME, participantId, resumed: Boolean(resumed) }
}

/**
 * @param {unknown} data
 * @returns {{ participantId: string, resumed: boolean } | null}
 */
export function parseWelcome(data) {
  if (!isRecord(data) || data.type !== MSG_MV_WELCOME) return null
  if (typeof data.participantId !== 'string' || !data.participantId) return null
  return {
    participantId: data.participantId,
    resumed: data.resumed === true,
  }
}

/**
 * @param {import('../types.js').MovieVotePublicPayload} payload
 * @param {number} seq
 */
export function encodeState(payload, seq) {
  return { v: 1, type: MSG_MV_STATE, seq, payload }
}

/**
 * @param {unknown} data
 * @returns {{ seq: number, payload: import('../types.js').MovieVotePublicPayload } | null}
 */
export function parseState(data) {
  if (!isRecord(data) || data.type !== MSG_MV_STATE) return null
  if (typeof data.seq !== 'number' || data.seq < 1) return null
  const payload = data.payload
  if (!isRecord(payload)) return null
  if (payload.phase !== 'suggest' && payload.phase !== 'voting' && payload.phase !== 'results') return null
  if (!Array.isArray(payload.participants)) return null
  return { seq: data.seq, payload: /** @type {import('../types.js').MovieVotePublicPayload} */ (payload) }
}

/**
 * @param {import('../types.js').MoviePick[]} picks
 * @param {boolean} ready
 * @param {string} participantId
 */
export function encodeDraft(picks, ready, participantId) {
  return { v: 1, type: MSG_MV_DRAFT, participantId, picks, ready }
}

/**
 * @param {unknown} data
 */
export function parseDraft(data) {
  if (!isRecord(data) || data.type !== MSG_MV_DRAFT) return null
  if (typeof data.participantId !== 'string') return null
  if (typeof data.ready !== 'boolean') return null
  if (!Array.isArray(data.picks)) return null
  return {
    participantId: data.participantId,
    ready: data.ready,
    picks: /** @type {import('../types.js').MoviePick[]} */ (data.picks),
  }
}

/**
 * @param {string} participantId
 * @param {string[]} ranking
 */
export function encodeVote(participantId, ranking) {
  return { v: 1, type: MSG_MV_VOTE, participantId, ranking }
}

/**
 * @param {unknown} data
 */
export function parseVote(data) {
  if (!isRecord(data) || data.type !== MSG_MV_VOTE) return null
  if (typeof data.participantId !== 'string') return null
  if (!Array.isArray(data.ranking) || !data.ranking.every((x) => typeof x === 'string')) return null
  return { participantId: data.participantId, ranking: [...data.ranking] }
}
