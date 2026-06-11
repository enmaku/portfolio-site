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
  const consumedReplaySeq = ref(null)

  watch(
    roomSuffix,
    (suffix) => {
      consumedReplaySeq.value = readLastReplayedSeq(suffix)
    },
    { immediate: true },
  )

  const presentation = computed(() =>
    resolveResultsPresentation({
      votingMethod: votingMethod.value ?? electionOutcome.value?.votingMethod,
      electionOutcome: electionOutcome.value,
      roomAuthoritySeq: roomAuthoritySeq.value,
      lastReplayedSeq: consumedReplaySeq.value,
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

      const seq = roomAuthoritySeq.value
      const consumed = consumedReplaySeq.value
      if (
        presentation.value.shouldAnimateReplay &&
        showFinal.value &&
        typeof seq === 'number' &&
        seq > 0 &&
        typeof consumed === 'number' &&
        consumed >= seq
      ) {
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
      consumedReplaySeq.value = seq
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
