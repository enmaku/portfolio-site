/** @type {Readonly<Record<string, string>>} */
export const END_VARIANT_BREAKDOWN_CHART_COLORS = {
  victory: '#22c55e',
  'defeat-not-eliminated': '#f59e0b',
  'elimination-end-human': '#ef4444',
}

/** @type {Readonly<Record<string, string>>} */
export const WINNER_ROLE_BREAKDOWN_CHART_COLORS = {
  human: '#2dd4bf',
  nn: '#fb923c',
  randombot: '#cbd5e1',
}

/** @type {Readonly<Record<string, string>>} */
export const DEFEAT_FLAVOR_BREAKDOWN_CHART_COLORS = {
  'defeat-not-eliminated': '#f59e0b',
  'elimination-end-human': '#ef4444',
}

/** @type {Readonly<Record<string, Readonly<Record<string, string>>>>} */
export const DUNGEON_RUNNER_STATS_BREAKDOWN_CHART_COLORS_BY_TILE = {
  'end-variant-breakdown': END_VARIANT_BREAKDOWN_CHART_COLORS,
  'winner-role-breakdown': WINNER_ROLE_BREAKDOWN_CHART_COLORS,
  'defeat-flavor-breakdown': DEFEAT_FLAVOR_BREAKDOWN_CHART_COLORS,
}

/**
 * @param {string} tileId
 * @param {string} rowKey
 * @returns {string}
 */
export function getDungeonRunnerStatsBreakdownChartColor(tileId, rowKey) {
  return DUNGEON_RUNNER_STATS_BREAKDOWN_CHART_COLORS_BY_TILE[tileId]?.[rowKey] ?? '#94a3b8'
}
