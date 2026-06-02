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
      <div class="dungeon-stats-series-chart">
        <Line v-if="tile.presentation === 'line-series'" :data="chartData" :options="chartOptions" />
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
import { useDungeonRunnerStatsTile } from '../useDungeonRunnerStatsTile.js'
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

const { tileState } = useDungeonRunnerStatsTile(props.tile.loadQuery, props.tileDeps)

const useMixedBarLineChart = computed(
  () =>
    props.tile.id === 'matches-per-week' &&
    tileState.value.status === 'ok' &&
    Array.isArray(tileState.value.chart?.rollingAverageValues),
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

const MATCHES_PER_WEEK_TREND_COLOR = '#eab308'

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
        {
          type: 'line',
          order: 1,
          data: chart.rollingAverageValues,
          borderColor: MATCHES_PER_WEEK_TREND_COLOR,
          backgroundColor: MATCHES_PER_WEEK_TREND_COLOR,
          pointRadius: 2,
          pointBackgroundColor: MATCHES_PER_WEEK_TREND_COLOR,
          tension: 0.2,
          spanGaps: false,
        },
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
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label(context) {
            const value = context.parsed.y
            if (value === null || !Number.isFinite(value)) return ''
            if (context.dataset.type === 'line') {
              return `3-week avg: ${value.toFixed(1)}`
            }
            return String(Math.round(value))
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
          text: isLine ? 'Match date' : 'Week starting',
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
