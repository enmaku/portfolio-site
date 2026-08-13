<template>
  <q-card class="column no-wrap full-width gm-flow-panel" data-testid="gm-session-stats">
    <q-card-section class="row items-center no-wrap q-pb-sm gm-flow-panel__header">
      <div class="text-h6 col ellipsis">{{ vm.gameTitle || 'Session' }}</div>
      <q-btn
        flat
        dense
        round
        icon="edit"
        aria-label="Edit scores"
        data-testid="gm-session-stats-edit"
        @click="$emit('edit')"
      />
      <q-btn
        flat
        dense
        round
        icon="close"
        aria-label="Close"
        data-testid="gm-session-stats-close"
        @click="$emit('close')"
      />
    </q-card-section>

    <q-card-section class="col q-pt-none gm-flow-panel__scroll column no-wrap q-gutter-y-md">
      <div v-if="vm.playTimeMs != null" class="full-width" data-testid="gm-session-stats-play-time">
        <div class="text-body2 text-grey-6">Play time</div>
        <div class="text-h4">{{ formatDuration(vm.playTimeMs) }}</div>
      </div>

      <div
        v-if="vm.mode === SCORE_ENTRY_MODES.POINTS"
        class="gm-session-stats-charts full-width"
        data-testid="gm-session-stats-score-chart"
      >
        <div class="gm-session-stats-charts__title text-subtitle1 text-weight-medium">Points</div>
        <template v-for="player in scoreRows" :key="`score-${player.personId}`">
          <div
            class="gm-session-stats-bar-name ellipsis"
            :data-testid="`gm-session-stats-score-row-${player.personId}`"
          >
            {{ player.name }}
          </div>
          <div class="gm-session-stats-bar-track">
            <div
              class="gm-session-stats-bar-fill"
              :style="{
                width: barWidth(player.score, maxScore),
                backgroundColor: player.color || '#78909c',
              }"
            >
              <div class="gm-session-stats-bar-icons">
                <q-icon
                  v-if="player.isWinner"
                  name="workspace_premium"
                  color="amber-6"
                  size="24px"
                  data-testid="gm-session-stats-winner-ribbon"
                >
                  <q-tooltip>Winner</q-tooltip>
                </q-icon>
                <q-icon
                  v-if="player.isFirstPlay"
                  name="fiber_new"
                  color="light-blue-2"
                  size="24px"
                  data-testid="gm-session-stats-first-play"
                >
                  <q-tooltip>First play</q-tooltip>
                </q-icon>
                <q-icon
                  v-if="player.isPersonalBest"
                  name="star"
                  color="amber-2"
                  size="24px"
                  data-testid="gm-session-stats-pb"
                >
                  <q-tooltip>Personal best</q-tooltip>
                </q-icon>
              </div>
              <span class="gm-session-stats-bar-value">{{ player.score }}</span>
            </div>
          </div>
        </template>

        <template v-if="ppmRows.length">
          <div class="gm-session-stats-charts__rule" role="separator" />
          <div
            class="gm-session-stats-charts__title text-subtitle1 text-weight-medium"
            data-testid="gm-session-stats-ppm-chart"
          >
            Points per minute
          </div>
          <template v-for="player in ppmRows" :key="`ppm-${player.personId}`">
            <div
              class="gm-session-stats-bar-name ellipsis"
              :data-testid="`gm-session-stats-ppm-row-${player.personId}`"
            >
              {{ player.name }}
            </div>
            <div class="gm-session-stats-bar-track">
              <div
                class="gm-session-stats-bar-fill"
                :style="{
                  width: barWidth(player.pointsPerMinute, maxPpm),
                  backgroundColor: player.color || '#78909c',
                }"
              >
                <span class="gm-session-stats-bar-value">{{ formatPpm(player.pointsPerMinute) }}</span>
              </div>
            </div>
          </template>
        </template>
      </div>

      <div
        v-else-if="vm.mode === SCORE_ENTRY_MODES.OUTCOMES"
        class="gm-session-stats-charts full-width"
        data-testid="gm-session-stats-outcomes"
      >
        <div class="gm-session-stats-charts__title text-subtitle1 text-weight-medium">Outcomes</div>
        <template v-for="player in outcomeRows" :key="`out-${player.personId}`">
          <div
            class="gm-session-stats-bar-name ellipsis"
            :data-testid="`gm-session-stats-outcome-row-${player.personId}`"
          >
            {{ player.name }}
          </div>
          <div class="gm-session-stats-bar-track">
            <div
              class="gm-session-stats-bar-fill gm-session-stats-bar-fill--outcome"
              :style="{ backgroundColor: player.color || '#78909c' }"
            >
              <div class="gm-session-stats-bar-icons">
                <q-icon
                  v-if="player.isWinner"
                  name="workspace_premium"
                  color="amber-6"
                  size="24px"
                  data-testid="gm-session-stats-winner-ribbon"
                >
                  <q-tooltip>Winner</q-tooltip>
                </q-icon>
                <q-icon
                  v-if="player.isFirstPlay"
                  name="fiber_new"
                  color="light-blue-2"
                  size="24px"
                  data-testid="gm-session-stats-first-play"
                >
                  <q-tooltip>First play</q-tooltip>
                </q-icon>
              </div>
              <span class="gm-session-stats-bar-value">{{ player.outcome || '—' }}</span>
            </div>
          </div>
        </template>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'
