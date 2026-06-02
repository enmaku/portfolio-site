<template>
  <DungeonRunnerStatsTileShell
    :title="tile.title"
    :loading="tileState.status === 'loading'"
    :error="tileState.status === 'error' || chartModel.status === 'error'"
  >
    <div
      v-if="tileState.status === 'ok' && chartModel.status === 'ok'"
      data-testid="dungeon-stats-breakdown-chart"
    >
      <div class="dungeon-stats-breakdown-chart">
        <Doughnut :data="chartData" :options="chartOptions" />
      </div>
      <div class="q-mt-md" data-testid="dungeon-stats-tile-breakdown">
        <div
          v-for="(rowKey, index) in chartModel.chart.keys"
          :key="rowKey"
          class="row items-center q-col-gutter-sm q-mb-xs"
          :data-testid="`dungeon-stats-breakdown-row-${rowKey}`"
        >
          <div class="col-auto">
            <span
              class="dungeon-stats-breakdown-swatch"
              :style="{ backgroundColor: segmentColor(rowKey) }"
              aria-hidden="true"
            />
          </div>
          <div class="col text-body2">
            {{ breakdownRowLabel(rowKey) }}
          </div>
          <div
            class="col-auto text-caption text-grey-5"
            :data-testid="`dungeon-stats-breakdown-count-${rowKey}`"
          >
            {{ chartModel.chart.counts[index] }} ({{ chartModel.chart.percents[index] }}%)
          </div>
        </div>
      </div>
    </div>
  </DungeonRunnerStatsTileShell>
</template>

<script setup>
import {
  ArcElement,
  Chart as ChartJS,
  Legend,
  Tooltip,
} from 'chart.js'
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import { buildMatchOutcomeBreakdownChart } from '../buildMatchOutcomeBreakdownChart.js'
import { getDungeonRunnerStatsBreakdownRowLabel } from '../dungeonRunnerStatsBreakdownLabels.js'
import { getDungeonRunnerStatsBreakdownChartColor } from '../dungeonRunnerStatsBreakdownChartColors.js'
import { useDungeonRunnerStatsTile } from '../useDungeonRunnerStatsTile.js'
import DungeonRunnerStatsTileShell from './DungeonRunnerStatsTileShell.vue'

ChartJS.register(ArcElement, Tooltip, Legend)

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

const chartModel = computed(() => {
  if (tileState.value.status !== 'ok' || !Array.isArray(tileState.value.breakdown)) {
    return { status: 'error' }
  }
  return buildMatchOutcomeBreakdownChart(tileState.value.breakdown)
})

const chartData = computed(() => {
  if (chartModel.value.status !== 'ok') {
    return { labels: [], datasets: [] }
  }
  const { chart } = chartModel.value
  return {
    labels: chart.keys.map((key) => breakdownRowLabel(key)),
    datasets: [
      {
        data: chart.counts,
        backgroundColor: chart.keys.map((key) => segmentColor(key)),
        borderWidth: 0,
      },
    ],
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '58%',
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      callbacks: {
        label(context) {
          const count = context.parsed
          const data = context.dataset.data
          const total = data.reduce((sum, value) => sum + value, 0)
          if (!Number.isFinite(total) || total <= 0) return String(count)
          const percent = Math.round((count / total) * 100)
          return `${count} (${percent}%)`
        },
      },
    },
  },
}

function breakdownRowLabel(rowKey) {
  return getDungeonRunnerStatsBreakdownRowLabel(props.tile.id, rowKey)
}

function segmentColor(rowKey) {
  return getDungeonRunnerStatsBreakdownChartColor(props.tile.id, rowKey)
}
</script>

<style scoped>
.dungeon-stats-breakdown-chart {
  height: 180px;
  max-width: 220px;
  margin: 0 auto;
}

.dungeon-stats-breakdown-swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
}
</style>
