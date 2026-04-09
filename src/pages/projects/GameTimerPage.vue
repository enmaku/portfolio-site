<template>
  <q-page
    class="gt-page column fit no-wrap"
    :class="{
      'gt-page--with-list': players.length > 0,
      'gt-page--turn-running': isTurnRunning,
    }"
  >
    <div v-if="!players.length" class="col flex flex-center q-pa-lg text-center text-body1 text-grey-5">
      <div>
        <p class="q-mb-sm">No players yet.</p>
        <p class="q-mb-none">
          Tap + to add someone, then tap their name when it's their turn. Tap their name again to stop the clock.
        </p>
      </div>
    </div>

    <GameTimerPlayerList v-else class="col" />

    <q-page-sticky
      v-if="isTurnRunning"
      position="bottom"
      :offset="[0, 108]"
      class="gt-end-turn-sticky full-width"
    >
      <div class="gt-end-turn-row q-px-md">
        <q-btn
          rounded
          unelevated
          no-wrap
          size="lg"
          color="primary"
          icon-right="skip_next"
          label="End turn"
          class="gt-end-turn-btn full-width text-h6"
          padding="14px 24px"
          aria-label="End turn and go to next player"
          @click="store.endTurnNext()"
        />
      </div>
    </q-page-sticky>

    <q-page-sticky position="bottom-right" :offset="[18, 18]">
      <div class="row no-wrap q-gutter-sm items-center">
        <q-btn
          fab-mini
          outline
          color="grey-5"
          icon="playlist_remove"
          :disable="!players.length"
          aria-label="Remove all players"
          @click="resetConfirmOpen = true"
        />
        <q-btn fab color="primary" icon="add" aria-label="Add player" @click="openAddDialog" />
      </div>
    </q-page-sticky>

    <q-dialog v-model="resetConfirmOpen" persistent>
      <q-card class="gt-add-card" style="min-width: 280px">
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
      <q-card class="gt-add-card" style="min-width: 280px">
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
import { nextDefaultColor } from '../../features/game-timer/core.js'
import { useGameTimerStore } from '../../stores/gameTimer.js'

const store = useGameTimerStore()
const { players, activePlayerId, turnStartedAt } = storeToRefs(store)

/** Clock is ticking for the active player (not paused after tapping their name). */
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
  min-height: 0;
  flex: 1 1 auto;
}

/* Room for FABs when list is shown; extra space when End turn bar is visible. */
.gt-page--with-list {
  padding-bottom: 80px;
}

.gt-page--with-list.gt-page--turn-running {
  padding-bottom: 128px;
}

.gt-add-card {
  border-radius: 12px;
}

.gt-end-turn-sticky {
  pointer-events: none;
}

.gt-end-turn-sticky > * {
  pointer-events: auto;
}

.gt-end-turn-row {
  width: 100%;
  max-width: 560px;
  margin-left: auto;
  margin-right: auto;
}

.gt-end-turn-btn {
  min-height: 56px;
}

.gt-end-turn-btn :deep(.q-icon) {
  font-size: 1.5rem;
}
</style>
