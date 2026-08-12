<template>
  <div
    class="wind-rose-preview"
    data-testid="world-builder-wind-rose"
  >
    <PolarArea
      :data="chartData"
      :options="chartOptions"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  ArcElement,
  Chart as ChartJS,
  Legend,
  RadialLinearScale,
  Tooltip,
} from 'chart.js'
import { PolarArea } from 'vue-chartjs'
import { buildWindRosePreviewModel } from '@world-builder/buildWindRosePreviewModel.js'

ChartJS.register(RadialLinearScale, ArcElement, Tooltip, Legend)

const props = defineProps({
  geographySeed: {
    type: Number,
    required: true,
  },
  prevailingWindDegrees: {
    type: Number,
    required: true,
  },
  secondaryMaximumDegrees: {
    type: Number,
    required: true,
  },
})

const preview = computed(() =>
  buildWindRosePreviewModel({
    geographySeed: props.geographySeed,
    prevailingWindDegrees: props.prevailingWindDegrees,
    secondaryMaximumDegrees: props.secondaryMaximumDegrees,
  }),
)

const chartData = computed(() => ({
  labels: preview.value.labels,
  datasets: [
    {
      data: preview.value.displayWeights,
      backgroundColor: preview.value.weights.map((weight) =>
        weight > 0 ? 'rgba(83, 99, 105, 0.92)' : 'rgba(255, 255, 255, 0.08)',
      ),
      borderColor: 'rgba(33, 33, 33, 0.95)',
      borderWidth: 1,
    },
  ],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  animation: false,
  plugins: {
    legend: { display: false },
    tooltip: { enabled: false },
  },
  scales: {
    r: {
      ticks: { display: false },
      grid: { color: 'rgba(255, 255, 255, 0.08)' },
      angleLines: { color: 'rgba(255, 255, 255, 0.08)' },
      pointLabels: { display: false },
    },
  },
}
</script>

<style scoped>
.wind-rose-preview {
  width: 100%;
  aspect-ratio: 1;
  margin: 16px 0 0;
}
</style>
