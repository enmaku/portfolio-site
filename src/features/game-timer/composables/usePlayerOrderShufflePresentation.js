import { readonly, ref } from 'vue'
import {
  createPlayerOrderShuffle,
  PLAYER_ORDER_SHUFFLE_DURATION_MS,
} from '../playerOrderShuffle.js'

const displayedPlayerIds = ref(/** @type {string[] | null} */ (null))
const isPlayerOrderShuffling = ref(false)
let presentationGeneration = 0

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * @param {{ playerIds: string[], seed: number, durationMs?: number, sleep?: (ms: number) => Promise<void> }} options
 * @returns {Promise<string[] | null>}
 */
export async function runPlayerOrderShufflePresentation({
  playerIds,
  seed,
  durationMs = PLAYER_ORDER_SHUFFLE_DURATION_MS,
  sleep = wait,
}) {
  const generation = ++presentationGeneration
  const { orders, targetOrder } = createPlayerOrderShuffle(playerIds, seed)
  const stepDurationMs = durationMs / orders.length
  isPlayerOrderShuffling.value = true
  displayedPlayerIds.value = [...playerIds]

  for (const order of orders) {
    if (generation !== presentationGeneration) return null
    displayedPlayerIds.value = order
    await sleep(stepDurationMs)
  }

  return generation === presentationGeneration ? targetOrder : null
}

export function finishPlayerOrderShufflePresentation() {
  presentationGeneration += 1
  displayedPlayerIds.value = null
  isPlayerOrderShuffling.value = false
}

export function usePlayerOrderShufflePresentation() {
  return {
    displayedPlayerIds: readonly(displayedPlayerIds),
    isPlayerOrderShuffling: readonly(isPlayerOrderShuffling),
  }
}
