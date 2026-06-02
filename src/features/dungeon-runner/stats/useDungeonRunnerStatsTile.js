import { onMounted, ref } from 'vue'
import {
  createDungeonRunnerStatsTileLoadingState,
  runDungeonRunnerStatsTileLoad,
} from './dungeonRunnerStatsTileRunner.js'

/**
 * @param {(deps?: unknown) => Promise<
 *   | { status: 'ok', value: number | string }
 *   | { status: 'ok', breakdown: import('./dungeonRunnerStatsTileRunner.js').DungeonRunnerStatsBreakdownRow[] }
 *   | { status: 'error' }
 * >} loadQuery
 * @param {unknown} [deps]
 */
export function useDungeonRunnerStatsTile(loadQuery, deps) {
  const tileState = ref(createDungeonRunnerStatsTileLoadingState())

  onMounted(async () => {
    tileState.value = await runDungeonRunnerStatsTileLoad(loadQuery, deps)
  })

  return { tileState }
}
