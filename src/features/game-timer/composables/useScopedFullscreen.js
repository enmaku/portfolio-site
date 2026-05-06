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

  onBeforeUnmount(() => {
    stop()
    void controller.cleanup()
  })
}

