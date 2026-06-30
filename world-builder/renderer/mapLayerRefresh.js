/** @typedef {'terrain' | 'contours' | 'arable' | 'timber' | 'metals' | 'rivers' | 'lakes' | 'vectorOverlays'} MapLayerId */

/** @type {readonly MapLayerId[]} */
export const ALL_MAP_LAYER_IDS = [
  'terrain',
  'contours',
  'arable',
  'timber',
  'metals',
  'rivers',
  'lakes',
  'vectorOverlays',
]

/**
 * @param {Iterable<MapLayerId> | null | undefined} changedLayers
 * @returns {boolean}
 */
export function isFullMapLayerRefresh(changedLayers) {
  return changedLayers == null
}

/**
 * @param {Iterable<MapLayerId> | null | undefined} changedLayers
 * @param {MapLayerId} layerId
 * @returns {boolean}
 */
export function shouldRefreshMapLayer(changedLayers, layerId) {
  if (isFullMapLayerRefresh(changedLayers)) {
    return true
  }
  for (const id of changedLayers) {
    if (id === layerId) {
      return true
    }
  }
  return false
}

/**
 * @typedef {Object} MapLayerRefreshOptions
 * @property {boolean} [hideUnrefreshedLayers] when partial, hide layers not in changedLayers
 */

/**
 * @typedef {Object} MapLayerRefreshRunner
 * @property {(changedLayers?: Iterable<MapLayerId> | null, options?: MapLayerRefreshOptions) => void} refresh
 */

/**
 * @param {Record<MapLayerId, () => void>} handlers
 * @param {{ hideLayer?: (layerId: MapLayerId) => void }} [options]
 * @returns {MapLayerRefreshRunner}
 */
export function createMapLayerRefreshRunner(handlers, options = {}) {
  const { hideLayer } = options

  return {
    refresh(changedLayers, refreshOptions = {}) {
      if (!isFullMapLayerRefresh(changedLayers) && refreshOptions.hideUnrefreshedLayers) {
        for (const layerId of ALL_MAP_LAYER_IDS) {
          if (!shouldRefreshMapLayer(changedLayers, layerId)) {
            hideLayer?.(layerId)
          }
        }
      }

      for (const layerId of ALL_MAP_LAYER_IDS) {
        if (shouldRefreshMapLayer(changedLayers, layerId)) {
          handlers[layerId]()
        }
      }
    },
  }
}
