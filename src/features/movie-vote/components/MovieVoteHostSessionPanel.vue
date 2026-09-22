<template>
  <div class="column q-gutter-md mv-host-session-panel">
    <MovieVoteQuorumControls
      v-if="quorumVisible"
      :rows="quorumRows"
      :editable="editable"
      @remove-guest="removeGuestParticipant"
      @clear-guests="clearGuestParticipants"
    />
    <div class="column q-gutter-sm" data-testid="mv-host-phase-controls">
      <div class="text-subtitle2">Phase</div>
      <q-btn
        outline
        no-caps
        color="grey-7"
        class="full-width"
        padding="12px 16px"
        label="Suggest"
        data-testid="mv-host-phase-suggest"
        :disable="collabPhase === 'suggest'"
        @click="hostPhaseReturnToSuggest"
      />
      <q-btn
        outline
        no-caps
        color="grey-7"
        class="full-width"
        padding="12px 16px"
        label="Voting"
        data-testid="mv-host-phase-voting"
        :disable="collabPhase === 'voting'"
        @click="hostPhaseGoVoting"
      />
      <q-btn
        outline
        no-caps
        color="grey-7"
        class="full-width"
        padding="12px 16px"
        label="Results"
        data-testid="mv-host-phase-results"
        :disable="collabPhase === 'results'"
        @click="hostPhaseGoResults"
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
  hostPhaseGoVoting,
  hostPhaseGoResults,
} = useMovieVoteP2P()

const quorumVisible = computed(() => collabPhase.value === 'suggest' || collabPhase.value === 'voting')
const editable = computed(() => collabPhase.value === 'suggest')

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
