/**
 * @typedef {Object} GenerationMapViewportHandle
 * @property {(doc: import('./core/types.js').WorldDocument) => void} updateWorldDocument
 * @property {(focus: import('./core/types.js').MapFocus) => void} [focusOn]
 * @property {(resourceId: string, visible: boolean) => void} [setResourceOverlayVisibility]
 * @property {() => void} destroy
 */

/**
 * @typedef {Object} GenerationMapLifecycle
 * @property {(doc: import('./core/types.js').WorldDocument) => Promise<void>} applyWorldDocument
 * @property {() => GenerationMapViewportHandle | null} getViewport
 * @property {() => void} destroy
 */

/**
 * Single-flight map viewport lifecycle for generation previews: create once per mount,
 * then route subsequent world documents through `updateWorldDocument` only.
 *
 * @param {Object} options
 * @param {() => HTMLElement | null | undefined} options.getMapHost
 * @param {() => ((host: HTMLElement, doc: import('./core/types.js').WorldDocument) => Promise<GenerationMapViewportHandle>) | null | undefined} options.getCreateViewport
 * @param {() => void} [options.onViewportReady]
 * @returns {GenerationMapLifecycle}
 */
export function createGenerationMapLifecycle({ getMapHost, getCreateViewport, onViewportReady }) {
  /** @type {GenerationMapViewportHandle | null} */
  let mapViewport = null
  /** @type {Promise<void> | null} */
  let initInFlight = null
  let destroyed = false

  return {
    async applyWorldDocument(doc) {
      if (destroyed) {
        return
      }

      if (mapViewport) {
        mapViewport.updateWorldDocument(doc)
        return
      }

      if (initInFlight) {
        await initInFlight
        if (destroyed) {
          return
        }
        mapViewport?.updateWorldDocument(doc)
        return
      }

      const host = getMapHost()
      const createViewport = getCreateViewport()
      if (!host || !createViewport) {
        return
      }

      initInFlight = (async () => {
        try {
          if (destroyed || mapViewport) {
            return
          }
          const createdViewport = await createViewport(host, doc)
          if (destroyed) {
            createdViewport.destroy()
            return
          }
          mapViewport = createdViewport
          onViewportReady?.()
        } finally {
          initInFlight = null
        }
      })()

      await initInFlight
    },

    getViewport() {
      return mapViewport
    },

    destroy() {
      destroyed = true
      mapViewport?.destroy()
      mapViewport = null
      initInFlight = null
    },
  }
}