import { SCORE_ENTRY_MODES } from '../domain/playSession.js'
import { buildSessionStatisticsViewModel } from '../stats/sessionStatisticsViewModel.js'

const props = defineProps({
  session: { type: Object, default: null },
  sessions: { type: Array, default: () => [] },
})

defineEmits(['close', 'edit'])

const vm = computed(() =>
  buildSessionStatisticsViewModel({
    session: props.session,
    sessions: props.sessions,
  }),
)

const scoreRows = computed(() =>
  [...vm.value.players]
    .filter((p) => typeof p.score === 'number')
    .sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name))),
)

const ppmRows = computed(() =>
  [...vm.value.players]
    .filter((p) => typeof p.pointsPerMinute === 'number')
    .sort(
      (a, b) =>
        b.pointsPerMinute - a.pointsPerMinute || String(a.name).localeCompare(String(b.name)),
    ),
)

const outcomeRows = computed(() => {
  const rank = { win: 0, draw: 1, loss: 2 }
  return [...vm.value.players].sort((a, b) => {
    const ra = rank[a.outcome] ?? 9
    const rb = rank[b.outcome] ?? 9
    if (ra !== rb) return ra - rb
    return String(a.name).localeCompare(String(b.name))
  })
})

const maxScore = computed(() => Math.max(0, ...scoreRows.value.map((p) => p.score)))
const maxPpm = computed(() => Math.max(0, ...ppmRows.value.map((p) => p.pointsPerMinute)))

function barWidth(value, max) {
  if (!(max > 0) || typeof value !== 'number') return '0%'
  return `${Math.max(12, (value / max) * 100)}%`
}

function formatDuration(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '—'
  const totalSec = Math.round(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatPpm(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
  return n >= 10 ? n.toFixed(0) : n.toFixed(1)
}
</script>

<style scoped>
.gm-session-stats-charts {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  column-gap: 10px;
  row-gap: 12px;
  align-items: center;
}

.gm-session-stats-charts__title {
  grid-column: 1 / -1;
}

.gm-session-stats-charts__rule {
  grid-column: 1 / -1;
  height: 0;
  margin: 4px 0;
  border: 0;
  border-top: 1px solid rgba(128, 128, 128, 0.45);
}

.gm-session-stats-bar-name {
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.2;
}

.gm-session-stats-bar-track {
  min-width: 0;
  height: 40px;
  border-radius: 6px;
  background: rgba(128, 128, 128, 0.2);
  overflow: hidden;
}

.gm-session-stats-bar-fill {
  height: 100%;
  min-width: 3.25rem;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  padding: 0 10px;
  box-sizing: border-box;
}

.gm-session-stats-bar-fill--outcome {
  width: 100%;
}

.gm-session-stats-bar-icons {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-right: auto;
  flex: none;
}

.gm-session-stats-bar-icons :deep(.q-icon) {
  text-shadow:
    -1.5px 0 0 #000,
    1.5px 0 0 #000,
    0 -1.5px 0 #000,
    0 1.5px 0 #000;
}

.gm-session-stats-bar-value {
  color: #fff;
  font-size: 1.05rem;
  font-weight: 700;
  text-shadow:
    -1.5px 0 0 #000,
    1.5px 0 0 #000,
    0 -1.5px 0 #000,
    0 1.5px 0 #000;
  flex: none;
}
</style>
