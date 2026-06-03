<template>
  <DungeonRunnerStatsTileShell
    :title="tile.title"
    :loading="tileState.status === 'loading'"
    :error="tileState.status === 'error'"
  >
    <div
      v-if="tileState.status === 'ok'"
      data-testid="dungeon-stats-timeseries-chart"
    >
      <div class="q-mb-md">
        <div class="text-caption text-grey-5 q-mb-xs">Rolling window (matches)</div>
        <q-slider
          v-model="windowSize"
          :min="tileState.windowBounds.min"
          :max="tileState.windowBounds.max"
          :step="1"
          label
          color="primary"
          data-testid="dungeon-stats-rolling-window-slider"
        />
      </div>
      <div class="dungeon-stats-timeseries-chart">
        <Line :data="chartData" :options="chartOptions" :plugins="chartPlugins" />
      </div>
    </div>
  </DungeonRunnerStatsTileShell>
</template>

<script setup>
import {
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import DungeonRunnerStatsTileShell from './DungeonRunnerStatsTileShell.vue'
import { createModelPublishLinePlugin } from '../dungeonRunnerModelPublishTickPlugin.js'
import { useRollingHumanWinRateTile } from '../useRollingHumanWinRateTile.js'

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip)

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

const { tileState, windowSize } = useRollingHumanWinRateTile(
  props.tile.loadQuery,
  props.tileDeps,
)

const modelPublishMarkers = computed(() => {
  if (tileState.value.status !== 'ok' || !tileState.value.chart?.modelPublishMarkers) {
    return []
  }
  return tileState.value.chart.modelPublishMarkers
})

const chartPlugins = computed(() => [createModelPublishLinePlugin(modelPublishMarkers.value)])

const chartData = computed(() => {
  if (tileState.value.status !== 'ok' || !tileState.value.chart) {
    return { labels: [], datasets: [] }
  }
  return {
    labels: tileState.value.chart.labels,
    datasets: [
      {
        data: tileState.value.chart.percents,
        borderColor: '#60a5fa',
        backgroundColor: 'rgba(96, 165, 250, 0.15)',
        tension: 0.2,
        pointRadius: 2,
      },
    ],
  }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
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
          return `${value}%`
        },
        afterBody(tooltipItems) {
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
      min: 0,
      max: 100,
      ticks: {
        stepSize: 10,
        callback(value) {
          return `${value}%`
        },
      },
    },
    x: {
      title: {
        display: true,
        text: 'Match sequence',
        color: '#9ca3af',
      },
      ticks: {
        color: '#9ca3af',
      },
    },
  },
}))
</script>

<style scoped>
.dungeon-stats-timeseries-chart {
  height: 220px;
}
</style>
