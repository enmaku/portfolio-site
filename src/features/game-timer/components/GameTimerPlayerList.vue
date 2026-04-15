<template>
  <div ref="listRootRef" class="gt-player-list">
    <div class="gt-player-list__inner q-pa-sm">
      <Draggable
        v-model="draggablePlayers"
        item-key="id"
        tag="div"
        class="gt-draggable"
        :disabled="isGuest"
        @contextmenu.prevent
        :animation="200"
        :delay="450"
        :delay-on-touch-only="true"
        :touch-start-threshold="8"
        direction="vertical"
        ghost-class="gt-sortable-ghost"
        chosen-class="gt-sortable-chosen"
        drag-class="gt-sortable-drag"
      >
        <template #item="{ element: player }">
          <q-slide-item
            class="gt-slide q-mb-sm rounded-borders overflow-hidden"
            left-color="primary"
            right-color="negative"
            @contextmenu.prevent
            @left="(e) => openEditSlide(e, player)"
            @right="(e) => requestDelete(e, player)"
          >
            <template v-if="!isGuest" #left>
              <div class="row items-center full-height q-px-md" aria-hidden="true">
                <q-icon name="edit" size="md" />
              </div>
            </template>

            <template v-if="!isGuest" #right>
              <div class="row items-center full-height q-px-md" aria-hidden="true">
                <q-icon name="delete" size="md" />
              </div>
            </template>

            <div
              class="gt-player-row rounded-borders relative-position overflow-hidden column"
              :class="{
                'gt-player-row--active': rowForPlayer(player)?.isActive,
                'gt-player-row--hard-passed': isHardPassed(player),
                'gt-player-row--paused-turn': isPausedHeldTurn(player),
              }"
              :style="rowSurfaceStyle(player)"
              :data-gt-player-id="player.id"
            >
              <div class="gt-player-row__content row items-center no-wrap relative-position q-pr-md">
                <div class="gt-player-row__turn col-auto row flex-center" aria-hidden="true">
                  <q-icon
                    v-if="rowForPlayer(player)?.isActive"
                    :name="isPausedHeldTurn(player) ? 'pause' : 'play_arrow'"
                    class="gt-player-row__turn-icon"
                  />
                </div>
                <button
                  type="button"
                  class="gt-player-row__name col text-left gt-player-row__name-text"
                  @click="store.selectPlayer(player.id)"
                >
                  {{ player.name }}
                </button>
                <div
                  class="gt-player-row__time text-mono gt-player-row__time-text"
                  :title="hasMultipleRounds ? 'This round / all rounds' : 'Total time'"
                >
                  {{ rowTimeLabel(player) }}
                </div>
                <q-btn
                  v-if="hardPassEnabled"
                  flat
                  round
                  dense
                  padding="sm"
                  :icon="isHardPassed(player) ? 'undo' : 'sports_score'"
                  class="gt-player-row__hard-pass gt-hard-pass-hit"
                  :aria-label="isHardPassed(player) ? 'Undo hard pass' : 'Hard pass for this round'"
                  @click.stop="onHardPassButton(player)"
                />
              </div>
              <div class="gt-player-row__bars column">
                <div
                  v-if="hasMultipleRounds"
                  class="gt-player-row__progress gt-player-row__progress--round relative-position"
                  aria-hidden="true"
                >
                  <div class="gt-player-row__progress-rail absolute-full" :style="progressRailStyle(player.color)" />
                  <div class="gt-player-row__progress-fill absolute" :style="progressRoundFillStyle(player)" />
                </div>
                <div class="gt-player-row__progress gt-player-row__progress--total relative-position" aria-hidden="true">
                  <div class="gt-player-row__progress-rail absolute-full" :style="progressRailStyle(player.color)" />
                  <div class="gt-player-row__progress-fill absolute" :style="progressFillStyle(player)" />
                </div>
              </div>
            </div>
          </q-slide-item>
        </template>
      </Draggable>
    </div>

    <q-dialog v-model="deleteConfirmOpen" persistent>
      <q-card class="gt-dialog-card gt-dialog-card--narrow">
        <q-card-section class="text-h6">Remove player?</q-card-section>
        <q-card-section class="q-pt-none text-body2">
          Remove <strong>{{ deleteTargetName }}</strong> from the game? Their time totals will be lost for this session.
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey" @click="cancelDelete" />
          <q-btn unelevated label="Remove" color="negative" @click="confirmDelete" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="editDialogOpen">
      <q-card class="gt-dialog-card gt-dialog-card--narrow">
        <q-card-section class="text-h6">Edit player</q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input v-model="editName" label="Name" outlined dense autofocus @keyup.enter="saveEdit" />
          <div>
            <div class="text-caption text-grey-6 q-mb-xs">Color</div>
            <q-color
              v-model="editColor"
              default-view="palette"
              format-model="hex"
              class="full-width"
              style="max-width: 100%"
            />
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey" @click="editDialogOpen = false" />
          <q-btn unelevated label="Save" color="primary" @click="saveEdit" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
