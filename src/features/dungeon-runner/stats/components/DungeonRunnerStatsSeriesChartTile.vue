<template>
  <DungeonRunnerStatsTileShell
    :title="tile.title"
    :loading="tileState.status === 'loading'"
    :error="tileState.status === 'error'"
  >
    <div
      v-if="tileState.status === 'ok' && tileState.chart"
      :data-testid="chartTestId"
    >
      <div v-if="hasTrendWindowControl" class="q-mb-md">
        <div class="text-caption text-grey-5 q-mb-xs">{{ trendWindowLabel }}</div>
        <q-slider
          v-model="trendWindowSize"
          :min="tileState.windowBounds.min"
          :max="tileState.windowBounds.max"
          :step="1"
          label
          color="primary"
          data-testid="dungeon-stats-trend-window-slider"
        />
      </div>
      <div class="dungeon-stats-series-chart">
        <Line
          v-if="tile.presentation === 'line-series'"
          :data="chartData"
          :options="chartOptions"
          :plugins="lineChartPlugins"
          :update-mode="hasTrendWindowControl ? 'none' : undefined"
        />
        <Chart
          v-else-if="useMixedBarLineChart"
          type="bar"
          :data="chartData"
          :options="chartOptions"
          :update-mode="hasTrendWindowControl ? 'none' : undefined"
        />
        <Bar v-else :data="chartData" :options="chartOptions" />
      </div>
    </div>
  </DungeonRunnerStatsTileShell>
</template>

<script setup>
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { computed } from 'vue'
import { Bar, Chart, Line } from 'vue-chartjs'
import {
  CHART_JS_TREND_WINDOW_CHART_ANIMATION_OPTIONS,
  CHART_JS_TREND_WINDOW_DATASET_ANIMATION_OPTIONS,
} from '../chartJsTrendWindowAnimationOptions.js'
import { createMatchOutcomeBandsPlugin } from '../dungeonRunnerMatchOutcomeBandsPlugin.js'
import { createModelPublishLinePlugin } from '../dungeonRunnerModelPublishTickPlugin.js'
import { useDungeonRunnerStatsSeriesChartTile } from '../useDungeonRunnerStatsSeriesChartTile.js'
import DungeonRunnerStatsTileShell from './DungeonRunnerStatsTileShell.vue'

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  BarElement,
  Filler,
  Tooltip,
)

const OVER_TIME_LINE_TILE_IDS = new Set(['match-length-over-time', 'rolling-human-win-rate'])
const WEEK_TREND_TILE_IDS = new Set(['matches-per-week'])

const props = defineProps({
  tile: {
    type: Object,
    required: true,
  },
  tileDeps: {
    type: Object,
    required: true,
  },
})

const supportsMatchTrendWindow = OVER_TIME_LINE_TILE_IDS.has(props.tile.id)
const supportsWeekTrendWindow = WEEK_TREND_TILE_IDS.has(props.tile.id)
const hasTrendWindowControl = supportsMatchTrendWindow || supportsWeekTrendWindow
const isHumanWinRateOverTime = props.tile.id === 'rolling-human-win-rate'

const trendWindowLabel = supportsWeekTrendWindow
  ? 'Trend window (weeks)'
  : 'Trend window (matches)'

const { tileState, trendWindowSize } = useDungeonRunnerStatsSeriesChartTile(
  props.tile.loadQuery,
  props.tileDeps,
  { supportsTrendWindow: supportsMatchTrendWindow, supportsWeekTrendWindow },
)

const modelPublishMarkers = computed(() => {
  if (!supportsMatchTrendWindow || tileState.value.status !== 'ok' || !tileState.value.chart?.modelPublishMarkers) {
    return []
  }
  return tileState.value.chart.modelPublishMarkers
})

const lineChartPlugins = computed(() => {
  const plugins = []
  if (
    isHumanWinRateOverTime &&
    tileState.value.status === 'ok' &&
    Array.isArray(tileState.value.chart?.values)
  ) {
    plugins.push(createMatchOutcomeBandsPlugin(tileState.value.chart.values))
  }
  if (supportsMatchTrendWindow) {
    plugins.push(createModelPublishLinePlugin(modelPublishMarkers.value))
  }
  return plugins
})

const hasRollingTrend = computed(
  () =>
    tileState.value.status === 'ok' &&
    Array.isArray(tileState.value.chart?.rollingAverageValues),
)

const useMixedBarLineChart = computed(
  () => props.tile.id === 'matches-per-week' && hasRollingTrend.value,
)

const useDualLineChart = computed(
  () => props.tile.presentation === 'line-series' && hasRollingTrend.value,
)

const chartTestId = computed(() =>
  props.tile.presentation === 'line-series'
    ? 'dungeon-stats-line-series-chart'
    : 'dungeon-stats-bar-series-chart',
)

const seriesStyle = computed(() => {
  if (supportsMatchTrendWindow) {
    return {
      borderColor: '#38bdf8',
      backgroundColor: 'rgba(56, 189, 248, 0.2)',
    }
  }
  return {
    borderColor: '#60a5fa',
    backgroundColor: 'rgba(96, 165, 250, 0.35)',
  }
})

