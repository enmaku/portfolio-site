/**
 * @typedef {import('./dungeonRunnerStatsTileRunner.js').DungeonRunnerStatsBreakdownRow} DungeonRunnerStatsBreakdownRow
 */

/**
 * @typedef {object} MatchOutcomeBreakdownChart
 * @property {string[]} keys
 * @property {number[]} counts
 * @property {number[]} percents whole-percent shares
 * @property {number} total
 */

/**
 * @param {DungeonRunnerStatsBreakdownRow[]} breakdown
 * @returns {{ status: 'ok', chart: MatchOutcomeBreakdownChart } | { status: 'error' }}
 */
export function buildMatchOutcomeBreakdownChart(breakdown) {
  if (!Array.isArray(breakdown) || breakdown.length === 0) {
    return { status: 'error' }
  }

  let total = 0
  for (const row of breakdown) {
    if (!row || typeof row.key !== 'string' || !Number.isFinite(row.count) || row.count < 0) {
      return { status: 'error' }
    }
    total += row.count
  }
  if (total <= 0) {
    return { status: 'error' }
  }

  return {
    status: 'ok',
    chart: {
      keys: breakdown.map((row) => row.key),
      counts: breakdown.map((row) => row.count),
      percents: breakdown.map((row) => Math.round((row.count / total) * 100)),
      total,
    },
  }
}
