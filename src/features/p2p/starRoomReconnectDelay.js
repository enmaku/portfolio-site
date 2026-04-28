/**
 * Star-room reconnect backoff using shared {@link ./reconnect.js} tuning.
 */

import { reconnectDelayMs as reconnectDelayMsCore } from './reconnect.js'
import { RECONNECT_BASE_DELAY_MS, RECONNECT_MAX_DELAY_MS } from './starRoomTiming.js'

/**
 * @param {number} attemptAfterFirst Zero-based: delay before attempt 2 uses index 0.
 * @returns {number}
 */
export function starRoomReconnectDelayMs(attemptAfterFirst) {
  return reconnectDelayMsCore(attemptAfterFirst, {
    baseMs: RECONNECT_BASE_DELAY_MS,
    maxMs: RECONNECT_MAX_DELAY_MS,
  })
}
