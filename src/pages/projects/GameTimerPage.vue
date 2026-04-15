<template>
  <q-page class="gt-page column fit no-wrap">
    <GameTimerRoundBar />

    <div
      v-if="!players.length"
      class="col gt-page__scroll-area flex flex-center q-pa-lg text-center text-body1 text-grey-5"
    >
      <div>
        <p class="q-mb-sm">No players yet.</p>
        <p v-if="isGuest" class="q-mb-none">Only the host can add players.</p>
        <p v-else class="q-mb-none">
          Tap + to add someone, then tap their name when it's their turn. Tap again to pause (or use the pause button);
          tap again or use play to resume.
        </p>
      </div>
    </div>

    <div v-else class="col gt-page__scroll-area">
      <GameTimerPlayerList />
    </div>

    <div
      v-if="!isGuest"
      class="gt-actions-bar row items-center no-wrap full-width q-px-md q-pt-sm q-gutter-x-sm"
    >
      <q-btn
        v-if="players.length"
        fab-mini
        outline
        color="grey-5"
        icon="playlist_remove"
        aria-label="Remove all players"
        class="gt-actions-bar__fixed-btn"
        @click="resetConfirmOpen = true"
      />
      <GameTimerTurnControls v-if="hasHeldTurn" class="col" />
      <q-space v-else />
      <q-btn
        fab
        color="primary"
        icon="add"
        aria-label="Add player"
        class="gt-actions-bar__fixed-btn"
        :disable="hasMultipleRounds"
        @click="openAddDialog"
      />
    </div>
    <div
      v-else-if="hasHeldTurn"
      class="gt-actions-bar row items-center no-wrap full-width q-px-md q-pt-sm"
    >
      <GameTimerTurnControls class="col" />
    </div>

    <q-dialog v-model="resetConfirmOpen" persistent>
      <q-card class="gt-dialog-card gt-dialog-card--narrow">
        <q-card-section class="text-h6">Remove everyone?</q-card-section>
        <q-card-section class="q-pt-none text-body2">
          This clears all players and their times for this session. This cannot be undone.
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey" @click="resetConfirmOpen = false" />
          <q-btn unelevated label="Remove all" color="negative" @click="confirmResetAll" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="addDialogOpen">
      <q-card class="gt-dialog-card gt-dialog-card--narrow">
        <q-card-section class="text-h6">Add player</q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input v-model="newPlayerName" label="Name" outlined dense autofocus @keyup.enter="confirmAdd" />
          <div>
            <div class="text-caption text-grey-6 q-mb-xs">Color</div>
            <q-color
              v-model="newPlayerColor"
              default-view="palette"
              format-model="hex"
              class="full-width"
              style="max-width: 100%"
            />
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey" @click="addDialogOpen = false" />
          <q-btn unelevated label="Add" color="primary" @click="confirmAdd" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
/** Game Timer project page: list shell, bottom actions, add / remove-all dialogs. */

import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useQuasar } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import GameTimerPlayerList from '../../features/game-timer/components/GameTimerPlayerList.vue'
import GameTimerRoundBar from '../../features/game-timer/components/GameTimerRoundBar.vue'
import GameTimerTurnControls from '../../features/game-timer/components/GameTimerTurnControls.vue'
import { useGameTimerP2P } from '../../features/game-timer/composables/useGameTimerP2P.js'
import { useScreenWakeLock } from '../../features/game-timer/composables/useScreenWakeLock.js'
import { nextDefaultColor } from '../../features/game-timer/core.js'
import {
  GAME_TIMER_ROOM_QUERY_KEY,
  isValidRoomSuffix,
  normalizeRoomSuffixInput,
} from '../../features/game-timer/p2p/roomId.js'
import { joinRoom } from '../../features/game-timer/p2p/session.js'
import { useGameTimerStore } from '../../stores/gameTimer.js'

const $q = useQuasar()
const route = useRoute()
const router = useRouter()
const { isGuest } = useGameTimerP2P()
const store = useGameTimerStore()
const { players, activePlayerId, hasMultipleRounds } = storeToRefs(store)

/** True when a turn is held (clock running or paused); `activePlayerId` is set. */
const hasHeldTurn = computed(() => activePlayerId.value != null)

/** While a session has players, keep the display awake (wake lock with video fallback where needed). */
useScreenWakeLock(computed(() => players.value.length > 0))

onMounted(() => {
  const raw = route.query[GAME_TIMER_ROOM_QUERY_KEY]
  if (raw === undefined || raw === null) return
  const str = Array.isArray(raw) ? raw[0] : raw
  if (!String(str).trim()) return

  const nextQuery = { ...route.query }
  delete nextQuery[GAME_TIMER_ROOM_QUERY_KEY]
  router.replace({
    path: route.path,
    query: nextQuery,
    hash: route.hash,
  })

  const code = normalizeRoomSuffixInput(str)
  if (!isValidRoomSuffix(code)) {
    $q.notify({
      type: 'warning',
      message: 'This room link is not valid.',
      timeout: 2500,
      position: 'top',
      classes: 'gt-notify',
    })
    return
  }

  void joinRoom(code).catch(() => {})
})

const addDialogOpen = ref(false)
const resetConfirmOpen = ref(false)
const newPlayerName = ref('')
const newPlayerColor = ref(nextDefaultColor([]))

function openAddDialog() {
  newPlayerName.value = ''
  newPlayerColor.value = nextDefaultColor(store.players)
  addDialogOpen.value = true
}

function confirmAdd() {
  const name = newPlayerName.value.trim()
  store.addPlayer({
    name: name || undefined,
    color: newPlayerColor.value,
  })
  addDialogOpen.value = false
}

function confirmResetAll() {
  store.clearAllPlayers()
  resetConfirmOpen.value = false
}
</script>

<style scoped lang="scss">
.gt-page {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

.gt-page__scroll-area {
  flex: 1 1 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.gt-actions-bar {
  flex-shrink: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
}

.gt-actions-bar__fixed-btn {
  flex-shrink: 0;
}

.body--light .gt-actions-bar {
  border-top-color: rgba(0, 0, 0, 0.08);
}

</style>
