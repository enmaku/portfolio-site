<template>
  <div class="mv-top-bar row items-center no-wrap full-width q-px-sm q-pt-sm q-pb-xs">
    <MovieVoteSyncControl />
    <div class="col text-center text-subtitle1 text-weight-medium ellipsis q-px-xs">Movie Vote</div>
    <div class="mv-top-bar__end row items-center justify-end no-wrap q-gutter-x-xs">
      <q-btn
        flat
        round
        size="md"
        icon="settings"
        color="grey-5"
        class="mv-top-bar__settings"
        aria-label="Movie vote settings"
      >
        <q-menu anchor="bottom right" self="top right" :offset="[0, 6]">
          <div class="mv-settings-menu q-pa-md" style="min-width: 280px">
            <div class="text-subtitle2 text-weight-medium q-mb-sm">Voting method</div>
            <div class="row items-start no-wrap q-gutter-x-xs">
              <q-select
                v-model="votingMethodModel"
                class="col"
                :options="votingMethodOptions"
                option-value="value"
                option-label="label"
                emit-value
                map-options
                dense
                outlined
                :readonly="settingsModel.votingMethodReadOnly"
                :disable="settingsModel.votingMethodReadOnly"
              />
              <q-btn
                flat
                round
                dense
                type="button"
                icon="info_outline"
                color="grey-6"
                class="mv-settings-menu__method-info"
                aria-label="About voting methods"
                @click.stop="votingMethodHelpOpen = true"
              />
            </div>
            <div v-if="settingsModel.votingMethodReadOnly" class="text-caption text-grey-6 q-mt-sm">
              <template v-if="isGuest">Chosen by the host for this room.</template>
              <template v-else>Locked once voting starts.</template>
            </div>
            <q-separator v-if="settingsModel.showFullscreen" class="q-my-md" />
            <div v-if="settingsModel.showFullscreen">
              <q-toggle v-model="fullscreenModel" color="primary" label="Fullscreen" />
            </div>
          </div>
        </q-menu>
      </q-btn>
      <q-btn
        flat
        round
        size="md"
        color="grey-5"
        class="mv-top-bar__help"
        aria-label="Help and about"
        @click="helpOpen = true"
      >
        <span class="mv-top-bar__help-glyph">
          <q-icon name="help_outline" />
        </span>
      </q-btn>
    </div>
    <MovieVoteHelpDialog v-model="helpOpen" />
    <MovieVoteVotingMethodHelpDialog v-model="votingMethodHelpOpen" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import MovieVoteHelpDialog from './MovieVoteHelpDialog.vue'
import MovieVoteVotingMethodHelpDialog from './MovieVoteVotingMethodHelpDialog.vue'
import MovieVoteSyncControl from './MovieVoteSyncControl.vue'
import { useMovieVoteP2P } from '../composables/useMovieVoteP2P.js'
import { getMovieVoteSettingsModel } from '../settingsModel.js'
import { normalizeVotingMethod, VOTING_METHOD_OPTIONS } from '../votingMethod.js'
import { useMovieVoteStore } from '../../../stores/movieVote.js'

const helpOpen = ref(false)
const votingMethodHelpOpen = ref(false)
const store = useMovieVoteStore()
const { phase, votingMethod, fullscreenEnabled } = storeToRefs(store)
const { isGuest } = useMovieVoteP2P()

const settingsModel = computed(() =>
  getMovieVoteSettingsModel({ isGuest: isGuest.value, phase: phase.value }),
)
const votingMethodOptions = VOTING_METHOD_OPTIONS

const votingMethodModel = computed({
  get: () => votingMethod.value,
  set: (v) => {
    if (settingsModel.value.votingMethodReadOnly) return
    const next = normalizeVotingMethod(v)
    if (next === votingMethod.value) return
    store.setVotingMethod(next)
  },
})

const fullscreenModel = computed({
  get: () => fullscreenEnabled.value,
  set: (v) => store.setFullscreenEnabled(Boolean(v)),
})
</script>

<style scoped>
.mv-top-bar {
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.body--light .mv-top-bar {
  border-bottom-color: rgba(0, 0, 0, 0.08);
}

.mv-top-bar__end {
  flex: 0 0 auto;
}

.mv-top-bar__help-glyph {
  display: inline-flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
}

.mv-top-bar__help-glyph :deep(.q-icon) {
  font-size: 28px;
}

.mv-settings-menu__method-info {
  flex-shrink: 0;
  min-width: 40px;
  min-height: 40px;
}
</style>
