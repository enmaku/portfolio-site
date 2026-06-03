import { loadDefeatFlavorBreakdownTile } from './defeatFlavorBreakdownLoader.js'
import { loadEndVariantBreakdownTile } from './endVariantBreakdownLoader.js'
import { loadHumanEliminatedRateTile } from './humanEliminatedRateLoader.js'
import { loadHumanWinRateTile } from './humanWinRateLoader.js'
import { loadMatchLengthOverTimeTile } from './matchLengthOverTimeLoader.js'
import { loadMatchesPerWeekTile } from './matchesPerWeekLoader.js'
import { loadRollingHumanWinRateTile } from './rollingHumanWinRateLoader.js'
import { loadTotalMatchesTile } from './totalMatchesLoader.js'
import { loadWinnerRoleBreakdownTile } from './winnerRoleBreakdownLoader.js'

/** @typedef {import('./totalMatchesLoader.js').TotalMatchesTileResult} CountStatsTileLoadResult */
/** @typedef {import('./humanWinRateLoader.js').HumanWinRateTileResult} RateStatsTileLoadResult */
/** @typedef {import('./endVariantBreakdownLoader.js').EndVariantBreakdownTileResult} BreakdownStatsTileLoadResult */
/** @typedef {import('./rollingHumanWinRateLoader.js').RollingHumanWinRateTileResult} HumanWinRateOverTimeTileLoadResult */
/** @typedef {import('./matchLengthOverTimeLoader.js').MatchLengthOverTimeTileResult} LineSeriesStatsTileLoadResult */
/** @typedef {import('./matchesPerWeekLoader.js').MatchesPerWeekTileResult} BarSeriesStatsTileLoadResult */

/**
 * @typedef {object} DungeonRunnerStatsTileDefinition
 * @property {string} id
 * @property {string} title
 * @property {'count' | 'rate' | 'breakdown-chart' | 'line-series' | 'bar-series'} presentation
 * @property {'default' | 'full'} [span]
 * @property {(deps?: unknown) => Promise<
 *   | CountStatsTileLoadResult
 *   | RateStatsTileLoadResult
 *   | BreakdownStatsTileLoadResult
 *   | HumanWinRateOverTimeTileLoadResult
 *   | LineSeriesStatsTileLoadResult
 *   | BarSeriesStatsTileLoadResult
 * >} loadQuery
 */

/** @type {DungeonRunnerStatsTileDefinition[]} */
export const DUNGEON_RUNNER_STATS_TILE_REGISTRY = [
  {
    id: 'total-matches',
    title: 'Completed matches',
    presentation: 'count',
    loadQuery: (deps) => loadTotalMatchesTile(deps),
  },
  {
    id: 'human-win-rate',
    title: 'Human win rate',
    presentation: 'rate',
    loadQuery: (deps) => loadHumanWinRateTile(deps),
  },
  {
    id: 'human-eliminated-rate',
    title: 'Human eliminated rate',
    presentation: 'rate',
    loadQuery: (deps) => loadHumanEliminatedRateTile(deps),
  },
  {
    id: 'rolling-human-win-rate',
    title: 'Human win rate over time',
    presentation: 'line-series',
    span: 'full',
    loadQuery: (deps) => loadRollingHumanWinRateTile(deps),
  },
  {
    id: 'end-variant-breakdown',
    title: 'Match over end variant',
    presentation: 'breakdown-chart',
    loadQuery: (deps) => loadEndVariantBreakdownTile(deps),
  },
  {
    id: 'winner-role-breakdown',
    title: 'Winner role',
    presentation: 'breakdown-chart',
    loadQuery: (deps) => loadWinnerRoleBreakdownTile(deps),
  },
  {
    id: 'defeat-flavor-breakdown',
    title: 'Defeat flavor',
    presentation: 'breakdown-chart',
    loadQuery: (deps) => loadDefeatFlavorBreakdownTile(deps),
  },
  {
    id: 'match-length-over-time',
    title: 'Match length over time',
    presentation: 'line-series',
    span: 'full',
    loadQuery: (deps) => loadMatchLengthOverTimeTile(deps),
  },
  {
    id: 'matches-per-week',
    title: 'Matches per week',
    presentation: 'bar-series',
    span: 'full',
    loadQuery: (deps) => loadMatchesPerWeekTile(deps),
  },
]
