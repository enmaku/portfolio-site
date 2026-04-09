import { ref, onMounted, onUnmounted } from 'vue'

/**
 * Ref that updates on an interval for live timer / progress UI; clears the interval on unmount.
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
