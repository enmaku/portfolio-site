<template>
  <div class="gt-round-bar full-width">
    <div class="gt-round-bar__main row items-center no-wrap full-width">
      <GameTimerSyncControl class="gt-round-bar__sync" />
      <div class="gt-round-bar__layer-center">
        <div class="row items-center no-wrap gt-round-bar__controls">
          <q-btn
            flat
            round
            size="md"
            icon="chevron_left"
            color="grey-5"
            class="gt-round-bar__chev gt-round-bar__hit"
            :class="{ 'gt-round-bar__chev--inert': !canGoPreviousRound }"
            :disable="!canGoPreviousRound"
            :tabindex="canGoPreviousRound ? undefined : -1"
            :aria-hidden="canGoPreviousRound ? undefined : true"
            aria-label="Previous round"
            @click="store.goToPreviousRound()"
          />
          <div class="gt-round-bar__value text-weight-medium q-px-md" aria-live="polite">
            Round {{ round }}
          </div>
          <q-btn
            flat
            round
            size="md"
            icon="chevron_right"
            color="grey-5"
            class="gt-round-bar__chev gt-round-bar__hit"
            :class="{ 'gt-round-bar__chev--inert': !canGoNextRound }"
            :disable="!canGoNextRound"
            :tabindex="canGoNextRound ? undefined : -1"
            :aria-hidden="canGoNextRound ? undefined : true"
            aria-label="Next round"
            @click="store.goToNextRound()"
          />
        </div>
      </div>
      <div class="gt-round-bar__right row no-wrap items-center q-gutter-x-xs">
        <q-btn
          v-if="chromeModel.showTopBarShuffle"
          flat
          round
          size="md"
          icon="casino"
          color="grey-5"
          class="gt-round-bar__new-game gt-round-bar__hit"
          aria-label="Randomize player order"
          data-testid="gt-shuffle-players"
          :loading="isPlayerOrderShuffling"
          @click="shufflePlayers"
        />
        <q-btn
          v-else-if="chromeModel.showTopBarNewGame"
          flat
          round
          size="md"
          icon="restart_alt"
          color="grey-5"
          class="gt-round-bar__new-game gt-round-bar__hit"
          aria-label="Start new game with same players"
          data-testid="gt-start-new-game"
          :disable="isPlayerOrderShuffling"
          @click="newGameDialogOpen = true"
        />
        <q-btn
          v-if="chromeModel.showMoreOptions"
          flat
          round
          size="md"
          icon="more_vert"
          color="grey-5"
          class="gt-round-bar__settings gt-round-bar__hit"
          aria-label="More options"
          data-testid="gt-more-options"
          :disable="isPlayerOrderShuffling"
        >
          <q-menu anchor="bottom right" self="top right" :offset="[0, 6]">
            <q-list style="min-width: 220px" dense>
              <q-item v-close-popup clickable data-testid="gt-more-clear-users" @click="emitClearUsers">
                <q-item-section>Clear users</q-item-section>
              </q-item>
              <q-item v-close-popup clickable data-testid="gt-more-add-user" @click="emitAddUser">
                <q-item-section>Add user</q-item-section>
              </q-item>
              <q-item
                v-close-popup
                clickable
                data-testid="gt-more-settings"
                @click="settingsDialogOpen = true"
              >
                <q-item-section>Settings</q-item-section>
              </q-item>
              <q-item
                v-if="chromeModel.showMoreOptionsShuffle"
                v-close-popup
                clickable
                data-testid="gt-more-shuffle-players"
                :disable="isPlayerOrderShuffling"
                @click="shufflePlayers"
              >
                <q-item-section>Randomize player order</q-item-section>
              </q-item>
              <q-item
                v-close-popup
                clickable
                data-testid="gt-more-new-game"
                @click="newGameDialogOpen = true"
              >
                <q-item-section>New game with same players</q-item-section>
              </q-item>
              <q-separator />
              <q-item
                v-if="chromeModel.showGameEnd"
                v-close-popup
                clickable
                data-testid="gt-more-game-end"
                @click="gameEndDialogOpen = true"
              >
                <q-item-section>End game</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
        <q-btn
          v-else-if="chromeModel.showSettingsCog"
          flat
          round
          size="md"
          icon="settings"
          color="grey-5"
          class="gt-round-bar__settings gt-round-bar__hit"
          aria-label="Game timer settings"
          data-testid="gt-settings-cog"
          :disable="isPlayerOrderShuffling"
        >
          <q-menu anchor="bottom right" self="top right" :offset="[0, 6]">
            <div class="gt-settings-menu q-pa-md" style="min-width: 280px">
              <template v-if="settingsModel.showRoundRules">
                <div class="text-subtitle2 text-weight-medium q-mb-sm">Round rules</div>
                <q-toggle v-model="hardPassEnabledModel" color="primary" label="Hard pass" />
                <div class="text-caption text-grey-6 q-mb-md q-ml-sm">
                  Hard pass removes a player from the current round.
                </div>
                <div class="q-pl-md q-mb-sm">
                  <q-toggle
                    v-model="hardPassOrderNextRoundModel"
                    color="primary"
                    :disable="!hardPassEnabled"
                    label="Pass order determines round order"
                  />
                </div>
              </template>
              <div v-if="settingsModel.showFullscreen">
                <q-toggle v-model="fullscreenModel" color="primary" label="Fullscreen" />
              </div>
            </div>
          </q-menu>
        </q-btn>
      </div>
    </div>
    <button
      type="button"
      class="gt-round-bar__session-strip row items-center justify-between full-width"
      :disabled="isPlayerOrderShuffling"
      @click="store.toggleTimingStripMode()"
    >
      <span class="gt-round-bar__session-label">{{ timingStripLabel }}</span>
      <span class="gt-round-bar__session-value text-mono">{{ timingStripValue }}</span>
    </button>

    <q-dialog v-model="settingsDialogOpen" @before-hide="blurActiveElement">
      <q-card class="gt-dialog-card gt-dialog-card--narrow" data-testid="gt-settings-dialog">
        <q-card-section class="text-h6">Settings</q-card-section>
        <q-card-section class="q-pt-none gt-settings-menu">
          <template v-if="settingsModel.showRoundRules">
            <div class="text-subtitle2 text-weight-medium q-mb-sm">Round rules</div>
            <q-toggle v-model="hardPassEnabledModel" color="primary" label="Hard pass" />
            <div class="text-caption text-grey-6 q-mb-md q-ml-sm">
              Hard pass removes a player from the current round.
            </div>
            <div class="q-pl-md q-mb-sm">
              <q-toggle
                v-model="hardPassOrderNextRoundModel"
                color="primary"
                :disable="!hardPassEnabled"
                label="Pass order determines round order"
              />
            </div>
          </template>
          <div v-if="settingsModel.showFullscreen">
            <q-toggle v-model="fullscreenModel" color="primary" label="Fullscreen" />
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Done" color="primary" v-close-popup data-testid="gt-settings-dialog-done" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="newGameDialogOpen" persistent>
      <q-card class="gt-dialog-card gt-dialog-card--narrow">
        <q-card-section class="text-h6">Start new game?</q-card-section>
        <q-card-section class="q-pt-none text-body2">
          All times and round progress reset to a clean start. Players, turn order as shown, and session options (round
          rules, timing strip, fullscreen) stay as they are.
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey" @click="newGameDialogOpen = false" />
          <q-btn unelevated label="Start new game" color="primary" @click="confirmStartNewGame" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="gameEndDialogOpen" persistent>
      <q-card class="gt-dialog-card gt-dialog-card--narrow">
        <q-card-section class="text-h6">End game?</q-card-section>
        <q-card-section class="q-pt-none text-body2">
          Continue to scoring with the current timer results. If you are hosting a room, the room ends for everyone.
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey" @click="gameEndDialogOpen = false" />
          <q-btn
            unelevated
            label="Continue to scoring"
            color="primary"
            data-testid="gt-confirm-game-end"
            @click="confirmGameEnd"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { computed, ref, unref } from 'vue'
