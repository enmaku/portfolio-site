/**
 * Screen Wake Lock API: keeps the display on while `enabled` is true.
 * Re-requests when the tab becomes visible again; retries on pointer input if a request failed (e.g. no user gesture yet).
 */

import { onBeforeUnmount, toValue, watch } from 'vue'

/**
 * Composable: acquire / release screen wake lock based on `enabled`.
 * @param {import('vue').MaybeRefOrGetter<boolean>} enabled
 * @returns {void}
 */
export function useScreenWakeLock(enabled) {
  /** @type {WakeLockSentinel | null} */
  let sentinel = null

  function release() {
    try {
      sentinel?.release()
    } catch {
      void 0
    }
    sentinel = null
  }

  async function request() {
    const wl = navigator.wakeLock
    if (!wl?.request) return
    try {
      release()
      sentinel = await wl.request('screen')
      sentinel.addEventListener('release', () => {
        sentinel = null
      })
    } catch {
      void 0
    }
  }

  function readEnabled() {
    return toValue(enabled)
  }

  function onVisibility() {
    if (document.visibilityState === 'visible' && readEnabled()) {
      void request()
    }
  }

  function onPointerDown() {
    if (readEnabled() && !sentinel) {
      void request()
    }
  }

  const stop = watch(
    () => readEnabled(),
    (on) => {
      if (on) {
        void request()
        document.addEventListener('pointerdown', onPointerDown, { capture: true })
      } else {
        document.removeEventListener('pointerdown', onPointerDown, { capture: true })
        release()
      }
    },
    { immediate: true },
  )

  document.addEventListener('visibilitychange', onVisibility)

  onBeforeUnmount(() => {
    stop()
    document.removeEventListener('visibilitychange', onVisibility)
    document.removeEventListener('pointerdown', onPointerDown, { capture: true })
    release()
  })
}
