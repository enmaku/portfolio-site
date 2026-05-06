import { onBeforeUnmount, toValue, watch } from 'vue'
import { createFullscreenController } from './fullscreenController.js'

/**
 * @param {{
 *   enabled: import('vue').MaybeRefOrGetter<boolean>
 *   setEnabled: (next: boolean) => void
 *   getTargetElement: () => Element | null
 *   onRequestFailure?: () => void
 * }} options
 */
export function useScopedFullscreen(options) {
  const readFullscreenElement = () => {
    const doc = /** @type {Document & { webkitFullscreenElement?: Element | null }} */ (document)
    return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null
  }

  const controller = createFullscreenController({
    getTargetElement: options.getTargetElement,
    readEnabled: () => Boolean(toValue(options.enabled)),
    writeEnabled: (next) => options.setEnabled(Boolean(next)),
    onRequestFailure: options.onRequestFailure,
  })

  const stop = watch(
    () => Boolean(toValue(options.enabled)),
    () => {
      void controller.sync()
    },
    { immediate: true },
  )

  const onFullscreenChange = () => {
    const target = options.getTargetElement()
    const isFullscreen = target != null && readFullscreenElement() === target
    options.setEnabled(isFullscreen)
  }

  document.addEventListener('fullscreenchange', onFullscreenChange)
  document.addEventListener('webkitfullscreenchange', onFullscreenChange)
  onFullscreenChange()

  onBeforeUnmount(() => {
    stop()
    document.removeEventListener('fullscreenchange', onFullscreenChange)
    document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
    void controller.cleanup()
  })
}

