/**
 * PeerJS error classification shared by every app that uses the `peerjs`
 * client.
 *
 * PeerJS surfaces wildly different `type` strings on its `error` event — some
 * are fatal to the underlying {@link Peer} instance, others are transient and
 * expected during normal reconnect loops. Callers should branch on
 * {@link classifyPeerError} rather than treating every error as a
 * "disconnected" signal, which tends to blow away healthy sessions.
 *
 * Reference:
 * - https://peerjs.com/docs/#peer-events-error
 * - https://github.com/peers/peerjs/blob/master/lib/enums.ts (PeerErrorType)
 */

/**
 * @typedef {'fatal' | 'transient' | 'unknown'} PeerErrorSeverity
 */

/**
 * Errors that destroy the `Peer` instance per the PeerJS contract, or indicate
 * configuration/environment problems that won't fix themselves by retrying.
 * @type {ReadonlySet<string>}
 */
const FATAL_TYPES = new Set([
  'browser-incompatible',
  'invalid-id',
  'invalid-key',
  'ssl-unavailable',
])

/**
 * Errors that are routinely recoverable via the app's reconnect loop (the
 * signaling server blipped, the data channel failed ICE, the peer id is still
 * releasing server-side, etc.).
 * @type {ReadonlySet<string>}
 */
const TRANSIENT_TYPES = new Set([
  'disconnected',
  'network',
  'peer-unavailable',
  'server-error',
  'socket-error',
  'socket-closed',
  'unavailable-id',
  'webrtc',
])

/**
 * @param {unknown} err
 * @returns {string}
 */
function errorTypeOf(err) {
  if (err && typeof err === 'object' && 'type' in err) {
    const t = /** @type {{type: unknown}} */ (err).type
    if (typeof t === 'string') return t
  }
  return ''
}

/**
 * @param {unknown} err
 * @returns {PeerErrorSeverity}
 */
export function classifyPeerError(err) {
  const type = errorTypeOf(err)
  if (FATAL_TYPES.has(type)) return 'fatal'
  if (TRANSIENT_TYPES.has(type)) return 'transient'
  return 'unknown'
}

/**
 * True when a host's attempt to claim a broker id failed because someone (often
 * a stale instance of the host itself) still holds it. Host-start/resume loops
 * should retry on this error.
 * @param {unknown} err
 * @returns {boolean}
 */
export function isUnavailableIdError(err) {
  return errorTypeOf(err) === 'unavailable-id'
}
