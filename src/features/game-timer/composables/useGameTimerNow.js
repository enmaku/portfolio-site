/**
 * Live `Date.now()` ref for timer / progress UI (ticks on an interval; cleared on unmount).
 */

import { ref, onMounted, onUnmounted } from 'vue'

/**
 * Returns a ref of the current time, updated every `intervalMs` while mounted.
 * @param {number} [intervalMs=100]
 * @returns {import('vue').Ref<number>} Epoch ms from `Date.now()`.
 */
export function useGameTimerNow(intervalMs = 100) {
  const now = ref(Date.now())
  let handle = 0

  onMounted(() => {
    const tick = () => {
      now.value = Date.now()
    }
    tick()
    handle = window.setInterval(tick, intervalMs)
  })

  onUnmounted(() => {
    window.clearInterval(handle)
  })

  return now
}
