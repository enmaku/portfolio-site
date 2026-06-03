/**
 * @typedef {object} HumanWinSeriesPoint
 * @property {boolean} humanWon
 * @property {unknown} [createdAt]
 */

/**
 * @typedef {object} RollingHumanWinRatePoint
 * @property {number} sequence 1-based match position in the loaded series
 * @property {number} percent whole-percent win rate for the strict window ending here
 */

/**
 * @param {HumanWinSeriesPoint[]} series oldest→newest
 * @param {number} windowSize strict rolling window *n*
 * @returns {{ status: 'ok', points: RollingHumanWinRatePoint[] } | { status: 'error' }}
 */
export function computeRollingHumanWinRate(series, windowSize) {
  if (!Array.isArray(series) || series.length < windowSize || windowSize < 1) {
    return { status: 'error' }
  }

  /** @type {RollingHumanWinRatePoint[]} */
  const points = []
  for (let index = windowSize - 1; index < series.length; index += 1) {
    let wins = 0
    for (let offset = index - windowSize + 1; offset <= index; offset += 1) {
      if (series[offset]?.humanWon === true) {
        wins += 1
      }
    }
    const percent = Math.round((wins / windowSize) * 100)
    points.push({ sequence: index + 1, percent })
  }

  return { status: 'ok', points }
}
