/**
 * @typedef {import('../firebase/matchLengthSeriesQuery.js').MatchLengthSeriesRecord} MatchLengthSeriesRecord
 */

/**
 * @typedef {object} MatchLengthOverTimeChart
 * @property {string[]} labels
 * @property {number[]} values
 */

/**
 * @param {string} createdAt
 * @returns {string}
 */
export function formatMatchLengthAxisLabel(createdAt) {
  const parsed = Date.parse(createdAt)
  if (!Number.isFinite(parsed)) return createdAt
  return new Date(parsed).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * @param {MatchLengthSeriesRecord[]} series oldest→newest
 * @returns {{ status: 'ok', chart: MatchLengthOverTimeChart } | { status: 'error' }}
 */
export function buildMatchLengthOverTimeChart(series) {
  if (!Array.isArray(series) || series.length === 0) {
    return { status: 'error' }
  }

  const labels = series.map((point) => formatMatchLengthAxisLabel(point.createdAt))
  const values = series.map((point) => point.historyStepCount)
  if (values.some((value) => !Number.isFinite(value))) {
    return { status: 'error' }
  }

  return {
    status: 'ok',
    chart: { labels, values },
  }
}
