<template>
  <div class="gt-turn-actions row no-wrap items-stretch col">
    <q-btn
      v-if="isClockRunning"
      flat
      dense
      no-wrap
      color="white"
      text-color="white"
      icon="pause"
      class="gt-turn-actions__pause"
      padding="12px 14px"
      aria-label="Pause timer"
      @click="pauseActiveTurn"
    />
    <q-btn
      v-else
      flat
      dense
      no-wrap
      color="white"
      text-color="white"
      icon="play_arrow"
      class="gt-turn-actions__pause"
      padding="12px 14px"
      aria-label="Resume timer"
      @click="resumeActiveTurn"
    />
    <div class="gt-turn-actions__sep" aria-hidden="true" />
    <q-btn
      flat
      dense
      no-wrap
      color="white"
      text-color="white"
      icon-right="skip_next"
      label="End turn"
      class="gt-turn-actions__end col"
      padding="16px 20px"
      aria-label="End turn and go to next player"
      @click="store.endTurnNext()"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useGameTimerStore } from '../../../stores/gameTimer.js'

const store = useGameTimerStore()
const { activePlayerId, turnStartedAt } = storeToRefs(store)

const isClockRunning = computed(
  () => activePlayerId.value != null && turnStartedAt.value != null,
)

function pauseActiveTurn() {
  const id = activePlayerId.value
  if (id != null && turnStartedAt.value != null) {
    store.selectPlayer(id)
  }
}

function resumeActiveTurn() {
  const id = activePlayerId.value
  if (id != null && turnStartedAt.value == null) {
    store.selectPlayer(id)
  }
}
</script>

<style scoped lang="scss">
.gt-turn-actions {
  flex: 1 1 0;
  min-width: 0;
  min-height: 60px;
  background: var(--q-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  border-radius: 9999px;
  overflow: hidden;
}

.gt-turn-actions__pause {
  flex: 0 0 auto;
  min-width: 52px;
  border-radius: 0;
}

.gt-turn-actions__pause :deep(.q-icon) {
  font-size: 1.65rem;
}

.gt-turn-actions__sep {
  flex: 0 0 1px;
  width: 1px;
  align-self: stretch;
  margin: 12px 0;
  background: rgba(255, 255, 255, 0.28);
}

.gt-turn-actions__end {
  flex: 1 1 0;
  min-width: 0;
  border-radius: 0;
}

.gt-turn-actions__end :deep(.q-btn__content) {
  font-size: 1.15rem;
  font-weight: 700;
}

.gt-turn-actions__end :deep(.q-icon) {
  font-size: 1.65rem;
}
</style>
