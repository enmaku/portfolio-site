/**
 * @param {string[]} resourceIds
 * @returns {Record<string, boolean>}
 */
export function createDefaultResourceOverlayVisibility(resourceIds) {
  return Object.fromEntries(resourceIds.map((resourceId) => [resourceId, false]))
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
