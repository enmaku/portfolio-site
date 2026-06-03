import { onMounted, ref, watch } from 'vue'
import { buildHumanWinRateOverTimeChart } from './buildHumanWinRateOverTimeChart.js'
import { buildMatchLengthOverTimeChart } from './buildMatchLengthOverTimeChart.js'
import { buildMatchesPerWeekChart } from './buildMatchesPerWeekChart.js'
import {
  createDungeonRunnerStatsTileLoadingState,
  runDungeonRunnerStatsTileLoad,
} from './dungeonRunnerStatsTileRunner.js'

/**
 * @param {(deps?: unknown) => Promise<unknown>} loadQuery
 * @param {unknown} [deps]
 * @param {{ supportsTrendWindow?: boolean, supportsWeekTrendWindow?: boolean }} [options]
 */
export function useDungeonRunnerStatsSeriesChartTile(loadQuery, deps, options = {}) {
  const supportsTrendWindow = options.supportsTrendWindow === true
  const supportsWeekTrendWindow = options.supportsWeekTrendWindow === true
  const hasTrendWindowControl = supportsTrendWindow || supportsWeekTrendWindow
  const tileState = ref(createDungeonRunnerStatsTileLoadingState())
  const trendWindowSize = ref(10)

  async function loadInitial() {
    tileState.value = await runDungeonRunnerStatsTileLoad(loadQuery, deps)
    if (hasTrendWindowControl && tileState.value.status === 'ok' && tileState.value.windowBounds) {
      trendWindowSize.value = tileState.value.windowBounds.default
    }
  }

  function applyTrendWindowSize() {
    if (!hasTrendWindowControl || tileState.value.status !== 'ok') {
      return
    }
    let rebuilt = null
    if (tileState.value.weeklyCounts && tileState.value.weekBuckets) {
      rebuilt = buildMatchesPerWeekChart(
        tileState.value.weekBuckets,
        tileState.value.weeklyCounts,
        trendWindowSize.value,
      )
    } else if (tileState.value.matchLengthSeries) {
      rebuilt = buildMatchLengthOverTimeChart(
        tileState.value.matchLengthSeries,
        tileState.value.publishedAtByModelId,
        trendWindowSize.value,
      )
    } else if (tileState.value.humanWonSeries) {
      rebuilt = buildHumanWinRateOverTimeChart(
        tileState.value.humanWonSeries,
        tileState.value.publishedAtByModelId,
        trendWindowSize.value,
      )
    }
    if (!rebuilt || rebuilt.status === 'error') {
      tileState.value = { status: 'error' }
      return
    }
    const chart =
      tileState.value.weeklyCounts && tileState.value.weekBuckets
        ? {
            labels: rebuilt.chart.labels,
            values: rebuilt.chart.values,
            rollingAverageValues: rebuilt.chart.rollingAverageValues,
          }
        : rebuilt.chart
    tileState.value = {
      ...tileState.value,
      chart,
    }
  }

  onMounted(loadInitial)

  if (hasTrendWindowControl) {
    watch(trendWindowSize, applyTrendWindowSize)
  }

  return { tileState, trendWindowSize }
}
