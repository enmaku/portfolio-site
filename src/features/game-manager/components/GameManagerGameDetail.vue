<template>
  <q-card class="column no-wrap full-width gm-flow-panel" data-testid="gm-game-detail">
    <q-card-section class="row items-center no-wrap q-pb-sm gm-flow-panel__header">
      <div class="text-h6 col ellipsis">{{ displayTitle }}</div>
      <q-btn
        flat
        dense
        round
        icon="close"
        aria-label="Close"
        data-testid="gm-game-detail-close"
        @click="$emit('close')"
      />
    </q-card-section>

    <q-card-section class="col q-pt-none gm-flow-panel__scroll">
      <div class="column items-center q-gutter-md q-mb-md">
        <q-img
          v-if="displayArt"
          :src="displayArt"
          width="160px"
          height="160px"
          fit="contain"
          spinner-color="primary"
          data-testid="gm-game-detail-art"
        />
        <q-icon v-else name="casino" size="64px" color="grey-5" />
      </div>

      <template v-if="playStats">
        <q-expansion-item
          group="gm-game-detail"
          label="Details"
          data-testid="gm-game-detail-details-expansion"
        >
          <div class="q-px-md q-pb-md column no-wrap q-gutter-y-md">
            <div class="text-body2 text-grey-6" data-testid="gm-game-detail-meta">
              <template v-if="display.yearPublished">{{ display.yearPublished }}</template>
              <template v-if="playerRange">
                <span v-if="display.yearPublished"> · </span>{{ playerRange }}
              </template>
              <template v-if="timeLabel">
                <span v-if="display.yearPublished || playerRange"> · </span>{{ timeLabel }}
              </template>
              <template v-if="item?.kind === 'custom' && !display.yearPublished">Custom</template>
            </div>

            <div v-if="catalogStatsLine" class="text-body2" data-testid="gm-game-detail-stats">
              {{ catalogStatsLine }}
            </div>

            <div
              v-if="enrichLoading"
              class="row items-center q-gutter-x-sm text-grey-6"
              data-testid="gm-game-detail-enrich-loading"
            >
              <q-spinner size="20px" color="primary" />
              <span class="text-body2">Loading catalog details…</span>
            </div>

            <div
              v-else-if="enrichError"
              class="column no-wrap q-gutter-y-sm"
              data-testid="gm-game-detail-enrich-error"
            >
              <div class="text-body2 text-negative">Could not refresh catalog details.</div>
              <q-btn
                outline
                dense
                color="primary"
                label="Retry"
                data-testid="gm-game-detail-enrich-retry"
                @click="loadEnrich"
              />
            </div>

            <div
              v-if="display.description"
              class="text-body2 gm-flow-panel__description"
              data-testid="gm-game-detail-description"
            >
              {{ display.description }}
            </div>

            <div
              v-if="item?.kind === 'catalog'"
              class="text-caption text-grey-6 gm-flow-panel__description"
              data-testid="gm-game-detail-attribution"
            >
              {{ attribution }}
            </div>
          </div>
        </q-expansion-item>

        <q-expansion-item
          group="gm-game-detail"
          default-opened
          label="Stats"
          data-testid="gm-game-detail-play-stats-expansion"
        >
          <div
            class="q-px-md q-pb-md column no-wrap q-gutter-y-md"
            data-testid="gm-game-detail-play-stats"
          >
            <div>
              <div class="row items-stretch">
                <div class="col-6 column flex-center text-center q-px-sm">
                  <div class="text-caption text-grey-6">Sessions</div>
                </div>
                <div class="col-6 column flex-center text-center q-px-sm">
                  <div class="text-caption text-grey-6">Play time</div>
                </div>
              </div>
              <div class="row items-center q-mt-xs">
                <div class="col-6 text-center text-h6 q-px-sm" data-testid="gm-game-detail-sessions">
                  {{ playStats.sittings }}
                </div>
                <div class="col-6 text-center text-h6 q-px-sm" data-testid="gm-game-detail-play-time">
                  {{ formatDuration(playStats.playTimeMs) }}
                </div>
              </div>
            </div>

            <div class="column q-gutter-y-sm" data-testid="gm-game-detail-win-share">
              <div class="text-subtitle2 text-center">Win share</div>
              <div
                v-if="winShareChart.status === 'ok'"
                class="row flex-center"
                data-testid="gm-game-detail-win-share-chart"
              >
                <div class="gm-game-detail-win-share-chart">
                  <Doughnut :data="chartData" :options="chartOptions" />
                </div>
              </div>
              <div v-else class="text-body2 text-grey-6 text-center">No complete winners yet.</div>
            </div>

            <q-separator />

            <div class="column no-wrap q-gutter-y-sm">
              <div
                v-for="person in playStats.people"
                :key="person.personId"
                class="q-px-sm q-py-xs gm-game-detail-person"
                :data-testid="`gm-game-detail-person-${person.personId}`"
              >
                <div class="text-body1 text-weight-medium">{{ person.name }}</div>
                <div class="gm-game-detail-person-metrics text-caption text-grey-6">
                  <div class="row items-start">
                    <div class="col-4">sessions: {{ person.playCount }}</div>
                    <div class="col-4">
                      best: {{ person.personalBest != null ? person.personalBest : '—' }}
                    </div>
                    <div class="col-4">
                      average:
                      {{ person.averageScore != null ? formatScore(person.averageScore) : '—' }}
                    </div>
                  </div>
                  <div class="row items-start">
                    <div class="col-4">
                      PPM:
                      {{
                        person.pointsPerMinute != null ? formatPpm(person.pointsPerMinute) : '—'
                      }}
                    </div>
                    <div class="col-4">wins: {{ person.sessionWins }}</div>
                    <div class="col-4">
                      winrate:
                      {{
                        person.winPercentage == null
                          ? '—'
                          : `${Math.round(person.winPercentage * 100)}%`
                      }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </q-expansion-item>

        <q-expansion-item
          v-if="playStats.history.length"
          group="gm-game-detail"
          class="gm-game-detail-history"
          label="History"
          data-testid="gm-game-detail-history"
        >
          <div class="column no-wrap">
            <q-item
              v-for="row in playStats.history"
              :key="row.sessionId"
              clickable
              v-ripple
              class="gm-game-detail-history-row"
              :data-testid="`gm-game-detail-history-row-${row.sessionId}`"
              @click="$emit('open-session', row.sessionId)"
            >
              <q-item-section>
                <q-item-label>{{ formatWhen(row.sortMs) }}</q-item-label>
                <q-item-label caption>
                  {{ row.presentPlayerCount }}
                  {{ row.presentPlayerCount === 1 ? 'player' : 'players' }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-badge outline :color="statusColor(row.state)" :label="row.state" />
              </q-item-section>
            </q-item>
          </div>
        </q-expansion-item>
      </template>

      <template v-else>
        <div class="column no-wrap q-gutter-y-md">
          <div class="text-body2 text-grey-6" data-testid="gm-game-detail-meta">
            <template v-if="display.yearPublished">{{ display.yearPublished }}</template>
            <template v-if="playerRange">
              <span v-if="display.yearPublished"> · </span>{{ playerRange }}
            </template>
            <template v-if="timeLabel">
              <span v-if="display.yearPublished || playerRange"> · </span>{{ timeLabel }}
            </template>
            <template v-if="item?.kind === 'custom' && !display.yearPublished">Custom</template>
          </div>

          <div v-if="catalogStatsLine" class="text-body2" data-testid="gm-game-detail-stats">
            {{ catalogStatsLine }}
          </div>

          <div
            v-if="enrichLoading"
            class="row items-center q-gutter-x-sm text-grey-6"
            data-testid="gm-game-detail-enrich-loading"
          >
            <q-spinner size="20px" color="primary" />
            <span class="text-body2">Loading catalog details…</span>
          </div>

          <div
            v-else-if="enrichError"
            class="column no-wrap q-gutter-y-sm"
            data-testid="gm-game-detail-enrich-error"
          >
            <div class="text-body2 text-negative">Could not refresh catalog details.</div>
            <q-btn
              outline
              dense
              color="primary"
              label="Retry"
              data-testid="gm-game-detail-enrich-retry"
              @click="loadEnrich"
            />
          </div>

          <div
            v-if="display.description"
            class="text-body2 gm-flow-panel__description"
            data-testid="gm-game-detail-description"
          >
            {{ display.description }}
          </div>

          <div
            v-if="item?.kind === 'catalog'"
            class="text-caption text-grey-6 gm-flow-panel__description"
            data-testid="gm-game-detail-attribution"
          >
            {{ attribution }}
          </div>
        </div>
      </template>
    </q-card-section>

    <q-card-actions class="gm-flow-panel__actions q-pa-md">
      <q-btn
        class="full-width"
        unelevated
        color="primary"
        label="Start new session"
        data-testid="gm-game-detail-start-session"
        :loading="starting"
        :disable="starting"
        @click="$emit('start-session')"
      />
    </q-card-actions>
  </q-card>
</template>

<script setup>
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js'
import { computed, ref, watch } from 'vue'
import { Doughnut } from 'vue-chartjs'
import { CATALOG_ATTRIBUTION } from '../catalog/catalogAttribution.js'
import { fetchBggCatalogEntry } from '../catalog/bggCatalogClient.js'
import { normalizeDescriptionText } from '../catalog/normalizeBgg.js'
import { collectionItemThumbUrl } from '../collection/collectionViewModel.js'
import { buildGameDetailStatisticsViewModel } from '../stats/gameDetailStatisticsViewModel.js'
import { buildWinShareChart } from '../stats/buildWinShareChart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const FALLBACK_COLORS = ['#1976d2', '#26a69a', '#ef6c00', '#8e24aa', '#546e7a', '#c62828']

const props = defineProps({
  item: { type: Object, default: null },
  starting: { type: Boolean, default: false },
  sessions: { type: Array, default: () => [] },
  people: { type: Array, default: () => [] },
})

defineEmits(['close', 'start-session', 'open-session'])

const attribution = CATALOG_ATTRIBUTION
const enrich = ref(null)
const enrichLoading = ref(false)
const enrichError = ref(false)
let enrichSeq = 0

const gameKey = computed(() => {
  const item = props.item
  if (!item) return null
  if (item.kind === 'catalog') return { kind: 'catalog', catalogEntryId: item.catalogEntryId }
  if (item.kind === 'custom') return { kind: 'custom', id: item.id }
  return null
})

const playStats = computed(() => {
  if (!gameKey.value) return null
  return buildGameDetailStatisticsViewModel({
    gameKey: gameKey.value,
    people: props.people,
    sessions: props.sessions,
  })
})

const winShareChart = computed(() => {
  if (!playStats.value) return { status: 'error' }
  return buildWinShareChart(playStats.value.winShareRows)
})

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
  plugins: { legend: { display: false } },
}

const display = computed(() => {
  const shelf = props.item || {}
  const e = enrich.value || {}
  return {
    title: e.title || shelf.title || '',
    yearPublished: e.yearPublished ?? shelf.yearPublished ?? null,
    minPlayers: e.minPlayers ?? shelf.minPlayers ?? null,
    maxPlayers: e.maxPlayers ?? shelf.maxPlayers ?? null,
    playingTime: e.playingTime ?? shelf.playingTime ?? null,
    minPlayTime: e.minPlayTime ?? null,
    maxPlayTime: e.maxPlayTime ?? null,
    thumbnailUrl: e.thumbnailUrl || shelf.thumbnailUrl || null,
    imageUrl: e.imageUrl || shelf.imageUrl || null,
    description: normalizeDescriptionText(e.description) || null,
    averageRating: e.averageRating ?? null,
    boardGameRank: e.boardGameRank ?? null,
    usersRated: e.usersRated ?? null,
  }
})

const displayTitle = computed(() => display.value.title || 'Game')
const displayArt = computed(
  () => display.value.imageUrl || display.value.thumbnailUrl || collectionItemThumbUrl(props.item),
)

const playerRange = computed(() => {
  const { minPlayers, maxPlayers } = display.value
  if (minPlayers == null && maxPlayers == null) return ''
  return `${minPlayers ?? '?'}\u2013${maxPlayers ?? '?'} players`
})

const timeLabel = computed(() => {
  const { playingTime, minPlayTime, maxPlayTime } = display.value
  if (minPlayTime != null && maxPlayTime != null && minPlayTime !== maxPlayTime) {
    return `${minPlayTime}\u2013${maxPlayTime} min`
  }
  if (playingTime != null) return `${playingTime} min`
  if (minPlayTime != null) return `${minPlayTime} min`
  return ''
})

const catalogStatsLine = computed(() => {
  const parts = []
  if (display.value.averageRating != null) {
    parts.push(`Rating ${Number(display.value.averageRating).toFixed(1)}`)
  }
  if (display.value.boardGameRank != null) {
    parts.push(`Rank #${display.value.boardGameRank}`)
  }
  if (display.value.usersRated != null) {
    parts.push(`${display.value.usersRated} ratings`)
  }
  return parts.join(' · ')
})

function segmentColor(index) {
  const rows = playStats.value?.winShareRows || []
  const color = rows[index]?.color
  if (color) return color
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length]
}

