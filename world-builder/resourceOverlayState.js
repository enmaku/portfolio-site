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
 *   setResourceOverlayVisibility: (resourceId: string, visible: boolean) => void,
 *   setArableOverlayMinimumProductivity: (minimumProductivity: number) => void,
 * }} viewport
 * @param {ResourceOverlayPageState} state
 */
export function syncResourceOverlayStateToViewport(viewport, state) {
  viewport.setArableOverlayMinimumProductivity(state.displaySettings.arableMinimumProductivity)
  for (const resourceId of createResourceOverlayIds()) {
    viewport.setResourceOverlayVisibility(resourceId, state.visibility[resourceId] === true)
  }
}

/**
 * Commit overlay state and project it to the viewport when one is available.
 *
 * @param {Parameters<typeof syncResourceOverlayStateToViewport>[0] | null | undefined} viewport
 * @param {ResourceOverlayPageState} nextState
 * @returns {ResourceOverlayPageState}
 */
export function commitResourceOverlayState(viewport, nextState) {
  if (viewport) {
    syncResourceOverlayStateToViewport(viewport, nextState)
  }
  return nextState
}
