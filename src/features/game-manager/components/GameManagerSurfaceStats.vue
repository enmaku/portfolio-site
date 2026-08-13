<template>
  <div data-testid="gm-surface-stats" class="gm-surface">
    <div class="gm-surface__scroll q-pa-md column no-wrap q-gutter-y-lg">
      <div v-if="loading" class="row flex-center q-py-lg full-width" data-testid="gm-stats-loading">
        <q-spinner color="primary" size="2em" />
      </div>

      <template v-else>
        <div class="column q-gutter-y-lg full-width" data-testid="gm-stats-headlines">
          <div class="full-width">
            <div class="row items-stretch">
              <div class="col-4 column flex-center text-center q-px-sm">
                <div class="text-caption text-grey-6">Sessions</div>
              </div>
              <div class="col-4 column flex-center text-center q-px-sm">
                <div class="text-caption text-grey-6">Games played</div>
              </div>
              <div class="col-4 column flex-center text-center q-px-sm">
                <div class="text-caption text-grey-6">Games owned</div>
              </div>
            </div>
            <div class="row items-center q-mt-xs">
              <div class="col-4 text-center text-h5 q-px-sm" data-testid="gm-stats-sessions-recorded">
                {{ model.sessionsRecorded }}
              </div>
              <div class="col-4 text-center text-h5 q-px-sm" data-testid="gm-stats-games-played">
                {{ model.gamesPlayed }}
              </div>
              <div class="col-4 text-center text-h5 q-px-sm" data-testid="gm-stats-games-in-collection">
                {{ model.gamesInCollection }}
              </div>
            </div>
          </div>

          <div class="full-width">
            <div class="row items-stretch">
              <div class="col-6 column flex-center text-center q-px-sm">
                <div class="text-caption text-grey-6">Total play time</div>
              </div>
              <div class="col-6 column flex-center text-center q-px-sm">
                <div class="row items-center justify-center no-wrap">
                  <div class="text-caption text-grey-6">H-index</div>
                  <q-icon name="info_outline" size="16px" class="q-ml-xs text-grey-5">
                    <q-tooltip max-width="260px">
                      Largest N where you have N games each played at least N times. Higher means
                      both breadth and depth—many titles revisited. Lower means a thin shelf of
                      one-offs or only a few games played so far.
                    </q-tooltip>
                  </q-icon>
                </div>
              </div>
            </div>
            <div class="row items-center q-mt-xs">
              <div class="col-6 text-center text-h5 q-px-sm" data-testid="gm-stats-play-time">
                {{ formatDuration(model.playTimeMs) }}
              </div>
              <div class="col-6 text-center text-h5 q-px-sm" data-testid="gm-stats-h-index">
                {{ model.hIndex }}
              </div>
            </div>
          </div>
        </div>

        <q-separator class="full-width" />

        <div class="column q-gutter-y-sm full-width" data-testid="gm-stats-win-share">
          <div class="text-subtitle2 text-center">Win share</div>
          <div
            v-if="winShareChart.status === 'ok'"
            class="row flex-center"
            data-testid="gm-stats-win-share-chart"
          >
            <div class="gm-stats-win-share-chart">
              <Doughnut :data="chartData" :options="chartOptions" />
            </div>
          </div>
          <div
            v-else
            class="text-body2 text-grey-6 text-center"
            data-testid="gm-stats-win-share-empty"
          >
            No complete sessions with winners yet.
          </div>
          <div v-if="winShareChart.status === 'ok'" class="column q-gutter-y-xs">
            <div
              v-for="(key, index) in winShareChart.chart.keys"
              :key="key"
              class="row items-center no-wrap"
              :data-testid="`gm-stats-win-share-row-${index}`"
            >
              <span
                class="gm-stats-swatch q-mr-sm"
                :style="{ backgroundColor: segmentColor(index) }"
                aria-hidden="true"
              />
              <div class="col text-body2 ellipsis">{{ key }}</div>
              <div class="col-auto text-caption text-grey-6 q-ml-sm">
                {{ winShareChart.chart.counts[index] }} ({{ winShareChart.chart.percents[index] }}%)
              </div>
            </div>
          </div>
        </div>

        <q-separator class="full-width" />

        <div class="column q-gutter-y-sm full-width" data-testid="gm-stats-people">
          <div class="text-subtitle2">Players</div>
          <div v-if="!model.people.length" class="text-body2 text-grey-6">No play history yet.</div>
          <div v-else class="column no-wrap q-gutter-y-sm">
            <div
              v-for="person in model.people"
              :key="person.personId"
              class="gm-stats-person"
              :data-testid="`gm-stats-person-${person.personId}`"
            >
              <div class="gm-stats-person-name" :style="personNameStyle(person)">
                {{ person.name }}
              </div>
              <div class="gm-stats-person-metrics" :style="personMetricsStyle(person)">
                <div class="row items-start">
                  <div class="col-4">sessions: {{ person.sittingsPlayed }}</div>
                  <div class="col-4">games: {{ person.gamesPlayed }}</div>
                  <div class="col-4">banked: {{ formatDuration(person.bankedTimeMs) }}</div>
                </div>
                <div class="row items-start">
                  <div class="col-4">wins: {{ person.sessionWins }}</div>
                  <div class="col-4">
                    winrate:
                    {{
                      person.winPercentage == null
                        ? '—'
                        : `${Math.round(person.winPercentage * 100)}%`
                    }}
                  </div>
                  <div class="col-4">h-index: {{ person.hIndex }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js'
import { computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { Doughnut } from 'vue-chartjs'
import { playerBarTrackColor } from '../../game-timer/core.js'
import { useGameManagerStats } from '../composables/useGameManagerStats.js'
import { buildWinShareChart } from '../stats/buildWinShareChart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const FALLBACK_COLORS = ['#1976d2', '#26a69a', '#ef6c00', '#8e24aa', '#546e7a', '#c62828']
const PERSON_FALLBACK_COLOR = '#78909c'

const $q = useQuasar()
const { model, loading, reload } = useGameManagerStats()

onMounted(() => {
  reload().catch(() => {})
})

const winShareChart = computed(() => buildWinShareChart(model.value.winShareRows))

const chartData = computed(() => {
  if (winShareChart.value.status !== 'ok') return { labels: [], datasets: [] }
  const { chart } = winShareChart.value
  return {
    labels: chart.keys,
    datasets: [
      {
        data: chart.counts,
        backgroundColor: chart.keys.map((_, i) => segmentColor(i)),
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
    legend: { display: false },
  },
}

function segmentColor(index) {
  const rows = model.value.winShareRows || []
  const color = rows[index]?.color
  if (color) return color
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length]
}

function personColor(person) {
  return typeof person?.color === 'string' && person.color ? person.color : PERSON_FALLBACK_COLOR
}

function personNameStyle(person) {
  return { backgroundColor: personColor(person) }
}

function personMetricsStyle(person) {
  return {
    backgroundColor: playerBarTrackColor(personColor(person), $q.dark.isActive),
  }
}

function formatDuration(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return '0m'
  const totalSec = Math.round(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
</script>

<style scoped>
.gm-stats-win-share-chart {
  width: 100%;
  max-width: 240px;
  height: 200px;
}

.gm-stats-swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  flex: none;
}

.gm-stats-person {
  border-radius: 8px;
  overflow: hidden;
}

.gm-stats-person-name {
  padding: 8px 10px;
  color: #fff;
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.25;
  text-shadow:
    -1.5px 0 0 #000,
    1.5px 0 0 #000,
    0 -1.5px 0 #000,
    0 1.5px 0 #000;
}

.gm-stats-person-metrics {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  line-height: 1.25;
  color: #fff;
  font-size: 0.8rem;
  font-weight: 600;
  text-shadow:
    -1.5px 0 0 #000,
    1.5px 0 0 #000,
    0 -1.5px 0 #000,
    0 1.5px 0 #000;
}
</style>