const ROLLING_TREND_COLOR = '#eab308'

/**
 * @param {(number | null)[]} rollingAverageValues
 * @returns {object}
 */
function buildRollingTrendDataset(rollingAverageValues) {
  return {
    type: 'line',
    order: 1,
    trend: true,
    data: rollingAverageValues,
    borderColor: ROLLING_TREND_COLOR,
    backgroundColor: ROLLING_TREND_COLOR,
    pointRadius: 2,
    pointBackgroundColor: ROLLING_TREND_COLOR,
    tension: 0.2,
    spanGaps: false,
    ...(hasTrendWindowControl ? CHART_JS_TREND_WINDOW_DATASET_ANIMATION_OPTIONS : {}),
  }
}

const chartData = computed(() => {
  if (tileState.value.status !== 'ok' || !tileState.value.chart) {
    return { labels: [], datasets: [] }
  }
  const chart = tileState.value.chart
  const isLine = props.tile.presentation === 'line-series'
  if (useMixedBarLineChart.value) {
    return {
      labels: chart.labels,
      datasets: [
        {
          type: 'bar',
          order: 2,
          data: chart.values,
          borderColor: seriesStyle.value.borderColor,
          backgroundColor: seriesStyle.value.backgroundColor,
        },
        buildRollingTrendDataset(chart.rollingAverageValues),
      ],
    }
  }
  if (useDualLineChart.value) {
    if (isHumanWinRateOverTime) {
      return {
        labels: chart.labels,
        datasets: [buildRollingTrendDataset(chart.rollingAverageValues)],
      }
    }
    return {
      labels: chart.labels,
      datasets: [
        {
          order: 2,
          data: chart.values,
          borderColor: seriesStyle.value.borderColor,
          backgroundColor: seriesStyle.value.backgroundColor,
          tension: 0.2,
          pointRadius: 2,
          fill: true,
        },
        buildRollingTrendDataset(chart.rollingAverageValues),
      ],
    }
  }
  return {
    labels: chart.labels,
    datasets: [
      {
        data: chart.values,
        borderColor: seriesStyle.value.borderColor,
        backgroundColor: seriesStyle.value.backgroundColor,
        ...(isLine ? { tension: 0.2, pointRadius: 2, fill: true } : {}),
      },
    ],
  }
})

const chartOptions = computed(() => {
  const isLine = props.tile.presentation === 'line-series'
  return {
    responsive: true,
    maintainAspectRatio: false,
    ...(hasTrendWindowControl ? CHART_JS_TREND_WINDOW_CHART_ANIMATION_OPTIONS : {}),
    layout: {
      padding: {
        top: modelPublishMarkers.value.length > 0 ? 14 : 0,
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label(context) {
            const value = context.parsed.y
            if (value === null || !Number.isFinite(value)) return ''
            if (context.dataset.trend) {
              const unit = supportsWeekTrendWindow ? 'week' : 'match'
              if (isHumanWinRateOverTime) {
                return `${trendWindowSize.value}-${unit} avg: ${value.toFixed(1)}%`
              }
              return `${trendWindowSize.value}-${unit} avg: ${value.toFixed(1)}`
            }
            if (isHumanWinRateOverTime) {
              return value >= 50 ? 'Win' : 'Loss'
            }
            return String(Math.round(value))
          },
          afterBody(tooltipItems) {
            const item = tooltipItems[0]
            if (!item) return []
            const lines = []
            if (isHumanWinRateOverTime && tileState.value.status === 'ok') {
              const outcome = tileState.value.chart?.values?.[item.dataIndex]
              if (Number.isFinite(outcome)) {
                lines.push(outcome >= 50 ? 'Win' : 'Loss')
              }
            }
            if (!supportsMatchTrendWindow) {
              return lines
            }
            const marker = modelPublishMarkers.value.find(
              (candidate) => candidate.labelIndex === item.dataIndex,
            )
            if (marker) {
              lines.push(`Model published: ${marker.modelId}`)
            }
            return lines
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ...(isHumanWinRateOverTime ? { min: 0, max: 100 } : {}),
        ticks: {
          color: '#9ca3af',
          precision: 0,
          ...(isHumanWinRateOverTime
            ? {
                stepSize: 10,
                callback(value) {
                  return `${value}%`
                },
              }
            : {}),
        },
        title: {
          display: true,
          text: isHumanWinRateOverTime ? 'Win rate' : isLine ? 'History steps' : 'Matches',
          color: '#9ca3af',
        },
      },
      x: {
        ticks: {
          color: '#9ca3af',
          maxRotation: 45,
          minRotation: 0,
          autoSkip: true,
          maxTicksLimit: isLine ? 12 : 18,
        },
        title: {
          display: true,
          text: supportsMatchTrendWindow || isLine ? 'Match sequence' : 'Week starting',
          color: '#9ca3af',
        },
      },
    },
  }
})
</script>

<style scoped>
.dungeon-stats-series-chart {
  height: 220px;
}
</style>