import { storeToRefs } from 'pinia'
import GameTimerSyncControl from './GameTimerSyncControl.vue'
import { formatDurationMs, nonPlayerElapsedMs, totalGameElapsedMs } from '../core.js'
import { useGameTimerNow } from '../composables/useGameTimerNow.js'
import { useGameTimerP2P } from '../composables/useGameTimerP2P.js'
import {
  finishPlayerOrderShufflePresentation,
  runPlayerOrderShufflePresentation,
  usePlayerOrderShufflePresentation,
} from '../composables/usePlayerOrderShufflePresentation.js'
import {
  canShufflePlayerOrder,
  createPlayerOrderShuffleSeed,
} from '../playerOrderShuffle.js'
import {
  broadcastPlayerOrderShuffle,
  isP2PSessionActive,
} from '../p2p/session.js'
import { useGameTimerStore } from '../../../stores/gameTimer.js'
import { useGameManagerTimerLinkStore } from '../../../stores/gameManagerTimerLink.js'
import { getGameTimerSettingsModel } from '../settingsModel.js'
import { getManagerLinkedChromeModel } from '../linkedChromeModel.js'
import { useProjectShellBrowserFullscreenChrome } from '../../../layouts/projects/projectShellFullscreenChrome.js'

const emit = defineEmits(['add-user', 'clear-users', 'request-game-end'])

