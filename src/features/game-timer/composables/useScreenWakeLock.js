/**
 * Screen Wake Lock API plus a silent looping video fallback (canvas captureStream) for
 * browsers where Wake Lock is missing, rejects, or drops — common on iOS Safari.
 */

import { onBeforeUnmount, toValue, watch } from 'vue'

/** @param {HTMLVideoElement} video */
function detachVideo(video) {
  try {
    video.pause()
    const src = video.srcObject
    if (src && 'getTracks' in src) {
      for (const t of /** @type {MediaStream} */ (src).getTracks()) {
        t.stop()
      }
    }
    video.srcObject = null
    video.remove()
  } catch {
    void 0
  }
}

/**
 * Composable: acquire / release screen wake lock based on `enabled`.
 * @param {import('vue').MaybeRefOrGetter<boolean>} enabled
 * @returns {void}
 */
export function useScreenWakeLock(enabled) {
  /** @type {WakeLockSentinel | null} */
  let sentinel = null
  /** @type {HTMLVideoElement | null} */
  let fallbackVideo = null

  function releaseWakeLock() {
    try {
      sentinel?.release()
    } catch {
      void 0
    }
    sentinel = null
  }

  function stopFallback() {
    if (fallbackVideo) {
      detachVideo(fallbackVideo)
      fallbackVideo = null
    }
  }

  function ensureFallbackVideo() {
    if (fallbackVideo != null) return fallbackVideo
    const canvas = document.createElement('canvas')
    canvas.width = 2
    canvas.height = 2
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#000001'
      ctx.fillRect(0, 0, 2, 2)
    }
    const stream = typeof canvas.captureStream === 'function' ? canvas.captureStream(12) : null
    if (!stream) return null

    const video = document.createElement('video')
    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')
    video.muted = true
    video.defaultMuted = true
    video.loop = true
    video.setAttribute('width', '1')
    video.setAttribute('height', '1')
    video.srcObject = stream
    Object.assign(video.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '1px',
      height: '1px',
      opacity: '0.02',
      pointerEvents: 'none',
      zIndex: '0',
    })
    document.body.appendChild(video)
    fallbackVideo = video
    return video
  }

  async function playFallback() {
    const v = ensureFallbackVideo()
    if (!v) return
    try {
      await v.play()
    } catch {
      void 0
    }
  }

  async function requestWakeLock() {
    const wl = navigator.wakeLock
    if (!wl?.request) return false
    try {
      releaseWakeLock()
      sentinel = await wl.request('screen')
      sentinel.addEventListener('release', () => {
        sentinel = null
      })
      return true
    } catch {
      if (import.meta.env.DEV) {
        console.info('[useScreenWakeLock] Wake Lock request failed; using fallback if needed.')
      }
      return false
    }
  }

  function readEnabled() {
    return toValue(enabled)
  }

  async function syncWakeStrategy() {
    if (!readEnabled()) return
    const hasApi = typeof navigator !== 'undefined' && Boolean(navigator.wakeLock?.request)
    const ok = hasApi ? await requestWakeLock() : false
    if (!ok) {
      await playFallback()
    } else {
      stopFallback()
    }
  }

  function onVisibility() {
    if (document.visibilityState === 'visible' && readEnabled()) {
      void syncWakeStrategy()
    }
  }

  function onPointerDown() {
    if (readEnabled()) {
      void syncWakeStrategy()
    }
  }

  const stop = watch(
    () => readEnabled(),
    (on) => {
      if (on) {
        void syncWakeStrategy()
        document.addEventListener('pointerdown', onPointerDown, { capture: true })
      } else {
        document.removeEventListener('pointerdown', onPointerDown, { capture: true })
        releaseWakeLock()
        stopFallback()
      }
    },
    { immediate: true },
  )

  document.addEventListener('visibilitychange', onVisibility)

  onBeforeUnmount(() => {
    stop()
    document.removeEventListener('visibilitychange', onVisibility)
    document.removeEventListener('pointerdown', onPointerDown, { capture: true })
    releaseWakeLock()
    stopFallback()
  })
}
