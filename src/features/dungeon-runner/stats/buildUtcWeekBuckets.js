export const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

/** @typedef {object} UtcWeekBucket
 * @property {string} startInclusive ISO-8601 week start (inclusive)
 * @property {string} endExclusive ISO-8601 week end (exclusive)
 * @property {string} label short axis label for the week start
 */

/**
 * @param {number} ms
 * @returns {number}
 */
export function startOfUtcWeekMs(ms) {
  const date = new Date(ms)
  const day = date.getUTCDay()
  const daysFromMonday = (day + 6) % 7
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - daysFromMonday)
}

/**
 * @param {number} weekStartMs
 * @returns {string}
 */
export function formatUtcWeekAxisLabel(weekStartMs) {
  const date = new Date(weekStartMs)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/**
 * Builds consecutive UTC calendar weeks ending at the week that contains `nowMs`.
 *
 * @param {{ nowMs?: number, weekCount?: number }} [options]
 * @returns {UtcWeekBucket[]}
 */
export function buildUtcWeekBuckets({ nowMs = Date.now(), weekCount = 52 } = {}) {
  if (!Number.isFinite(weekCount) || weekCount < 1) {
    return []
  }
  const currentWeekStartMs = startOfUtcWeekMs(nowMs)
  /** @type {UtcWeekBucket[]} */
  const buckets = []
  for (let index = weekCount - 1; index >= 0; index -= 1) {
    const weekStartMs = currentWeekStartMs - index * MS_PER_WEEK
    const weekEndMs = weekStartMs + MS_PER_WEEK
    buckets.push({
      startInclusive: new Date(weekStartMs).toISOString(),
      endExclusive: new Date(weekEndMs).toISOString(),
      label: formatUtcWeekAxisLabel(weekStartMs),
    })
  }
  return buckets
}
