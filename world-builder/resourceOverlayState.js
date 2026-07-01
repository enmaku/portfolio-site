import {
  applyResourceOverlayVisibility,
  createDefaultOverlayDisplaySettings,
  createDefaultResourceOverlayVisibility,
  createResourceOverlayIds,
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
 * Quasar QCheckbox treats null/undefined model-value as indeterminate. Coerce every
 * overlay id to a strict boolean before binding or persisting owner state.
 *
 * @param {Record<string, boolean | null | undefined>} visibility
 * @param {string[]} [resourceIds]
 * @returns {Record<string, boolean>}
 */
export function normalizeResourceOverlayVisibility(
  visibility,
  resourceIds = createResourceOverlayIds(),
) {
  return Object.fromEntries(resourceIds.map((resourceId) => [resourceId, visibility[resourceId] === true]))
}

/**
 * @param {ResourceOverlayPageState} state
 * @param {string} resourceId
 * @param {boolean | null | undefined} visible
 * @returns {ResourceOverlayPageState}
 */
export function toggleResourceOverlayVisibility(state, resourceId, visible) {
  return {
    ...state,
    visibility: applyResourceOverlayVisibility(state.visibility, resourceId, visible === true),
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
  const normalizedState = {
    ...nextState,
    visibility: normalizeResourceOverlayVisibility(nextState.visibility),
  }
  if (viewport) {
    syncResourceOverlayStateToViewport(viewport, normalizedState)
  }
  return normalizedState
}
