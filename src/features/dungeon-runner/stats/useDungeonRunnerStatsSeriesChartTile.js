import { onMounted, ref, watch } from 'vue'
import { buildMatchLengthOverTimeChart } from './buildMatchLengthOverTimeChart.js'
import {
  createDungeonRunnerStatsTileLoadingState,
  runDungeonRunnerStatsTileLoad,
} from './dungeonRunnerStatsTileRunner.js'

/**
 * @param {(deps?: unknown) => Promise<unknown>} loadQuery
 * @param {unknown} [deps]
 * @param {{ supportsMatchLengthTrendWindow?: boolean }} [options]
 */
export function useDungeonRunnerStatsSeriesChartTile(loadQuery, deps, options = {}) {
  const supportsMatchLengthTrendWindow = options.supportsMatchLengthTrendWindow === true
  const tileState = ref(createDungeonRunnerStatsTileLoadingState())
  const trendWindowSize = ref(10)

  async function loadInitial() {
    tileState.value = await runDungeonRunnerStatsTileLoad(loadQuery, deps)
    if (
      supportsMatchLengthTrendWindow &&
      tileState.value.status === 'ok' &&
      tileState.value.windowBounds
    ) {
      trendWindowSize.value = tileState.value.windowBounds.default
    }
  }

  function applyTrendWindowSize() {
    if (
      !supportsMatchLengthTrendWindow ||
      tileState.value.status !== 'ok' ||
      !tileState.value.matchLengthSeries
    ) {
      return
    }
    const rebuilt = buildMatchLengthOverTimeChart(
      tileState.value.matchLengthSeries,
      tileState.value.publishedAtByModelId,
      trendWindowSize.value,
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

  if (supportsMatchLengthTrendWindow) {
    watch(trendWindowSize, applyTrendWindowSize)
  }

  return { tileState, trendWindowSize }
}
