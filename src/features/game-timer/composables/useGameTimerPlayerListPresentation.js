import { computed, unref } from 'vue'
import { storeToRefs } from 'pinia'
import { hasMultipleRounds } from '../core.js'
import { createPlayerListViewModel } from '../ui/createPlayerListViewModel.js'
import { useGameTimerStore } from '../../../stores/gameTimer.js'

/**
 * Wires reactive store snapshot + wall clock into the player list view model.
 * @param {{ now: import('vue').MaybeRefOrGetter<number> }} sources
 */
export function useGameTimerPlayerListPresentation({ now }) {
  const store = useGameTimerStore()
  const { hardPassEnabled, round, activePlayerId, turnStartedAt, turnStartedRound, players } =
    storeToRefs(store)

  const hasMultipleRoundsFlag = computed(() =>
    hasMultipleRounds({
      round: round.value,
      playerOrderByRound: store.playerOrderByRound,
      players: players.value,
    }),
  )

  const playerRowsById = computed(() =>
    createPlayerListViewModel({
      players: players.value,
      session: {
        activePlayerId: activePlayerId.value,
        turnStartedAt: turnStartedAt.value,
        turnStartedRound: turnStartedRound.value,
      },
      round: round.value,
      hardPassEnabled: hardPassEnabled.value,
      hardPassOrderByRound: store.hardPassOrderByRound,
      hasMultipleRounds: hasMultipleRoundsFlag.value,
      nowMs: unref(now),
    }),
  )

  return {
    hasMultipleRounds: hasMultipleRoundsFlag,
    playerRowsById,
  }
}
