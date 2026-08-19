import NoSleep from 'nosleep.js'
import { onBeforeUnmount, toValue, watch } from 'vue'
import { createNoSleepController } from './noSleepController.js'

/**
 * Keep the display awake while `enabled` is true, using NoSleep.js with light
 * document hooks for retries after visibility and pointer input.
 * @param {import('vue').MaybeRefOrGetter<boolean>} enabled
 * @param {{ createNoSleep?: () => { enable: () => Promise<void>, disable: () => void }, doc?: typeof document | null }} [deps]
 * @returns {void}
 */
export function useNoSleep(enabled, deps) {
  const createNoSleep = deps?.createNoSleep ?? (() => new NoSleep())
  const doc = deps?.doc !== undefined ? deps.doc : typeof document !== 'undefined' ? document : null

  const controller = createNoSleepController({
    readEnabled: () => Boolean(toValue(enabled)),
    createNoSleep,
    doc,
  })

  const stop = watch(
    () => Boolean(toValue(enabled)),
    () => {
      void controller.sync()
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    stop()
    controller.cleanup()
  })
}
