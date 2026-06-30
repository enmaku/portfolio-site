import {
  applyResourceOverlayVisibility,
  createDefaultOverlayDisplaySettings,
  createDefaultResourceOverlayVisibility,
} from './resourceOverlays.js'

/** @typedef {import('./resourceOverlays.js').OverlayDisplaySettings} OverlayDisplaySettings */

/**
 * @typedef {Object} ResourceOverlayPageState
 * @property {Record<string, boolean>} visibility
 * @property {OverlayDisplaySettings} displaySettings
 */

/**
 * @param {OverlayDisplaySettings} [overlayDisplaySettings]
 * @returns {ResourceOverlayPageState}
 */
export function createResourceOverlayPageState(
  overlayDisplaySettings = createDefaultOverlayDisplaySettings(),
) {
  return {
    visibility: createDefaultResourceOverlayVisibility(),
    displaySettings: { ...overlayDisplaySettings },
  }
}

/**
 * @param {ResourceOverlayPageState} state
 * @returns {ResourceOverlayPageState}
 */
export function resetResourceOverlayVisibilityState(state) {
  return {
    ...state,
    visibility: createDefaultResourceOverlayVisibility(),
  }
}

/**
 * @param {ResourceOverlayPageState} state
 * @param {string} resourceId
 * @param {boolean} visible
 * @returns {ResourceOverlayPageState}
 */
export function toggleResourceOverlayVisibility(state, resourceId, visible) {
  return {
    ...state,
    visibility: applyResourceOverlayVisibility(state.visibility, resourceId, visible),
  }
}

/**
 * @param {ResourceOverlayPageState} state
 * @param {keyof OverlayDisplaySettings} key
 * @param {number} value
 * @returns {ResourceOverlayPageState}
 */
export function updateOverlayDisplaySetting(state, key, value) {
  return {
    ...state,
    displaySettings: {
      ...state.displaySettings,
      [key]: value,
    },
  }
}

/**
 * @param {{
 *   syncOverlayRenderCache: (state: ResourceOverlayPageState) => void,
 * }} viewport
 * @param {ResourceOverlayPageState} state
 */
export function syncResourceOverlayStateToViewport(viewport, state) {
  viewport.syncOverlayRenderCache(state)
}

/**
 * Commit overlay state and project it to the viewport when one is available.
 *
 * @param {{ syncOverlayRenderCache?: (state: ResourceOverlayPageState) => void } | null | undefined} viewport
 * @param {ResourceOverlayPageState} nextState
 * @returns {ResourceOverlayPageState}
 */
export function commitResourceOverlayState(viewport, nextState) {
  if (viewport) {
    syncResourceOverlayStateToViewport(viewport, nextState)
  }
  return nextState
}
