<template>
  <div class="gt-round-bar row items-center no-wrap full-width">
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
          :class="{ 'gt-round-bar__chev--inert': !hasPlayers }"
          :disable="!hasPlayers"
          :tabindex="hasPlayers ? undefined : -1"
          :aria-hidden="hasPlayers ? undefined : true"
          aria-label="Next round"
          @click="store.goToNextRound()"
        />
      </div>
    </div>
    <div v-if="!isGuest && hasPlayers" class="gt-round-bar__right row no-wrap items-center">
      <q-btn
        flat
        round
        size="md"
        icon="settings"
        color="grey-5"
        class="gt-round-bar__settings gt-round-bar__hit"
        aria-label="Game timer settings"
      >
        <q-menu anchor="bottom right" self="top right" :offset="[0, 6]">
          <div class="gt-settings-menu q-pa-md" style="min-width: 280px">
            <div class="text-subtitle2 text-weight-medium q-mb-sm">Round rules</div>
            <q-toggle v-model="hardPassEnabledModel" color="primary" label="Hard pass" />
            <div class="text-caption text-grey-6 q-mb-md q-ml-sm">
              Remove a player from the current round; optional first-pass order for the next round.
            </div>
            <div class="q-pl-md">
              <q-toggle
                v-model="hardPassOrderNextRoundModel"
                color="primary"
                :disable="!hardPassEnabled"
                label="First to hard pass plays first next round"
              />
            </div>
          </div>
        </q-menu>
      </q-btn>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import GameTimerSyncControl from './GameTimerSyncControl.vue'
import { useGameTimerP2P } from '../composables/useGameTimerP2P.js'
import { useGameTimerStore } from '../../../stores/gameTimer.js'

const { isGuest } = useGameTimerP2P()
const store = useGameTimerStore()
const { round, players, hardPassEnabled, hardPassOrderNextRound } = storeToRefs(store)
const hasPlayers = computed(() => players.value.length > 0)
const canGoPreviousRound = computed(() => hasPlayers.value && round.value > 1)

const hardPassEnabledModel = computed({
  get: () => hardPassEnabled.value,
  set: (v) => store.setHardPassEnabled(Boolean(v)),
})

const hardPassOrderNextRoundModel = computed({
  get: () => hardPassOrderNextRound.value,
  set: (v) => store.setHardPassOrderNextRound(Boolean(v)),
})
</script>

<style scoped lang="scss">
.gt-round-bar {
  flex-shrink: 0;
  position: relative;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 10px;
  padding-bottom: 10px;
  min-height: 56px;
  box-sizing: border-box;
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

</style>
