/**
 * @typedef {object} CappedTrendWindowConfig
 * @property {number} min
 * @property {number} default
 * @property {number} maxCap
 */

/**
 * @param {number} length
 * @param {CappedTrendWindowConfig} config
 * @returns {{ status: 'ok', min: number, max: number, default: number } | { status: 'error' }}
 */
export function resolveCappedTrendWindowSize(length, config) {
  if (!Number.isFinite(length) || length < 1) {
    return { status: 'error' }
  }
  const max = Math.min(config.maxCap, length)
  const min = Math.min(config.min, length)
  const defaultWindow = Math.min(config.default, length)
  return { status: 'ok', min, max, default: defaultWindow }
}