/**
 * @import '../types.js'
 * Draggable player list with live timers, swipe edit/delete, and progress bars.
 */

import { computed, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useQuasar } from 'quasar'
import Draggable from 'vuedraggable'
import { useGameTimerNow } from '../composables/useGameTimerNow.js'
import { useGameTimerP2P } from '../composables/useGameTimerP2P.js'
import {
  DEFAULT_PLAYER_COLORS,
  displayedMsForPlayer,
  displayedMsForPlayerInRound,
  formatDurationMs,
  maxDisplayedMs,
  maxDisplayedMsInRound,
  playerBarFillColor,
  playerBarRailColor,
  playerBarTrackColor,
  progressRatio,
} from '../core.js'
import { useGameTimerStore } from '../../../stores/gameTimer.js'

const $q = useQuasar()
const { isGuest } = useGameTimerP2P()
const store = useGameTimerStore()
const now = useGameTimerNow(100)

const { hasMultipleRounds, hardPassEnabled, round, activePlayerId, turnStartedAt } = storeToRefs(store)

const hardPassIdsThisRound = computed(() => {
  const arr = store.hardPassOrderByRound[String(round.value)]
  return new Set(Array.isArray(arr) ? arr : [])
})

function isHardPassed(player) {
  return hardPassEnabled.value && hardPassIdsThisRound.value.has(player.id)
}

/** Active row, clock paused; mild dim (hard-pass uses stronger styling). */
function isPausedHeldTurn(player) {
  if (isHardPassed(player)) return false
  return activePlayerId.value === player.id && turnStartedAt.value == null
}

function onHardPassButton(player) {
  if (isHardPassed(player)) {
    store.undoHardPass(player.id)
  } else {
    store.registerHardPass(player.id)
  }
}

const draggablePlayers = computed({
  get: () => store.players,
  set: (next) => {
    if (isGuest.value) return
    if (Array.isArray(next)) store.reorderPlayers(next)
  },
})

const listRootRef = ref(null)

function scrollActiveRowIntoView(playerId) {
  if (playerId == null || !listRootRef.value) return
  const safe = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(playerId) : playerId
  const el = listRootRef.value.querySelector(`[data-gt-player-id="${safe}"]`)
  el?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
}

watch(
  () => store.activePlayerId,
  (id) => {
    if (id == null) return
    nextTick(() => {
      requestAnimationFrame(() => scrollActiveRowIntoView(id))
    })
  },
  { flush: 'post', immediate: true },
)

const deleteConfirmOpen = ref(false)
const pendingDeleteId = ref(null)
const deleteTargetName = ref('')

const editDialogOpen = ref(false)
const editPlayerId = ref(null)
const editName = ref('')
const editColor = ref(DEFAULT_PLAYER_COLORS[0])

/**
 * @type {import('vue').ComputedRef<Map<string, import('../types.js').GameTimerPlayerRow>>}
 */
