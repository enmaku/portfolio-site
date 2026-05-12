/**
 * @param {{
 *   readEnabled: () => boolean
 *   createNoSleep: () => { enable: () => Promise<void>, disable: () => void }
 *   doc?: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'> | null
 * }} options
 */
export function createNoSleepController(options) {
  const doc =
    options.doc !== undefined
      ? options.doc
      : typeof document !== 'undefined'
        ? document
        : null

  /** @type {{ enable: () => Promise<void>, disable: () => void } | null} */
  let instance = null
  let listenersAttached = false

  function onVisibility() {
    if (doc && doc.visibilityState === 'visible' && options.readEnabled()) {
      void tryEnable()
    }
  }

  function onPointerDown() {
    if (options.readEnabled()) {
      void tryEnable()
    }
  }

  function attachRetryListeners() {
    if (!doc || listenersAttached) return
    doc.addEventListener('visibilitychange', onVisibility)
    doc.addEventListener('pointerdown', onPointerDown, { capture: true })
    listenersAttached = true
  }

  function detachRetryListeners() {
    if (!doc || !listenersAttached) return
    doc.removeEventListener('visibilitychange', onVisibility)
    doc.removeEventListener('pointerdown', onPointerDown, { capture: true })
    listenersAttached = false
  }

  async function tryEnable() {
    if (!options.readEnabled()) return
    if (!instance) {
      instance = options.createNoSleep()
    }
    try {
      await instance.enable()
    } catch {
      void 0
    }
  }

  return {
    async sync() {
      if (!options.readEnabled()) {
        detachRetryListeners()
        if (instance) {
          instance.disable()
        }
        return
      }
      attachRetryListeners()
      await tryEnable()
    },
    cleanup() {
      detachRetryListeners()
      if (instance) {
        instance.disable()
        instance = null
      }
    },
  }
}
