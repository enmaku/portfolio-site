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
      <div v-if="supportsMatchLengthTrendWindow" class="q-mb-md">
        <div class="text-caption text-grey-5 q-mb-xs">Trend window (matches)</div>
        <q-slider
          v-model="trendWindowSize"
          :min="tileState.windowBounds.min"
          :max="tileState.windowBounds.max"
          :step="1"
          label
          color="primary"
          data-testid="dungeon-stats-match-length-trend-window-slider"
        />
      </div>
      <div class="dungeon-stats-series-chart">
        <Line
          v-if="tile.presentation === 'line-series'"
          :data="chartData"
          :options="chartOptions"
          :plugins="lineChartPlugins"
          :update-mode="supportsMatchLengthTrendWindow ? 'none' : undefined"
        />
        <Chart v-else-if="useMixedBarLineChart" type="bar" :data="chartData" :options="chartOptions" />
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

const supportsMatchLengthTrendWindow = props.tile.id === 'match-length-over-time'

const { tileState, trendWindowSize } = useDungeonRunnerStatsSeriesChartTile(
  props.tile.loadQuery,
  props.tileDeps,
  { supportsMatchLengthTrendWindow },
)

const modelPublishMarkers = computed(() => {
  if (
    props.tile.id !== 'match-length-over-time' ||
    tileState.value.status !== 'ok' ||
    !tileState.value.chart?.modelPublishMarkers
  ) {
    return []
  }
  return tileState.value.chart.modelPublishMarkers
})

const lineChartPlugins = computed(() => {
  if (props.tile.id !== 'match-length-over-time') {
    return []
  }
  return [createModelPublishLinePlugin(modelPublishMarkers.value)]
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
  if (props.tile.id === 'match-length-over-time') {
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
function buildRollingTrendDataset(rollingAverageValues, options = {}) {
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
    ...(options.disableAnimation
      ? {
          animations: {
            x: { duration: 0 },
            y: { duration: 0 },
          },
          transitions: {
            active: { animation: { duration: 0 } },
            show: { animations: { x: { duration: 0 }, y: { duration: 0 } } },
            hide: { animations: { x: { duration: 0 }, y: { duration: 0 } } },
          },
        }
      : {}),
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
        buildRollingTrendDataset(chart.rollingAverageValues, {
          disableAnimation: supportsMatchLengthTrendWindow,
        }),
      ],
    }
  }
  if (useDualLineChart.value) {
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
        buildRollingTrendDataset(chart.rollingAverageValues, {
          disableAnimation: supportsMatchLengthTrendWindow,
        }),
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
    ...(supportsMatchLengthTrendWindow
      ? {
          animation: false,
          transitions: {
            active: { animation: { duration: 0 } },
            resize: { animation: { duration: 0 } },
            show: { animations: { x: { duration: 0 }, y: { duration: 0 } } },
            hide: { animations: { x: { duration: 0 }, y: { duration: 0 } } },
          },
        }
      : {}),
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
              if (props.tile.id === 'match-length-over-time') {
                return `${trendWindowSize.value}-match avg: ${value.toFixed(1)}`
              }
              return `3-week avg: ${value.toFixed(1)}`
            }
            return String(Math.round(value))
          },
          afterBody(tooltipItems) {
            if (props.tile.id !== 'match-length-over-time') {
              return []
            }
            const item = tooltipItems[0]
            if (!item) return []
            const marker = modelPublishMarkers.value.find(
              (candidate) => candidate.labelIndex === item.dataIndex,
            )
            if (!marker) return []
            return [`Model published: ${marker.modelId}`]
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: '#9ca3af',
          precision: 0,
        },
        title: {
          display: true,
          text: isLine ? 'History steps' : 'Matches',
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
          text:
            props.tile.id === 'match-length-over-time'
              ? 'Match sequence'
              : isLine
                ? 'Match date'
                : 'Week starting',
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
