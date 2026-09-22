<template>
  <div class="column q-gutter-md mv-host-session-panel">
    <MovieVoteQuorumControls
      v-if="quorumVisible"
      :rows="quorumRows"
      :editable="editable"
      @remove-guest="removeGuestParticipant"
      @clear-guests="clearGuestParticipants"
    />
    <div
      class="row items-center no-wrap justify-between mv-host-phase-controls"
      data-testid="mv-host-phase-controls"
    >
      <q-btn
        flat
        round
        dense
        icon="chevron_left"
        data-testid="mv-host-phase-prev"
        :disable="!canGoPrev"
        aria-label="Previous phase"
        @click="goPrevPhase"
      />
      <div class="col text-center text-subtitle2" data-testid="mv-host-phase-current">
        {{ phaseLabel }}
      </div>
      <q-btn
        flat
        round
        dense
        icon="chevron_right"
        data-testid="mv-host-phase-next"
        :disable="!canGoNext"
        aria-label="Next phase"
        @click="goNextPhase"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useMovieVoteP2P } from '../composables/useMovieVoteP2P.js'
import { buildQuorumRows } from '../buildQuorumRows.js'
import MovieVoteQuorumControls from './MovieVoteQuorumControls.vue'
import { useMovieVoteStore } from '../../../stores/movieVote.js'

const PHASE_LABELS = {
  suggest: 'Suggest',
  voting: 'Voting',
  results: 'Results',
}

const store = useMovieVoteStore()
const {
  participants,
  phase: collabPhase,
  voterIds,
  votesByParticipant,
  ballotOrderIds,
} = storeToRefs(store)
const {
  removeGuestParticipant,
  clearGuestParticipants,
  hostPhaseReturnToSuggest,
  hostPhaseReturnToVoting,
  hostPhaseGoVoting,
  hostPhaseGoResults,
} = useMovieVoteP2P()

const quorumVisible = computed(() => collabPhase.value === 'suggest' || collabPhase.value === 'voting')
const editable = computed(() => collabPhase.value === 'suggest')
const phaseLabel = computed(() => PHASE_LABELS[collabPhase.value] ?? collabPhase.value)
const canGoPrev = computed(() => collabPhase.value === 'voting' || collabPhase.value === 'results')
const canGoNext = computed(() => collabPhase.value === 'suggest' || collabPhase.value === 'voting')

function goPrevPhase() {
  if (collabPhase.value === 'voting') hostPhaseReturnToSuggest()
  else if (collabPhase.value === 'results') hostPhaseReturnToVoting()
}

function goNextPhase() {
  if (collabPhase.value === 'suggest') hostPhaseGoVoting()
  else if (collabPhase.value === 'voting') hostPhaseGoResults()
}

const quorumRows = computed(() =>
  buildQuorumRows({
    phase: collabPhase.value,
    participants: participants.value,
    voterIds: voterIds.value,
    votesByParticipant: votesByParticipant.value,
    ballotOrderIds: ballotOrderIds.value,
  }),
)
</script>
