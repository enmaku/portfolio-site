/**
 * Shared timing and PeerJS client options for star-hub P2P sessions (Game Timer, Movie Vote).
 */

export const RECONNECT_MAX_ATTEMPTS = 10
export const RECONNECT_BASE_DELAY_MS = 800
export const RECONNECT_MAX_DELAY_MS = 5000
export const RECONNECT_INITIAL_PAUSE_MS = 1000

/** @type {const} */
export const PEER_OPTS = {
  serialization: 'json',
  reliable: true,
}

/** First connect / resume: allow slow signaling. */
export const OPEN_PEER_TIMEOUT_MS = 20000

/** Reconnect loops: fail each try faster so backoff dominates. */
export const RECONNECT_PEER_TIMEOUT_MS = 8000

/** Hub → guests while hosting. */
export const HEARTBEAT_INTERVAL_MS = 3000

/** Guest: no snapshot or ping from host for this long ⇒ reconnect. */
export const HEARTBEAT_STALE_MS = 12_000

/** Guest: how often we check staleness. */
export const HEARTBEAT_GUEST_CHECK_MS = 2000
