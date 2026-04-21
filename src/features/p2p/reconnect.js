/**
 * Shared reconnect timing helpers for every P2P session on the site.
 */

/**
 * Exponential backoff with jitter.
 * @param {number} attemptAfterFirst Zero-based: delay before attempt 2 uses index 0.
 * @param {{ baseMs?: number, maxMs?: number, jitterMs?: number }} [opts]
 * @returns {number}
 */
export function reconnectDelayMs(attemptAfterFirst, opts = {}) {
  const base = opts.baseMs ?? 800
  const max = opts.maxMs ?? 5000
  const jitter = opts.jitterMs ?? 400
  const exp = Math.min(base * 2 ** attemptAfterFirst, max)
  return exp + Math.floor(Math.random() * jitter)
}
