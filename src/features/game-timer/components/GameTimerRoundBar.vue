<template>
  <div class="gt-round-bar row items-center no-wrap full-width">
    <div class="gt-round-bar__layer-center">
      <div class="row items-center no-wrap gt-round-bar__controls">
        <q-btn
          flat
          round
          dense
          icon="chevron_left"
          color="grey-5"
          :disable="round <= 1"
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
          class="gt-round-bar__chev"
          aria-label="Next round"
          @click="store.goToNextRound()"
        />
      </div>
    </div>
    <q-btn
      flat
      round
      dense
      icon="restart_alt"
      color="grey-5"
      class="gt-round-bar__reset"
      aria-label="Reset round data"
      :disable="!hasMultipleRounds"
      @click="confirmOpen = true"
    />
    <q-dialog v-model="confirmOpen" persistent>
      <q-card class="gt-dialog-card" style="min-width: 280px">
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
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useGameTimerStore } from '../../../stores/gameTimer.js'

const store = useGameTimerStore()
const { round, hasMultipleRounds } = storeToRefs(store)

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
.gt-round-bar__reset {
  flex-shrink: 0;
}

.gt-round-bar__reset {
  position: relative;
  z-index: 1;
  margin-left: auto;
}

.gt-dialog-card {
  border-radius: 12px;
}
</style>