const playerRowsById = computed(() => {
  const session = {
    activePlayerId: store.activePlayerId,
    turnStartedAt: store.turnStartedAt,
    turnStartedRound: store.turnStartedRound,
  }
  const currentRound = store.round
  const nowMs = now.value
  const list = store.players
  const maxMs = maxDisplayedMs(list, session, nowMs)
  const multi = hasMultipleRounds.value
  const maxRoundMs = multi ? maxDisplayedMsInRound(list, session, nowMs, currentRound) : 0
  const map = new Map()
  for (const p of list) {
    const displayedMs = displayedMsForPlayer(p, session, nowMs)
    const displayedMsRound = multi ? displayedMsForPlayerInRound(p, session, nowMs, currentRound) : 0
    map.set(p.id, {
      id: p.id,
      name: p.name,
      color: p.color,
      displayedMs,
      progress: progressRatio(displayedMs, maxMs),
      displayedMsRound,
      progressRound: multi ? progressRatio(displayedMsRound, maxRoundMs) : 0,
      isActive: session.activePlayerId === p.id,
    })
  }
  return map
})

function rowForPlayer(player) {
  return playerRowsById.value.get(player.id)
}

function rowTimeLabel(player) {
  const r = rowForPlayer(player)
  if (!r) return hasMultipleRounds.value ? '0:00/0:00' : '0:00'
  if (!hasMultipleRounds.value) {
    return formatDurationMs(r.displayedMs)
  }
  return `${formatDurationMs(r.displayedMsRound)}/${formatDurationMs(r.displayedMs)}`
}

function requestDelete({ reset }, player) {
  if (isGuest.value) {
    reset()
    return
  }
  pendingDeleteId.value = player.id
  deleteTargetName.value = player.name
  deleteConfirmOpen.value = true
  reset()
}

function cancelDelete() {
  deleteConfirmOpen.value = false
  pendingDeleteId.value = null
  deleteTargetName.value = ''
}

function confirmDelete() {
  const id = pendingDeleteId.value
  if (id) {
    store.removePlayer(id)
  }
  cancelDelete()
}

function openEditSlide({ reset }, player) {
  if (isGuest.value) {
    reset()
    return
  }
  editPlayerId.value = player.id
  editName.value = player.name
  editColor.value = player.color
  editDialogOpen.value = true
  reset()
}

function saveEdit() {
  const id = editPlayerId.value
  if (id) {
    store.setPlayerName(id, editName.value)
    store.setPlayerColor(id, editColor.value)
  }
  editDialogOpen.value = false
  editPlayerId.value = null
}

function rowSurfaceStyle(player) {
  return {
    '--player-color': player.color,
    backgroundColor: playerBarTrackColor(player.color, $q.dark.isActive),
  }
}

function progressRailStyle(colorHex) {
  return {
    backgroundColor: playerBarRailColor(colorHex, $q.dark.isActive),
  }
}

function progressFillStyle(player) {
  const row = playerRowsById.value.get(player.id)
  const progress = row?.progress ?? 0
  return {
    top: '0',
    left: '0',
    bottom: '0',
    width: `${progress * 100}%`,
    backgroundColor: playerBarFillColor(player.color, $q.dark.isActive),
  }
}

function progressRoundFillStyle(player) {
  const row = playerRowsById.value.get(player.id)
  const progress = row?.progressRound ?? 0
  return {
    top: '0',
    left: '0',
    bottom: '0',
    width: `${progress * 100}%`,
    backgroundColor: playerBarFillColor(player.color, $q.dark.isActive),
  }
}
</script>

<style scoped lang="scss">
.gt-player-list {
  width: 100%;
  min-height: min-content;
}

.gt-player-list__inner {
  min-height: min-content;
}

