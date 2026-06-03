import { onMounted, ref, watch } from 'vue'
import { buildRollingHumanWinRateChart } from './buildRollingHumanWinRateChart.js'
import {
  createDungeonRunnerStatsTileLoadingState,
  runDungeonRunnerStatsTileLoad,
} from './dungeonRunnerStatsTileRunner.js'

/**
 * @param {(deps?: unknown) => Promise<import('./tiles/rollingHumanWinRateLoader.js').RollingHumanWinRateTileResult>} loadQuery
 * @param {unknown} [deps]
 */
export function useRollingHumanWinRateTile(loadQuery, deps) {
  const tileState = ref(createDungeonRunnerStatsTileLoadingState())
  const windowSize = ref(10)

  async function loadInitial() {
    tileState.value = await runDungeonRunnerStatsTileLoad(loadQuery, deps)
    if (tileState.value.status === 'ok' && tileState.value.windowBounds) {
      windowSize.value = tileState.value.windowBounds.default
    }
  }

  function applyWindowSize() {
    if (tileState.value.status !== 'ok' || !tileState.value.humanWonSeries) {
      return
    }
    const rebuilt = buildRollingHumanWinRateChart(
      tileState.value.humanWonSeries,
      windowSize.value,
      tileState.value.publishedAtByModelId,
    )
    if (rebuilt.status === 'error') {
      tileState.value = { status: 'error' }
      return
    }
    tileState.value = {
      ...tileState.value,
      chart: rebuilt.chart,
    }
  }

  onMounted(loadInitial)

  watch(windowSize, applyWindowSize)

  return { tileState, windowSize }
}
