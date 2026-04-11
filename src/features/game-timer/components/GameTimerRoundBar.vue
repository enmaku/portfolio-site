<template>
  <div class="gt-round-bar row items-center no-wrap full-width">
    <GameTimerSyncControl class="gt-round-bar__sync" />
    <div class="gt-round-bar__layer-center">
      <div class="row items-center no-wrap gt-round-bar__controls">
        <q-btn
          flat
          round
          dense
          icon="chevron_left"
          color="grey-5"
          :disable="!hasPlayers || round <= 1"
          class="gt-round-bar__chev"
          aria-label="Previous round"
          @click="store.goToPreviousRound()"
        />
        <div class="gt-round-bar__value text-h6 text-weight-medium q-px-md" aria-live="polite">
          Round {{ round }}
        </div>
        <q-btn
          flat
          round
          dense
          icon="chevron_right"
          color="grey-5"
          :disable="!hasPlayers"
          class="gt-round-bar__chev"
          aria-label="Next round"
          @click="store.goToNextRound()"
        />
      </div>
    </div>
    <q-btn
      v-if="!isGuest"
      flat
      round
      dense
      icon="restart_alt"
      color="grey-5"
      class="gt-round-bar__reset"
      aria-label="Reset round data"
      :disable="!hasPlayers || !hasMultipleRounds"
      @click="confirmOpen = true"
    />
    <q-dialog v-model="confirmOpen" persistent>
      <q-card class="gt-dialog-card gt-dialog-card--narrow">
        <q-card-section class="text-h6">Reset round data?</q-card-section>
        <q-card-section class="q-pt-none text-body2">
          This clears all <strong>per-round</strong> time (the thinner progress bar and round totals in each row). Lifetime
          totals stay the same. The current round goes back to <strong>1</strong>, and any running turn is stopped.
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey" @click="confirmOpen = false" />
          <q-btn unelevated label="Reset" color="warning" @click="confirmReset" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import GameTimerSyncControl from './GameTimerSyncControl.vue'
import { useGameTimerP2P } from '../composables/useGameTimerP2P.js'
import { useGameTimerStore } from '../../../stores/gameTimer.js'

const { isGuest } = useGameTimerP2P()
const store = useGameTimerStore()
const { round, hasMultipleRounds, players } = storeToRefs(store)
const hasPlayers = computed(() => players.value.length > 0)

const confirmOpen = ref(false)

function confirmReset() {
  store.resetRoundTimeData()
  confirmOpen.value = false
}
</script>

<style scoped lang="scss">
.gt-round-bar {
  flex-shrink: 0;
  position: relative;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 4px;
  padding-bottom: 4px;
}

.body--light .gt-round-bar {
  border-bottom-color: rgba(0, 0, 0, 0.08);
}

/* True horizontal center for prev / label / next; reset sits on the trailing edge. */
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
}

.gt-round-bar__chev,
.gt-round-bar__reset,
.gt-round-bar__sync {
  flex-shrink: 0;
}

.gt-round-bar__sync {
  position: relative;
  z-index: 1;
}

.gt-round-bar__reset {
  position: relative;
  z-index: 1;
  margin-left: auto;
}

</style>
