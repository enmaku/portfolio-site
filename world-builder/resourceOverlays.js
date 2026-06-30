import { DEFAULT_WORLD_GENERATION_OPTIONS } from './core/worldGenerationOptions.js'

/** @typedef {Object} OverlayDisplaySettings
 * @property {number} arableMinimumProductivity
 */

/**
 * Display-only arable cutoff; defaults to the generation threshold so the overlay
 * matches the raster envelope unless the user adjusts it (no regeneration).
 */
export const DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY =
  DEFAULT_WORLD_GENERATION_OPTIONS.arableMinimumProductivity

/**
 * @returns {Array<{ id: string, kind: 'nodes' | 'raster' | 'rasterAndNodes', label: string }>}
 */
export function createResourceOverlayDefinitions() {
  return [
    { id: 'arable', kind: 'raster', label: 'Arable' },
    { id: 'timber', kind: 'raster', label: 'Timber' },
    { id: 'metals', kind: 'rasterAndNodes', label: 'Metals' },
    { id: 'salt', kind: 'nodes', label: 'Salt' },
  ]
}

/**
 * @returns {string[]}
 */
export function createResourceOverlayIds() {
  return createResourceOverlayDefinitions().map((definition) => definition.id)
}

/**
 * @param {string[]} [resourceIds]
 * @returns {Record<string, boolean>}
 */
export function createDefaultResourceOverlayVisibility(resourceIds = createResourceOverlayIds()) {
  return Object.fromEntries(resourceIds.map((resourceId) => [resourceId, false]))
}

/**
 * @returns {OverlayDisplaySettings}
 */
export function createDefaultOverlayDisplaySettings() {
  return {
    arableMinimumProductivity: DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY,
  }
}

/**
 * @param {Record<string, boolean>} visibility
 * @param {string} resourceId
 * @param {boolean} visible
 * @returns {Record<string, boolean>}
 */
export function applyResourceOverlayVisibility(visibility, resourceId, visible) {
  return { ...visibility, [resourceId]: Boolean(visible) }
}

/**
 * @param {Record<string, boolean>} visibility
 * @param {string} resourceId
 * @returns {boolean}
 */
export function isResourceOverlayVisible(visibility, resourceId) {
  return visibility[resourceId] === true
}

/**
 * @param {Record<string, boolean>} visibility
 * @param {string} resourceId
 * @param {ReadonlyArray<unknown> | null | undefined} nodes
 * @returns {boolean}
 */
export function shouldDrawResourceNodeOverlay(visibility, resourceId, nodes) {
  return isResourceOverlayVisible(visibility, resourceId) && Boolean(nodes?.length)
}

/**
 * @param {Record<string, boolean>} visibility
 * @param {string} resourceId
 * @param {Float32Array | null | undefined} raster
 * @returns {boolean}
 */
export function shouldDrawResourceRasterOverlay(visibility, resourceId, raster) {
  if (!isResourceOverlayVisible(visibility, resourceId) || !raster?.length) {
    return false
  }
  for (let i = 0; i < raster.length; i += 1) {
    if (raster[i] > 0) return true
  }
  return false
}
