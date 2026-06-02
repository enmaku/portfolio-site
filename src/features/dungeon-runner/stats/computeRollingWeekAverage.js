export const MATCHES_PER_WEEK_ROLLING_WINDOW_WEEKS = 3

/**
 * Rolling mean over weekly match counts, capped at *windowSize* weeks lookback.
 * Returns `null` only when that week has no matches; uses a shorter window at the
 * start of the series or after gaps so points with bar data still get a trend value.
 *
 * @param {number[]} counts oldest→newest
 * @param {number} [windowSize]
 * @returns {{ status: 'ok', values: (number | null)[] } | { status: 'error' }}
 */
export function computeRollingWeekAverage(counts, windowSize = MATCHES_PER_WEEK_ROLLING_WINDOW_WEEKS) {
  if (!Array.isArray(counts) || counts.length === 0 || windowSize < 1) {
    return { status: 'error' }
  }
  if (counts.some((count) => !Number.isFinite(count) || count < 0)) {
    return { status: 'error' }
  }

  /** @type {(number | null)[]} */
  const values = counts.map((count, index) => {
    if (count === 0) {
      return null
    }
    const windowStart = Math.max(0, index - windowSize + 1)
    let sum = 0
    let weeksInWindow = 0
    for (let offset = windowStart; offset <= index; offset += 1) {
      sum += counts[offset]
      weeksInWindow += 1
    }
    return sum / weeksInWindow
  })

  return { status: 'ok', values }
}
