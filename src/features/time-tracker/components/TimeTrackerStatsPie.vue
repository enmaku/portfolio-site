<template>
  <div v-if="hasValues" class="tt-stats-pie" :data-testid="testId">
    <Doughnut :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup>
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js'
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps({
  labels: { type: Array, required: true },
  values: { type: Array, required: true },
  colors: { type: Array, required: true },
  testId: { type: String, required: true },
})

const hasValues = computed(() => props.values.some((value) => Number(value) > 0))

const chartData = computed(() => ({
  labels: props.labels,
  datasets: [
    {
      data: props.values,
      backgroundColor: props.colors,
      borderWidth: 0,
    },
  ],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  resizeDelay: 0,
  cutout: '62%',
  plugins: {
    legend: { display: false },
    tooltip: { enabled: true },
  },
}
</script>

<style scoped>
.tt-stats-pie {
  position: relative;
  width: 100%;
  height: 148px;
  overflow: hidden;
}

.tt-stats-pie :deep(canvas) {
  display: block !important;
}
</style>
