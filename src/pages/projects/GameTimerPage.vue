<template>
  <q-page class="gt-page column fit no-wrap">
    <GameTimerRoundBar />

    <div
      v-if="!players.length"
      class="col gt-page__scroll-area flex flex-center q-pa-lg text-center text-body1 text-grey-5"
    >
      <div>
        <p class="q-mb-sm">No players yet.</p>
        <p class="q-mb-none">
          Tap + to add someone, then tap their name when it's their turn. Tap their name again to stop the clock.
        </p>
      </div>
    </div>

    <div v-else class="col gt-page__scroll-area">
      <GameTimerPlayerList />
    </div>

    <div class="gt-actions-bar row items-center no-wrap full-width q-px-md q-pt-sm q-gutter-x-sm">
      <q-btn
        fab-mini
        outline
        color="grey-5"
        icon="playlist_remove"
        :disable="!players.length"
        aria-label="Remove all players"
        class="gt-actions-bar__fixed-btn"
        @click="resetConfirmOpen = true"
      />
      <q-btn
        v-if="isTurnRunning"
        rounded
        unelevated
        no-wrap
        color="primary"
        icon-right="skip_next"
        label="End turn"
        class="gt-actions-bar__end-turn col"
        padding="12px 16px"
        aria-label="End turn and go to next player"
        @click="store.endTurnNext()"
      />
      <q-space v-else />
      <q-btn fab color="primary" icon="add" aria-label="Add player" class="gt-actions-bar__fixed-btn" @click="openAddDialog" />
    </div>

    <q-dialog v-model="resetConfirmOpen" persistent>
      <q-card class="gt-dialog-card" style="min-width: 280px">
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
      <q-card class="gt-dialog-card" style="min-width: 280px">
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
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import GameTimerPlayerList from '../../features/game-timer/components/GameTimerPlayerList.vue'
import GameTimerRoundBar from '../../features/game-timer/components/GameTimerRoundBar.vue'
import { nextDefaultColor } from '../../features/game-timer/core.js'
import { useGameTimerStore } from '../../stores/gameTimer.js'

const store = useGameTimerStore()
const { players, activePlayerId, turnStartedAt } = storeToRefs(store)

const isTurnRunning = computed(
  () => activePlayerId.value != null && turnStartedAt.value != null,
)

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

.gt-actions-bar__end-turn {
  min-width: 0;
  min-height: 48px;
}

.gt-actions-bar__end-turn :deep(.q-icon) {
  font-size: 1.35rem;
}

.gt-dialog-card {
  border-radius: 12px;
}
</style>
