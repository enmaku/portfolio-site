<template>
  <div v-if="hasValues" class="tt-stats-bar" :data-testid="testId">
    <Bar :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup>
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from 'chart.js'
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import { formatUsdFromCents } from '../formatDisplay.js'
import { STATS_CHART_COLORS, STATS_OTHER_COLOR } from '../statistics/statsChartColors.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

const props = defineProps({
  bucketSeries: { type: Object, required: true },
  testId: { type: String, required: true },
})

const hasValues = computed(() =>
  [...props.bucketSeries.series.map((item) => item.valuesCents), props.bucketSeries.otherValuesCents].some(
    (values) => values.some((value) => Number(value) > 0),
  ),
)

const chartData = computed(() => {
  const datasets = props.bucketSeries.series.map((item, index) => ({
    label: item.label,
    data: item.valuesCents.map((cents) => cents / 100),
    backgroundColor: STATS_CHART_COLORS[index % STATS_CHART_COLORS.length],
    stack: 'income',
  }))
  if (props.bucketSeries.otherValuesCents.some((cents) => cents > 0)) {
    datasets.push({
      label: 'Other',
      data: props.bucketSeries.otherValuesCents.map((cents) => cents / 100),
      backgroundColor: STATS_OTHER_COLOR,
      stack: 'income',
    })
  }
  return { labels: props.bucketSeries.labels, datasets }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  resizeDelay: 0,
  plugins: {
    legend: { display: false },
    tooltip: {
      itemSort: (left, right) => right.parsed.y - left.parsed.y,
      callbacks: {
        title(items) {
          return props.bucketSeries.titles[items[0]?.dataIndex] ?? ''
        },
        label(context) {
          if (!(context.parsed.y > 0)) return ''
          return `${context.dataset.label}: ${formatUsdFromCents(Math.round(context.parsed.y * 100))}`
        },
        footer(items) {
          if (!items.length) return ''
          let total = 0
          for (const item of items) total += item.parsed.y
          return `Total: ${formatUsdFromCents(Math.round(total * 100))}`
        },
      },
    },
  },
  scales: {
    x: {
      stacked: true,
      grid: { display: false },
      ticks: { color: '#9ca3af', autoSkip: true, maxTicksLimit: 8, maxRotation: 0 },
    },
    y: {
      stacked: true,
      beginAtZero: true,
      ticks: {
        color: '#9ca3af',
        maxTicksLimit: 4,
        callback: (value) => `$${formatCompactAxis(value)}`,
      },
    },
  },
}))

function formatCompactAxis(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return ''
  if (Math.abs(amount) >= 1000) {
    const thousands = amount / 1000
    return `${thousands % 1 === 0 ? thousands : thousands.toFixed(1)}k`
  }
  return String(Math.round(amount))
}
</script>

<style scoped>
.tt-stats-bar {
  position: relative;
  width: 100%;
  height: 180px;
  overflow: hidden;
}

.tt-stats-bar :deep(canvas) {
  display: block !important;
}
</style>
