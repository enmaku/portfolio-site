import { ref, onMounted, onUnmounted } from 'vue'

/**
 * Monotonic clock for live timer / progress UI. Stops updating when unmounted.
 * @param {number} [intervalMs=100]
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
    if (handle) window.clearInterval(handle)
  })

  return now
}
