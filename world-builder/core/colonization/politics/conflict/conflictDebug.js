/**
 * Temporary conquest/war diagnostics for live browser debugging.
 * Filter DevTools console by `[wb-conflict]`.
 * Disabled in Node unless WB_CONFLICT_DEBUG=1.
 */

const PREFIX = '[wb-conflict]'

const enabled =
  typeof process === 'undefined' ||
  process.env?.WB_CONFLICT_DEBUG === '1' ||
  (typeof window !== 'undefined' && window?.location != null)

/**
 * @param {string} step
 * @param {Record<string, unknown>} [payload]
 */
export function conflictDebug(step, payload) {
  if (!enabled) return
  if (payload === undefined) {
    console.log(PREFIX, step)
    return
  }
  console.log(PREFIX, step, payload)
}
