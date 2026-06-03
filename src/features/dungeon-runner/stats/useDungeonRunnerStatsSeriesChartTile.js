import { onMounted, ref, watch } from 'vue'
import { buildHumanWinRateOverTimeChart } from './buildHumanWinRateOverTimeChart.js'
import { buildMatchLengthOverTimeChart } from './buildMatchLengthOverTimeChart.js'
import { buildMatchesPerWeekChart } from './buildMatchesPerWeekChart.js'
import {
  createDungeonRunnerStatsTileLoadingState,
  runDungeonRunnerStatsTileLoad,
} from './dungeonRunnerStatsTileRunner.js'

/**
 * @typedef {import('./dungeonRunnerStatsTileRunner.js').DungeonRunnerStatsTileState} DungeonRunnerStatsTileState
 */

/**
 * @param {DungeonRunnerStatsTileState} state
 * @returns {unknown[] | null}
 */
function getMatchSequenceSeries(state) {
  if (state.matchLengthSeries) {
    return state.matchLengthSeries
  }
  if (state.humanWonSeries) {
    return state.humanWonSeries
  }
  return null
}

/**
 * @param {DungeonRunnerStatsTileState} state
 * @param {number} trendWindowSize
 * @param {(series: unknown[], publishedAtByModelId: Record<string, string> | undefined, windowSize: number) => { status: string, chart?: object }} buildChart
 * @returns {{ status: string, chart?: object } | null}
 */
function rebuildMatchSequenceChart(state, trendWindowSize, buildChart) {
  const series = getMatchSequenceSeries(state)
  if (!series) {
    return null
  }
  return buildChart(series, state.publishedAtByModelId, trendWindowSize)
}

/**
 * @param {{ status: string, chart: { labels: string[], values: number[], rollingAverageValues?: (number | null)[] } }} built
 * @returns {{ labels: string[], values: number[], rollingAverageValues?: (number | null)[] }}
 */
function chartPayloadFromWeekRebuild(built) {
  return {
    labels: built.chart.labels,
    values: built.chart.values,
    rollingAverageValues: built.chart.rollingAverageValues,
  }
}

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
    let chartFromRebuild = null
    if (tileState.value.weeklyCounts && tileState.value.weekBuckets) {
      rebuilt = buildMatchesPerWeekChart(
        tileState.value.weekBuckets,
        tileState.value.weeklyCounts,
        trendWindowSize.value,
      )
      if (rebuilt?.status === 'ok') {
        chartFromRebuild = chartPayloadFromWeekRebuild(rebuilt)
      }
    } else {
      const buildChart = tileState.value.matchLengthSeries
        ? buildMatchLengthOverTimeChart
        : buildHumanWinRateOverTimeChart
      rebuilt = rebuildMatchSequenceChart(tileState.value, trendWindowSize.value, buildChart)
      if (rebuilt?.status === 'ok') {
        chartFromRebuild = rebuilt.chart
      }
    }
    if (!rebuilt || rebuilt.status === 'error' || !chartFromRebuild) {
      tileState.value = { status: 'error' }
      return
    }
    tileState.value = {
      ...tileState.value,
      chart: chartFromRebuild,
    }
  }

  onMounted(loadInitial)

  if (hasTrendWindowControl) {
    watch(trendWindowSize, applyTrendWindowSize)
  }

  return { tileState, trendWindowSize }
}
