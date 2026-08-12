/**
 * @param {unknown} value
 * @returns {value is Promise<unknown>}
 */
export function isThenable(value) {
  return value != null && typeof /** @type {{ then?: unknown }} */ (value).then === 'function'
}
