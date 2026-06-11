import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { hasMultipleRounds } from '../core.js'
import { createPlayerListViewModel } from '../ui/createPlayerListViewModel.js'
import { useGameTimerNow } from './useGameTimerNow.js'
import { useGameTimerStore } from '../../../stores/gameTimer.js'

/**
 * Wires reactive store snapshot + wall clock into the player list view model.
 */
export function useGameTimerPlayerListPresentation() {
  const store = useGameTimerStore()
  const now = useGameTimerNow(100)
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
      nowMs: now.value,
    }),
  )

  function isHardPassed(player) {
    if (!hardPassEnabled.value) return false
    const arr = store.hardPassOrderByRound[String(round.value)]
    return Array.isArray(arr) && arr.includes(player.id)
  }

  function isPausedHeldTurn(player) {
    if (isHardPassed(player)) return false
    return activePlayerId.value === player.id && turnStartedAt.value == null
  }

  return {
    hasMultipleRounds: hasMultipleRoundsFlag,
    playerRowsById,
    isHardPassed,
    isPausedHeldTurn,
  }
}
