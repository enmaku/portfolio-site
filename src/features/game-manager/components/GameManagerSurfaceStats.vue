<template>
  <div data-testid="gm-surface-stats" class="gm-surface column q-pa-md">
    <q-list bordered separator data-testid="gm-stats-list">
      <q-item
        v-for="row in rows"
        :key="`${row.personId}:${row.gameKey}`"
        :data-testid="`gm-stats-row-${row.personId}-${row.gameKey}`"
      >
        <q-item-section>
          <q-item-label>{{ row.personName }} · {{ row.gameTitle }}</q-item-label>
          <q-item-label caption>
            plays {{ row.playCount }}
            <template v-if="row.personalBest != null"> · best {{ row.personalBest }}</template>
            <template v-if="row.averageScore != null"> · avg {{ formatAvg(row.averageScore) }}</template>
            <template v-if="row.pointsPerMinute != null"> · ppm {{ formatAvg(row.pointsPerMinute) }}</template>
          </q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<script setup>
import { useGameManagerStats } from '../composables/useGameManagerStats.js'

const { rows } = useGameManagerStats()

function formatAvg(n) {
  return Number(n).toFixed(1)
}
</script>

<style scoped>
.gm-surface {
  min-height: 100%;
}
</style>
