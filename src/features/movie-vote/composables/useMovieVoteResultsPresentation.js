import { computed, ref, watch } from 'vue'
import { createPairwiseMatrixViewModel } from '../ui/createPairwiseMatrixViewModel.js'
import { createResultsSummaryViewModel } from '../ui/createResultsSummaryViewModel.js'
import { createRoundsLogReplayViewModel } from '../ui/createRoundsLogReplayViewModel.js'
import { resolveResultsPresentation } from '../ui/resultsPresentationPolicy.js'
import {
  readLastReplayedSeq,
  rememberReplayedSeq,
} from '../ui/resultsReplaySeqMemory.js'

/**
 * @param {{
 *   electionOutcome: import('vue').Ref<import('../electionOutcomeTypes.js').ElectionOutcome | null>,
 *   ballotMovies: import('vue').Ref<import('../types.js').BallotMovie[]>,
 *   votingMethod: import('vue').Ref<import('../votingMethod.js').VotingMethod | string>,
 *   roomSuffix: import('vue').Ref<string | null>,
 *   roomAuthoritySeq: import('vue').Ref<number>,
 * }} sources
 */
export function useMovieVoteResultsPresentation({
  electionOutcome,
  ballotMovies,
  votingMethod,
  roomSuffix,
  roomAuthoritySeq,
}) {
  const showReplay = ref(false)
  const showFinal = ref(false)

  const lastReplayedSeq = computed(() => readLastReplayedSeq(roomSuffix.value))

  const presentation = computed(() =>
    resolveResultsPresentation({
      votingMethod: votingMethod.value ?? electionOutcome.value?.votingMethod,
      electionOutcome: electionOutcome.value,
      roomAuthoritySeq: roomAuthoritySeq.value,
      lastReplayedSeq: lastReplayedSeq.value,
    }),
  )

  const summaryModel = computed(() =>
    createResultsSummaryViewModel({
      electionOutcome: electionOutcome.value,
      ballotMovies: ballotMovies.value,
    }),
  )

  const replayModel = computed(() =>
    createRoundsLogReplayViewModel({
      electionOutcome: electionOutcome.value,
      ballotMovies: ballotMovies.value,
    }),
  )

  const pairwiseModel = computed(() =>
    createPairwiseMatrixViewModel({
      electionOutcome: electionOutcome.value,
      ballotMovies: ballotMovies.value,
    }),
  )

  const showPairwiseMatrix = computed(
    () => showFinal.value && presentation.value.showPairwiseMatrixNow && pairwiseModel.value.mount,
  )

  watch(
    [electionOutcome, presentation],
    () => {
      if (!electionOutcome.value) {
        showReplay.value = false
        showFinal.value = false
        return
      }
      if (presentation.value.shouldAnimateReplay) {
        showReplay.value = true
        showFinal.value = false
      } else {
        showReplay.value = false
        showFinal.value = presentation.value.showResultsSummaryNow
      }
    },
    { immediate: true },
  )

  function onReplayComplete() {
    const suffix = roomSuffix.value
    const seq = roomAuthoritySeq.value
    if (suffix && typeof seq === 'number' && seq > 0) {
      rememberReplayedSeq(suffix, seq)
    }
    showReplay.value = false
    showFinal.value = true
  }

  return {
    showReplay,
    showFinal,
    showPairwiseMatrix,
    summaryModel,
    replayModel,
    pairwiseModel,
    onReplayComplete,
  }
}
