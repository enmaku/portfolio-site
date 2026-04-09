<template>
  <!-- Native overflow: q-scroll-area + flex often collapses to 0 height (contain: strict + % sizing). -->
  <div class="gt-player-list">
    <div class="gt-player-list__inner q-pa-sm">
      <Draggable
        v-model="players"
        item-key="id"
        tag="div"
        class="gt-draggable"
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
            :left-color="slideLeftColor"
            :right-color="slideRightColor"
            @contextmenu.prevent
            @left="(e) => onSlideLeft(e, player)"
            @right="(e) => onSlideRight(e, player)"
          >
            <template #left>
              <div class="row items-center full-height q-px-md" aria-hidden="true">
                <q-icon :name="slideLeftIcon" size="md" />
              </div>
            </template>

            <template #right>
              <div class="row items-center full-height q-px-md" aria-hidden="true">
                <q-icon :name="slideRightIcon" size="md" />
              </div>
            </template>

            <div
              class="gt-player-row rounded-borders relative-position overflow-hidden column"
              :class="{ 'gt-player-row--active': rowForPlayer(player).isActive }"
              :style="rowSurfaceStyle(player)"
            >
              <div class="gt-player-row__content row items-center no-wrap relative-position q-px-md q-py-md">
                <button
                  type="button"
                  class="gt-player-row__name col text-left text-body1 text-weight-medium"
                  @click="store.selectPlayer(player.id)"
                >
                  {{ player.name }}
                </button>
                <div class="gt-player-row__time text-mono text-body2">
                  {{ formatDurationMs(rowForPlayer(player).displayedMs) }}
                </div>
              </div>
              <div class="gt-player-row__progress relative-position" aria-hidden="true">
                <div class="gt-player-row__progress-rail absolute-full" :style="progressRailStyle(player.color)" />
                <div class="gt-player-row__progress-fill absolute" :style="progressFillStyle(rowForPlayer(player))" />
              </div>
            </div>
          </q-slide-item>
        </template>
      </Draggable>
    </div>

    <q-dialog v-model="deleteConfirmOpen" persistent>
      <q-card class="gt-dialog-card">
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
      <q-card class="gt-dialog-card" style="min-width: 280px">
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
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useQuasar } from 'quasar'
import Draggable from 'vuedraggable'
import { useGameTimerNow } from '../composables/useGameTimerNow.js'
import {
  displayedMsForPlayer,
  formatDurationMs,
  maxDisplayedMs,
  playerBarFillColor,
  playerBarRailColor,
  playerBarTrackColor,
  progressRatio,
} from '../core.js'
import { useGameTimerStore } from '../../../stores/gameTimer.js'

const $q = useQuasar()
const store = useGameTimerStore()
const { players } = storeToRefs(store)
const now = useGameTimerNow(100)

/** QSlideItem maps gestures to #left/#right using $q.lang.rtl; swap slots so swipe stays LTR-like. */
const isLayoutRtl = computed(() => $q.lang.rtl === true)
const slideLeftColor = computed(() => (isLayoutRtl.value ? 'primary' : 'negative'))
const slideRightColor = computed(() => (isLayoutRtl.value ? 'negative' : 'primary'))
const slideLeftIcon = computed(() => (isLayoutRtl.value ? 'edit' : 'delete'))
const slideRightIcon = computed(() => (isLayoutRtl.value ? 'delete' : 'edit'))

const deleteConfirmOpen = ref(false)
const pendingDeleteId = ref(null)
const deleteTargetName = ref('')

const editDialogOpen = ref(false)
const editPlayerId = ref(null)
const editName = ref('')
const editColor = ref('#5c6bc0')

/** Row view-model for one player (same rules as useGameTimerPlayerRows). */
function rowForPlayer(player) {
  const session = {
    activePlayerId: store.activePlayerId,
    turnStartedAt: store.turnStartedAt,
  }
  const nowMs = now.value
  const list = store.players
  const maxMs = maxDisplayedMs(list, session, nowMs)
  const displayedMs = displayedMsForPlayer(player, session, nowMs)
  return {
    id: player.id,
    name: player.name,
    color: player.color,
    displayedMs,
    progress: progressRatio(displayedMs, maxMs),
    isActive: session.activePlayerId === player.id,
  }
}

function requestDelete({ reset }, player) {
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
  editPlayerId.value = player.id
  editName.value = player.name
  editColor.value = player.color
  editDialogOpen.value = true
  reset()
}

function onSlideLeft(evt, player) {
  if (isLayoutRtl.value) {
    openEditSlide(evt, player)
  } else {
    requestDelete(evt, player)
  }
}

function onSlideRight(evt, player) {
  if (isLayoutRtl.value) {
    requestDelete(evt, player)
  } else {
    openEditSlide(evt, player)
  }
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

function progressFillStyle(row) {
  return {
    top: '0',
    left: '0',
    bottom: '0',
    width: `${row.progress * 100}%`,
    backgroundColor: playerBarFillColor(row.color, $q.dark.isActive),
  }
}
</script>

<style scoped lang="scss">
/* Quasar `.column > .col` uses min-height:0 so flex-1 can shrink; that hid the whole list. */
.gt-player-list {
  flex: 1 1 auto;
  min-height: auto !important;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
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

.gt-dialog-card {
  border-radius: 12px;
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

/* Keep left accent while lift shadow replaces base box-shadow */
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
    transform 0.2s ease;
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

.gt-player-row__progress {
  flex: 0 0 auto;
  height: 4px;
  width: 100%;
  pointer-events: none;
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
  min-height: 0;
  min-width: 0;
}

.gt-player-row__name {
  appearance: none;
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 4px 0;
  min-width: 0;
}

.gt-player-row__time {
  flex-shrink: 0;
  margin-left: 8px;
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