const { isGuest } = useGameTimerP2P()
const { isPlayerOrderShuffling } = usePlayerOrderShufflePresentation()
const fullscreenChromeExposed = useProjectShellBrowserFullscreenChrome()
const store = useGameTimerStore()
const linkStore = useGameManagerTimerLinkStore()
const now = useGameTimerNow(1000)
const { round, players, hardPassEnabled, hardPassOrderNextRound, fullscreenEnabled, timingStripMode } =
  storeToRefs(store)
const { isManagerLinked } = storeToRefs(linkStore)
const hasPlayers = computed(() => players.value.length > 0)
const canShufflePlayers = computed(
  () => !isGuest.value && canShufflePlayerOrder(store.$state),
)
const chromeModel = computed(() =>
  getManagerLinkedChromeModel({
    isManagerLinked: isManagerLinked.value,
    isGuest: isGuest.value,
    canShuffle: canShufflePlayers.value,
    hasPlayers: hasPlayers.value,
  }),
)
const newGameDialogOpen = ref(false)
const gameEndDialogOpen = ref(false)
const settingsDialogOpen = ref(false)
const canGoPreviousRound = computed(
  () => hasPlayers.value && round.value > 1 && !isPlayerOrderShuffling.value,
)
const canGoNextRound = computed(() => hasPlayers.value && !isPlayerOrderShuffling.value)
const settingsModel = computed(() =>
  getGameTimerSettingsModel({
    isGuest: isGuest.value,
    fullscreenChromeExposed: unref(fullscreenChromeExposed),
  }),
)
const timingSnapshot = computed(() => ({
  totalGameStartedAt: store.totalGameStartedAt,
  players: store.players,
  activePlayerId: store.activePlayerId,
  turnStartedAt: store.turnStartedAt,
}))
const totalGameElapsedMsValue = computed(() =>
  totalGameElapsedMs(timingSnapshot.value, now.value),
)
const nonPlayerElapsedMsValue = computed(() =>
  nonPlayerElapsedMs(timingSnapshot.value, now.value),
)
const timingStripLabel = computed(() =>
  timingStripMode.value === 'non-player' ? 'Non-player' : 'Total game',
)
const timingStripValue = computed(() =>
  formatDurationMs(
    timingStripMode.value === 'non-player' ? nonPlayerElapsedMsValue.value : totalGameElapsedMsValue.value,
  ),
)

const hardPassEnabledModel = computed({
  get: () => hardPassEnabled.value,
  set: (v) => store.setHardPassEnabled(Boolean(v)),
})

