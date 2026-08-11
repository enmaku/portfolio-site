<template>
  <MovieVoteQuorumControls
    v-if="visible"
    :rows="quorumRows"
    :editable="editable"
    @toggle-quorum="onToggleQuorum"
    @remove-guest="removeGuestParticipant"
    @clear-guests="clearGuestParticipants"
  />
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
const { setParticipantQuorumRequired, removeGuestParticipant, clearGuestParticipants } =
  useMovieVoteP2P()

const visible = computed(() => collabPhase.value === 'suggest' || collabPhase.value === 'voting')
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

/**
 * @param {string} participantId
 * @param {boolean} required
 */
function onToggleQuorum(participantId, required) {
  setParticipantQuorumRequired(participantId, required)
}
</script>
