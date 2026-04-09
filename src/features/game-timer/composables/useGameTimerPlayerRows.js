import { computed, unref } from 'vue'
import { storeToRefs } from 'pinia'
import { useGameTimerStore } from '../../../stores/gameTimer.js'
import { buildPlayerRows } from '../core.js'

/**
 * View-model rows for any game-timer visualization (list, table, etc.).
 * @param {import('vue').Ref<number> | import('vue').ComputedRef<number>} nowRef
 */
export function useGameTimerPlayerRows(nowRef) {
  const store = useGameTimerStore()
  const { players, activePlayerId, turnStartedAt } = storeToRefs(store)

  return computed(() => {
    const session = {
      activePlayerId: activePlayerId.value,
      turnStartedAt: turnStartedAt.value,
    }
    return buildPlayerRows(players.value, session, unref(nowRef))
  })
}
