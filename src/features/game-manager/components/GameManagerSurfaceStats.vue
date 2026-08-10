<template>
  <div data-testid="gm-surface-stats" class="gm-surface">
    <div class="gm-surface__scroll q-pa-md">
      <div
        v-if="!rows.length"
        class="gm-empty column items-center q-mx-auto q-py-xl text-center text-grey-5"
        data-testid="gm-stats-empty"
      >
        <p class="q-mb-sm text-body1">No stats yet.</p>
        <p class="q-mb-none text-body2">Complete a play session to see per-person, per-game records.</p>
      </div>

      <div v-else class="column q-gutter-sm" data-testid="gm-stats-list">
        <div
          v-for="row in rows"
          :key="`${row.personId}:${row.gameKey}`"
          class="gm-stats-row row items-center no-wrap q-px-md"
          :data-testid="`gm-stats-row-${row.personId}-${row.gameKey}`"
          :style="rowStyle(row)"
        >
          <q-avatar
            v-if="row.personColor"
            size="28px"
            :style="{ backgroundColor: row.personColor }"
            class="q-mr-md"
          />
          <div class="col">
            <div class="text-body2 text-weight-medium">
              {{ row.personName }} · {{ row.gameTitle }}
            </div>
            <div class="text-caption text-grey-6">
              plays {{ row.playCount }}
              <template v-if="row.personalBest != null"> · best {{ row.personalBest }}</template>
              <template v-if="row.averageScore != null"> · avg {{ formatAvg(row.averageScore) }}</template>
              <template v-if="row.pointsPerMinute != null">
                · ppm {{ formatAvg(row.pointsPerMinute) }}
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useGameManagerStats } from '../composables/useGameManagerStats.js'

const { rows } = useGameManagerStats()

function formatAvg(n) {
  return Number(n).toFixed(1)
}

function rowStyle(row) {
  if (!row.personColor) {
    return { background: 'rgba(255,255,255,0.04)', minHeight: '64px', borderRadius: '8px' }
  }
  return {
    background: `linear-gradient(90deg, ${row.personColor}33 0%, rgba(255,255,255,0.04) 48%)`,
    minHeight: '64px',
    borderRadius: '8px',
  }
}
</script>
