/**
 * Star-room P2P shell: shared Peer error wiring and reconnect loops used by
 * feature sessions (Game Timer, Movie Vote). Feature code supplies closures
 * (establish guest/host, notify, teardown). The shell does not import Pinia
 * or Quasar.
 *
 * ## Adapter contract (call order)
 *
 * **wireStarRoomPeerErrors** — Register once per open `Peer`. On each error:
 * 1. `classifyPeerError` (internal) → if `fatal`: `bumpReconnectGeneration`,
 *    `clearRoomPersistence`, `notifyP2p` (fatal message), `teardownSession`, return.
 * 2. Else: if `getIsHost()` then `onHostDisconnected()` else `onGuestDisconnected()`.
 *
 * **runGuestStarReconnectLoop** — After guest sets phase to `reconnecting`:
 * 1. `sleep(RECONNECT_INITIAL_PAUSE_MS)`; abort if `gen !== getReconnectGeneration()`.
 * 2. For attempts 1..`RECONNECT_MAX_ATTEMPTS`: optional notify + backoff sleep;
 *    `destroyWireOnly()` then `await establishGuest()`; if generation changed,
 *    `leaveSession()` and return; on success return.
 * 3. On exhaustion: `clearRoomPersistence`, `notifyGuestReconnectFailed`, `teardownSession`.
 *
 * **runHostStarReconnectLoop** — Same structure; `establishHost` replaces
 * `establishGuest`; final failure uses `notifyHostReconnectFailed`.
 */

import { classifyPeerError } from './errors.js'
import { starRoomReconnectDelayMs } from './starRoomReconnectDelay.js'
import { RECONNECT_INITIAL_PAUSE_MS, RECONNECT_MAX_ATTEMPTS } from './starRoomTiming.js'

/**
 * @typedef {object} StarRoomPeerErrorHandlers
 * @property {() => void} bumpReconnectGeneration
 * @property {() => void} clearRoomPersistence
 * @property {(message: string, type: 'positive' | 'negative' | 'warning' | 'info') => void} notifyP2p
 * @property {() => void} teardownSession
 * @property {() => boolean} getIsHost
 * @property {() => void} onHostDisconnected
 * @property {() => void} onGuestDisconnected
 */

/**
 * @param {import('peerjs').Peer} peer
 * @param {StarRoomPeerErrorHandlers} h
 * @returns {void}
 */
export function wireStarRoomPeerErrors(peer, h) {
  peer.on('error', (err) => {
    const severity = classifyPeerError(err)
    if (severity === 'fatal') {
      h.bumpReconnectGeneration()
      h.clearRoomPersistence()
      const msg =
        err && typeof err === 'object' && 'type' in err
          ? `P2P error: ${/** @type {{ type: string }} */ (err).type}`
          : 'P2P error'
      h.notifyP2p(msg, 'negative')
      h.teardownSession()
      return
    }
    if (h.getIsHost()) h.onHostDisconnected()
    else h.onGuestDisconnected()
  })
}

/**
 * @typedef {object} StarRoomGuestReconnectHandlers
 * @property {number} gen
 * @property {() => number} getReconnectGeneration
 * @property {(ms: number) => Promise<void>} sleep
 * @property {(attempt: number, maxAttempts: number) => void} notifyReconnectingGuest
 * @property {() => void} destroyWireOnly
 * @property {() => Promise<void>} establishGuest
 * @property {() => void} leaveSession
 * @property {() => void} clearRoomPersistence
 * @property {() => void} notifyGuestReconnectFailed
 * @property {() => void} teardownSession
 */

/**
 * @param {StarRoomGuestReconnectHandlers} h
 * @returns {Promise<void>}
 */
export async function runGuestStarReconnectLoop(h) {
  await h.sleep(RECONNECT_INITIAL_PAUSE_MS)
  if (h.gen !== h.getReconnectGeneration()) return

  for (let attempt = 1; attempt <= RECONNECT_MAX_ATTEMPTS; attempt++) {
    if (h.gen !== h.getReconnectGeneration()) return

    if (attempt > 1) {
      h.notifyReconnectingGuest(attempt, RECONNECT_MAX_ATTEMPTS)
      await h.sleep(starRoomReconnectDelayMs(attempt - 2))
    }

    if (h.gen !== h.getReconnectGeneration()) return

    try {
      h.destroyWireOnly()
      await h.establishGuest()
      if (h.gen !== h.getReconnectGeneration()) {
        h.leaveSession()
        return
      }
      return
    } catch {
      continue
    }
  }

  if (h.gen !== h.getReconnectGeneration()) return

  h.clearRoomPersistence()
  h.notifyGuestReconnectFailed()
  h.teardownSession()
}

/**
 * @typedef {object} StarRoomHostReconnectHandlers
 * @property {number} gen
 * @property {() => number} getReconnectGeneration
 * @property {(ms: number) => Promise<void>} sleep
 * @property {(attempt: number, maxAttempts: number) => void} notifyReconnectingHost
 * @property {() => void} destroyWireOnly
 * @property {() => Promise<void>} establishHost
 * @property {() => void} leaveSession
 * @property {() => void} clearRoomPersistence
 * @property {() => void} notifyHostReconnectFailed
 * @property {() => void} teardownSession
 */

/**
 * @param {StarRoomHostReconnectHandlers} h
 * @returns {Promise<void>}
 */
export async function runHostStarReconnectLoop(h) {
  await h.sleep(RECONNECT_INITIAL_PAUSE_MS)
  if (h.gen !== h.getReconnectGeneration()) return

  for (let attempt = 1; attempt <= RECONNECT_MAX_ATTEMPTS; attempt++) {
    if (h.gen !== h.getReconnectGeneration()) return

    if (attempt > 1) {
      h.notifyReconnectingHost(attempt, RECONNECT_MAX_ATTEMPTS)
      await h.sleep(starRoomReconnectDelayMs(attempt - 2))
    }

    if (h.gen !== h.getReconnectGeneration()) return

    try {
      h.destroyWireOnly()
      await h.establishHost()
      if (h.gen !== h.getReconnectGeneration()) {
        h.leaveSession()
        return
      }
      return
    } catch {
      continue
    }
  }

  if (h.gen !== h.getReconnectGeneration()) return

  h.clearRoomPersistence()
  h.notifyHostReconnectFailed()
  h.teardownSession()
}
