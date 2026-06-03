export const MATCHES_PER_WEEK_ROLLING_WINDOW_WEEKS = 3

/**
 * Rolling mean capped at *windowSize* lookback; shorter window at series start.
 *
 * @param {number[]} values oldest→newest
 * @param {number} [windowSize]
 * @returns {{ status: 'ok', values: number[] } | { status: 'error' }}
 */
export function computeRollingAverage(
  values,
  windowSize = MATCHES_PER_WEEK_ROLLING_WINDOW_WEEKS,
) {
  if (!Array.isArray(values) || values.length === 0 || windowSize < 1) {
    return { status: 'error' }
  }
  if (values.some((value) => !Number.isFinite(value))) {
    return { status: 'error' }
  }

  const rollingValues = values.map((value, index) => {
    const windowStart = Math.max(0, index - windowSize + 1)
    let sum = 0
    let pointsInWindow = 0
    for (let offset = windowStart; offset <= index; offset += 1) {
      sum += values[offset]
      pointsInWindow += 1
    }
    return sum / pointsInWindow
  })

  return { status: 'ok', values: rollingValues }
}

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

  const rolling = computeRollingAverage(counts, windowSize)
  if (rolling.status === 'error') {
    return { status: 'error' }
  }

  /** @type {(number | null)[]} */
  const values = counts.map((count, index) => {
    if (count === 0) {
      return null
    }
    return rolling.values[index]
  })

  return { status: 'ok', values }
}
