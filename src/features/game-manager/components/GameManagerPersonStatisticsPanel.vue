<template>
  <div class="gm-catalog-panel column" data-testid="gm-person-stats">
    <div class="row items-center no-wrap q-pa-md q-pb-sm">
      <q-avatar
        v-if="person.color"
        size="36px"
        :style="{ backgroundColor: person.color }"
        class="q-mr-md"
        data-testid="gm-person-stats-avatar"
      />
      <div class="col text-h6 ellipsis" data-testid="gm-person-stats-name">{{ person.name }}</div>
      <q-btn
        flat
        dense
        round
        icon="close"
        aria-label="Close"
        data-testid="gm-person-stats-close"
        @click="$emit('close')"
      />
    </div>

    <div class="col column q-px-md q-pb-md gm-catalog-panel__body" style="overflow-y: auto">
      <template v-if="vm">
        <div
          class="q-px-sm q-py-xs gm-person-stats-block"
          data-testid="gm-person-stats-overall"
        >
          <div class="text-subtitle2 q-mb-xs">Overall</div>
          <div class="gm-person-stats-metrics text-caption text-grey-6">
            <div class="row items-start">
              <div class="col-4">sessions: {{ vm.sittingsPlayed }}</div>
              <div class="col-4">games: {{ vm.gamesPlayed }}</div>
              <div class="col-4">banked: {{ formatDuration(vm.bankedTimeMs) }}</div>
            </div>
            <div class="row items-start">
              <div class="col-4">wins: {{ vm.sessionWins }}</div>
              <div class="col-4">
                winrate:
                {{
                  vm.winPercentage == null ? '—' : `${Math.round(vm.winPercentage * 100)}%`
                }}
              </div>
              <div class="col-4">h-index: {{ vm.hIndex }}</div>
            </div>
          </div>
        </div>

        <q-separator class="q-my-md" />

        <q-expansion-item label="Games" data-testid="gm-person-stats-games">
          <div class="column no-wrap q-gutter-y-sm q-pb-sm">
            <div
              v-for="game in vm.games"
              :key="game.gameKey"
              class="row items-start no-wrap q-px-sm q-py-xs gm-person-stats-block"
              :data-testid="`gm-person-stats-game-${game.gameKey}`"
            >
              <div class="gm-row-thumb flex flex-center q-mr-sm">
                <q-img
                  v-if="thumbFor(game.game)"
                  :src="thumbFor(game.game)"
                  width="40px"
                  height="56px"
                  fit="cover"
                  spinner-color="primary"
                  loading="lazy"
                />
                <q-icon v-else name="casino" size="md" color="grey-5" />
              </div>
              <div class="col">
                <div class="text-body1 text-weight-medium">{{ game.gameTitle }}</div>
                <div class="gm-person-stats-metrics text-caption text-grey-6">
                  <div class="row items-start">
                    <div class="col-4">sessions: {{ game.playCount }}</div>
                    <div class="col-4">
                      best: {{ game.personalBest != null ? game.personalBest : '—' }}
                    </div>
                    <div class="col-4">
                      average:
                      {{ game.averageScore != null ? formatScore(game.averageScore) : '—' }}
                    </div>
                  </div>
                  <div class="row items-start">
                    <div class="col-4">
                      PPM:
                      {{
                        game.pointsPerMinute != null ? formatPpm(game.pointsPerMinute) : '—'
                      }}
                    </div>
                    <div class="col-4">wins: {{ game.sessionWins }}</div>
                    <div class="col-4">
                      winrate:
                      {{
                        game.winPercentage == null
                          ? '—'
                          : `${Math.round(game.winPercentage * 100)}%`
                      }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </q-expansion-item>

        <q-separator class="q-my-md" />

        <q-expansion-item
          class="gm-person-stats-history"
          label="History"
          data-testid="gm-person-stats-history"
        >
          <div v-if="!vm.history.length" class="text-body2 text-grey-6 q-px-sm q-pb-sm">
            No complete sessions yet.
          </div>
          <div v-else class="column no-wrap">
            <q-item
              v-for="row in vm.history"
              :key="row.sessionId"
              clickable
              v-ripple
              class="gm-person-stats-history-row"
              :data-testid="`gm-person-stats-history-row-${row.sessionId}`"
              @click="$emit('open-session', row.sessionId)"
            >
              <q-item-section avatar>
                <div class="gm-row-thumb flex flex-center">
                  <q-img
                    v-if="thumbFor(row.game)"
                    :src="thumbFor(row.game)"
                    width="40px"
                    height="56px"
                    fit="cover"
                    spinner-color="primary"
                    loading="lazy"
                  />
                  <q-icon v-else name="casino" size="md" color="grey-5" />
                </div>
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ formatWhen(row.sortMs) }}</q-item-label>
                <q-item-label caption>{{ row.gameTitle }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <div class="row items-center no-wrap q-gutter-x-xs">
                  <q-icon
                    v-if="row.isFirstPlay"
                    name="fiber_new"
                    color="light-blue-5"
                    size="22px"
                    data-testid="gm-person-stats-history-first-play"
                  >
                    <q-tooltip>First play</q-tooltip>
                  </q-icon>
                  <q-icon
                    v-if="row.isPersonalBest"
                    name="star"
                    color="amber-5"
                    size="22px"
                    data-testid="gm-person-stats-history-pb"
                  >
                    <q-tooltip>Personal best</q-tooltip>
                  </q-icon>
                  <q-icon
                    v-if="row.isWinner"
                    name="workspace_premium"
                    color="amber-6"
                    size="22px"
                    data-testid="gm-person-stats-history-winner"
                  >
                    <q-tooltip>Winner</q-tooltip>
                  </q-icon>
                </div>
              </q-item-section>
            </q-item>
          </div>
        </q-expansion-item>
      </template>

      <div v-else class="text-body2 text-grey-6" data-testid="gm-person-stats-empty">
        No play history yet.
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { collectionItemThumbUrl } from '../collection/collectionViewModel.js'
import { buildPersonStatisticsViewModel } from '../stats/personStatisticsViewModel.js'

const props = defineProps({
  person: {
    type: Object,
    required: true,
  },
  sessions: {
    type: Array,
    default: () => [],
  },
  collectionItems: {
    type: Array,
    default: () => [],
  },
})

defineEmits(['close', 'open-session'])

const vm = computed(() =>
  buildPersonStatisticsViewModel({
    person: props.person,
    sessions: props.sessions,
  }),
)

function thumbFor(game) {
  if (!game) return null
  const fromShelf = props.collectionItems.find(
    (i) =>
      i.id === game.id ||
      (i.kind === 'catalog' && i.catalogEntryId && i.catalogEntryId === game.catalogEntryId),
  )
  return collectionItemThumbUrl(fromShelf || game)
}

function formatWhen(ms) {
  if (!ms) return 'Unknown time'
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
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
</script>

<style scoped>
.gm-person-stats-block {
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.03);
}

.gm-person-stats-metrics {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 2px;
  line-height: 1.25;
}

.gm-person-stats-history-row {
  min-height: 64px;
  padding-left: 0;
  padding-right: 0;
}
</style>
