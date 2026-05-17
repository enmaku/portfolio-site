/**
 * Star-room shell: shared reconnect loops for RTDB-backed sessions
 * (Game Timer, Movie Vote). Feature code supplies closures (establish
 * guest/host, notify, teardown). The shell does not import Pinia or Quasar.
 *
 * ## Adapter contract (call order)
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

import { starRoomReconnectDelayMs } from './starRoomReconnectDelay.js'
import { RECONNECT_INITIAL_PAUSE_MS, RECONNECT_MAX_ATTEMPTS } from './starRoomTiming.js'

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
