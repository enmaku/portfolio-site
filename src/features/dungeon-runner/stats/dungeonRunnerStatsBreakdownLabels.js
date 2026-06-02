import { MATCH_OVER_END_VARIANTS } from '../ui/humanEliminationCompletionPolicy.js'

/** @type {Readonly<Record<string, string>>} */
export const END_VARIANT_BREAKDOWN_LABELS = {
  [MATCH_OVER_END_VARIANTS.VICTORY]: 'Victory',
  [MATCH_OVER_END_VARIANTS.DEFEAT_NOT_ELIMINATED]: 'Defeat (not eliminated)',
  [MATCH_OVER_END_VARIANTS.ELIMINATION_END_HUMAN]: 'Elimination end (human)',
}

/** @type {Readonly<Record<string, string>>} */
export const WINNER_ROLE_BREAKDOWN_LABELS = {
  human: 'Human',
  nn: 'Neural opponent',
  randombot: 'Randombot',
}

/** @type {Readonly<Record<string, Readonly<Record<string, string>>>>} */
export const DUNGEON_RUNNER_STATS_BREAKDOWN_LABELS_BY_TILE = {
  'end-variant-breakdown': END_VARIANT_BREAKDOWN_LABELS,
  'winner-role-breakdown': WINNER_ROLE_BREAKDOWN_LABELS,
}

/**
 * @param {string} tileId
 * @param {string} rowKey
 * @returns {string}
 */
export function getDungeonRunnerStatsBreakdownRowLabel(tileId, rowKey) {
  return DUNGEON_RUNNER_STATS_BREAKDOWN_LABELS_BY_TILE[tileId]?.[rowKey] ?? rowKey
}