const hardPassOrderNextRoundModel = computed({
  get: () => hardPassOrderNextRound.value,
  set: (v) => store.setHardPassOrderNextRound(Boolean(v)),
})

const fullscreenModel = computed({
  get: () => fullscreenEnabled.value,
  set: (v) => store.setFullscreenEnabled(Boolean(v)),
})

function blurActiveElement() {
  const el = document.activeElement
  if (el && el !== document.body && typeof el.blur === 'function') {
    el.blur()
  }
}

function confirmStartNewGame() {
  store.startNewGameSamePlayers()
  newGameDialogOpen.value = false
}

function emitAddUser() {
  emit('add-user')
}

function emitClearUsers() {
  emit('clear-users')
}

function confirmGameEnd() {
  gameEndDialogOpen.value = false
  emit('request-game-end')
}

async function shufflePlayers() {
  if (!canShufflePlayers.value || isPlayerOrderShuffling.value) return
  const seed = createPlayerOrderShuffleSeed()
  const playerIds = store.players.map((player) => player.id)
  if (isP2PSessionActive() && !(await broadcastPlayerOrderShuffle(seed))) return
  if (
    !canShufflePlayers.value ||
    playerIds.some((id, index) => store.players[index]?.id !== id)
  ) {
    return
  }

  const targetOrder = await runPlayerOrderShufflePresentation({ playerIds, seed })
  if (!targetOrder || !canShufflePlayers.value) {
    finishPlayerOrderShufflePresentation()
    return
  }

  const playersById = new Map(store.players.map((player) => [player.id, player]))
  const shuffledPlayers = targetOrder.map((id) => playersById.get(id))
  if (shuffledPlayers.some((player) => !player)) {
    finishPlayerOrderShufflePresentation()
    return
  }

  store.completePlayerOrderShuffle(shuffledPlayers)
  finishPlayerOrderShufflePresentation()
}
</script>

<style scoped lang="scss">
.gt-round-bar {
  flex-shrink: 0;
  position: relative;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  min-height: 92px;
  box-sizing: border-box;
}
.gt-round-bar__main {
  position: relative;
  padding-top: 10px;
  padding-bottom: 8px;
  min-height: 56px;
}


.body--light .gt-round-bar {
  border-bottom-color: rgba(0, 0, 0, 0.08);
}

/* Absolute layer centers round controls; sync/settings stay in normal flow at the bar edges. */
.gt-round-bar__layer-center {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.gt-round-bar__controls {
  pointer-events: auto;
}

.gt-round-bar__value {
  min-width: 6.5rem;
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-size: 1.125rem;
  line-height: 1.3;
}

@media (max-width: 599px) {
  .gt-round-bar__value {
    font-size: 1.2rem;
  }
}

.gt-round-bar__hit {
  min-width: 48px;
  min-height: 48px;
}

.gt-round-bar__chev,
.gt-round-bar__new-game,
.gt-round-bar__settings,
.gt-round-bar__sync {
  flex-shrink: 0;
}

/* Keeps round label + next chevron centered; slot stays 48×48 when prev is unusable */
.gt-round-bar__chev--inert {
  visibility: hidden;
  pointer-events: none;
}

.gt-round-bar__sync {
  position: relative;
  z-index: 1;
}

.gt-round-bar__sync :deep(.q-btn) {
  min-width: 48px;
  min-height: 48px;
}

.gt-round-bar__right {
  position: relative;
  z-index: 1;
  margin-left: auto;
}

.gt-round-bar__session-strip {
  border: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.86);
  min-height: 34px;
  padding: 0 12px;
  text-align: left;
}

.gt-round-bar__session-label,
.gt-round-bar__session-value {
  font-size: 0.85rem;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.gt-round-bar__session-label {
  letter-spacing: 0.01em;
}

.body--light .gt-round-bar__session-strip {
  border-top-color: rgba(0, 0, 0, 0.08);
  background: rgba(0, 0, 0, 0.05);
  color: rgba(0, 0, 0, 0.72);
}

</style>
