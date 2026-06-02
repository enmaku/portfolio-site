import { DUNGEON_RUNNER_STATS_TILE_REGISTRY } from './tiles/registry.js'

/** @typedef {import('./tiles/registry.js').DungeonRunnerStatsTileDefinition} DungeonRunnerStatsTileDescriptor */

/** @type {DungeonRunnerStatsTileDescriptor[]} */
export const DUNGEON_RUNNER_STATS_TILES = DUNGEON_RUNNER_STATS_TILE_REGISTRY

/**
 * @param {{ isFirebaseConfigured: boolean }} options
 */
export function buildDungeonRunnerStatsPageModel({ isFirebaseConfigured }) {
  return {
    showDashboardError: !isFirebaseConfigured,
    showTileGrid: isFirebaseConfigured,
    tiles: isFirebaseConfigured ? DUNGEON_RUNNER_STATS_TILES : [],
  }
}