.gt-draggable {
  min-height: min-content;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

.gt-slide {
  border-radius: 8px;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

.gt-sortable-ghost {
  opacity: 0.45;
}

.gt-slide.gt-sortable-chosen {
  z-index: 10;
  cursor: grabbing;
}

.gt-slide.gt-sortable-chosen .gt-player-row {
  transform: scale(1.045);
  box-shadow:
    0 16px 36px rgba(0, 0, 0, 0.45),
    0 4px 12px rgba(0, 0, 0, 0.25);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.15s ease,
    border-width 0.15s ease;
}

.body--light .gt-slide.gt-sortable-chosen .gt-player-row {
  box-shadow:
    0 14px 32px rgba(0, 0, 0, 0.2),
    0 4px 10px rgba(0, 0, 0, 0.08);
}

.gt-slide.gt-sortable-chosen .gt-player-row--active {
  box-shadow:
    0 16px 36px rgba(0, 0, 0, 0.45),
    0 4px 12px rgba(0, 0, 0, 0.25),
    inset 6px 0 0 0 var(--player-color);
}

.body--light .gt-slide.gt-sortable-chosen .gt-player-row--active {
  box-shadow:
    0 14px 32px rgba(0, 0, 0, 0.2),
    0 4px 10px rgba(0, 0, 0, 0.08),
    inset 6px 0 0 0 var(--player-color);
}

.gt-player-row {
  border: 1px solid rgba(255, 255, 255, 0.12);
  transition:
    border-color 0.15s ease,
    border-width 0.15s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease,
    opacity 0.2s ease,
    filter 0.2s ease;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  color: rgba(255, 255, 255, 0.92);
}

.body--light .gt-player-row {
  border-color: rgba(0, 0, 0, 0.12);
  color: rgba(0, 0, 0, 0.87);
}

.gt-player-row--active {
  border-width: 3px;
  border-color: var(--player-color);
  box-shadow: inset 6px 0 0 0 var(--player-color);
}

.gt-player-row--hard-passed {
  opacity: 0.58;
  filter: grayscale(0.9);
}

/* Paused turn: mild dim vs. hard-pass */
.gt-player-row--paused-turn {
  opacity: 0.78;
  filter: brightness(0.86) saturate(0.6) grayscale(0.12);
}

.body--light .gt-player-row--paused-turn {
  filter: brightness(0.9) saturate(0.68) grayscale(0.08);
}

.gt-player-row__bars {
  flex: 0 0 auto;
  width: 100%;
}

.gt-player-row__progress {
  flex: 0 0 auto;
  width: 100%;
  pointer-events: none;
}

.gt-player-row__progress--round {
  height: 4px;
  margin-bottom: 4px;
}

.gt-player-row__progress--total {
  height: 9px;
}

.gt-player-row__progress-rail {
  z-index: 0;
}

.gt-player-row__progress-fill {
  z-index: 1;
  border-radius: 0 2px 2px 0;
}

.gt-player-row__content {
  flex: 1 1 auto;
  min-height: 72px;
  min-width: 0;
  padding-top: 14px;
  padding-bottom: 14px;
  padding-left: 10px;
  box-sizing: border-box;
}

.gt-player-row__turn {
  width: 30px;
  flex-shrink: 0;
  align-self: stretch;
}

.gt-player-row__turn-icon {
  font-size: 1.75rem;
  color: currentcolor;
  opacity: 0.95;
}

.gt-player-row__name {
  appearance: none;
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 10px 0 10px 6px;
  min-width: 0;
  min-height: 44px;
  display: flex;
  align-items: center;
}

.gt-player-row__name-text {
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: 0.01em;
}

.gt-player-row__time {
  flex-shrink: 0;
  margin-left: 8px;
  white-space: nowrap;
}

.gt-player-row__time-text {
  font-size: 1.05rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.gt-player-row__hard-pass {
  flex-shrink: 0;
  color: inherit;
  margin-left: 2px;
}

.gt-hard-pass-hit {
  min-width: 44px;
  min-height: 44px;
}
</style>

<!-- Sortable drag mirror may leave the scoped subtree; keep lift styling on the floating clone. -->
<style lang="scss">
.gt-sortable-drag .gt-player-row {
  transform: scale(1.045);
  box-shadow:
    0 16px 36px rgba(0, 0, 0, 0.45),
    0 4px 12px rgba(0, 0, 0, 0.25);
  border-radius: 8px;
}

.body--light .gt-sortable-drag .gt-player-row {
  box-shadow:
    0 14px 32px rgba(0, 0, 0, 0.2),
    0 4px 10px rgba(0, 0, 0, 0.08);
}

.gt-sortable-drag .gt-player-row--active {
  box-shadow:
    0 16px 36px rgba(0, 0, 0, 0.45),
    0 4px 12px rgba(0, 0, 0, 0.25),
    inset 6px 0 0 0 var(--player-color);
}

.body--light .gt-sortable-drag .gt-player-row--active {
  box-shadow:
    0 14px 32px rgba(0, 0, 0, 0.2),
    0 4px 10px rgba(0, 0, 0, 0.08),
    inset 6px 0 0 0 var(--player-color);
}
</style>
