<template>
  <div class="mv-results q-pa-md column no-wrap min-width-0">
    <div v-if="!electionOutcome" class="text-body2 text-grey-6">No results.</div>

    <template v-else>
      <RoundsLogReplayShell
        :visible="showReplay"
        :replay-model="replayModel"
        :ballot-movies="ballotMovies"
        @complete="onReplayComplete"
      />

      <ResultsSummaryShell
        v-if="showFinal"
        :model="summaryModel"
        :ballot-movies="ballotMovies"
      />

      <PairwiseMatrixShell
        v-if="showPairwiseMatrix"
        :model="pairwiseModel"
        :ballot-movies="ballotMovies"
      />

      <q-btn
        v-if="allowReset && showFinal"
        outline
        color="primary"
        no-caps
        class="full-width q-mt-md"
        label="Start over"
        @click="$emit('reset')"
      />
    </template>
  </div>
</template>

<script setup>
import { storeToRefs } from 'pinia'
import { useMovieVoteResultsPresentation } from '../composables/useMovieVoteResultsPresentation.js'
import { useMovieVoteP2P } from '../composables/useMovieVoteP2P.js'
import PairwiseMatrixShell from '../ui/shells/PairwiseMatrixShell.vue'
import ResultsSummaryShell from '../ui/shells/ResultsSummaryShell.vue'
import RoundsLogReplayShell from '../ui/shells/RoundsLogReplayShell.vue'
import { useMovieVoteStore } from '../../../stores/movieVote.js'

defineProps({
  allowReset: { type: Boolean, default: true },
})

defineEmits(['reset'])

const store = useMovieVoteStore()
const { electionOutcome, ballotMovies, votingMethod } = storeToRefs(store)
const { roomAuthoritySeq, suffix: roomSuffix } = useMovieVoteP2P()

const {
  showReplay,
  showFinal,
  showPairwiseMatrix,
  summaryModel,
  replayModel,
  pairwiseModel,
  onReplayComplete,
} = useMovieVoteResultsPresentation({
  electionOutcome,
  ballotMovies,
  votingMethod,
  roomSuffix,
  roomAuthoritySeq,
})
</script>

<style scoped lang="scss">
.mv-results {
  min-height: 0;
  min-width: 0;
  max-width: 100%;
  width: 100%;
  overflow-x: hidden;
}

.mv-results.col {
  flex: 1 1 auto;
  min-height: auto;
  overflow: visible;
}
</style>