function formatDuration(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return '0m'
  const totalSec = Math.round(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatScore(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function formatPpm(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
  return n >= 10 ? n.toFixed(0) : n.toFixed(1)
}

function formatWhen(ms) {
  if (!ms) return 'Unknown time'
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function statusColor(state) {
  if (state === 'complete') return 'positive'
  if (state === 'scoring') return 'warning'
  if (state === 'playing') return 'primary'
  return 'grey'
}

async function loadEnrich() {
  const item = props.item
  if (!item || item.kind !== 'catalog' || !item.catalogEntryId) {
    enrich.value = null
    enrichLoading.value = false
    enrichError.value = false
    return
  }
  const seq = ++enrichSeq
  enrichLoading.value = true
  enrichError.value = false
  try {
    const result = await fetchBggCatalogEntry(item.catalogEntryId)
    if (seq !== enrichSeq) return
    if (!result.ok || !result.entry) {
      enrichError.value = true
      return
    }
    enrich.value = result.entry
  } catch {
    if (seq !== enrichSeq) return
    enrichError.value = true
  } finally {
    if (seq === enrichSeq) enrichLoading.value = false
  }
}

watch(
  () => [props.item?.id, props.item?.catalogEntryId],
  () => {
    enrich.value = null
    void loadEnrich()
  },
  { immediate: true },
)
</script>

<style scoped>
.gm-game-detail-win-share-chart {
  width: 100%;
  max-width: 220px;
  height: 180px;
}

.gm-game-detail-person {
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.03);
}

.gm-game-detail-person-metrics {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 2px;
  line-height: 1.25;
}

.gm-game-detail-history-row {
  min-height: 64px;
  padding-left: 0;
  padding-right: 0;
}
</style>
