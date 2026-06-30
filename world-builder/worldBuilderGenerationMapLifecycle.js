import { diffWorldDocumentMapLayers } from './renderer/diffWorldDocumentMapLayers.js'

/**
 * @typedef {Object} GenerationMapViewportHandle
 * @property {(doc: import('./core/types.js').WorldDocument, options?: { changedLayers?: Iterable<import('./renderer/mapLayerRefresh.js').MapLayerId> | null }) => void} updateWorldDocument
 * @property {() => void} fitToWorld
 * @property {(focus: import('./core/types.js').MapFocus) => void} [focusOn]
 * @property {(state: import('./resourceOverlayState.js').ResourceOverlayPageState) => void} [syncOverlayRenderCache]
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
  /** @type {import('./core/types.js').WorldDocument | null} */
  let lastAppliedWorldDocument = null
  /** @type {Promise<void> | null} */
  let initInFlight = null
  let destroyed = false

  /**
   * @param {import('./core/types.js').WorldDocument} doc
   */
  function updateViewportWorldDocument(doc) {
    const changedLayers = diffWorldDocumentMapLayers(lastAppliedWorldDocument, doc)
    mapViewport?.updateWorldDocument(
      doc,
      changedLayers == null ? undefined : { changedLayers },
    )
    lastAppliedWorldDocument = doc
  }

  return {
    async applyWorldDocument(doc) {
      if (destroyed) {
        return
      }

      if (mapViewport) {
        updateViewportWorldDocument(doc)
        return
      }

      if (initInFlight) {
        await initInFlight
        if (destroyed) {
          return
        }
        if (mapViewport) {
          updateViewportWorldDocument(doc)
        }
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
          lastAppliedWorldDocument = doc
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
      lastAppliedWorldDocument = null
      initInFlight = null
    },
  }
}
