/** @typedef {{ id: string, rgb: readonly [number, number, number], hatch: boolean, maxAlpha: number }} ResourceRasterOverlayStyle */

/**
 * High-contrast overlay tints chosen against {@link BIOMES_PALETTE} land colors (greens/browns/tans).
 * Hues sit on the magenta / orange / cyan spokes so rasters read clearly over terrain.
 *
 * @type {Readonly<Record<string, ResourceRasterOverlayStyle>>}
 */
export const RESOURCE_RASTER_OVERLAY_STYLES = {
  arable: {
    id: 'arable',
    rgb: [255, 255, 0],
    hatch: true,
    maxAlpha: 0.85,
  },
  timber: {
    id: 'timber',
    rgb: [57, 255, 20],
    hatch: true,
    maxAlpha: 0.85,
  },
  metals: {
    id: 'metals',
    rgb: [0, 0, 0],
    hatch: true,
    maxAlpha: 0.85,
  },
}

/**
 * @param {string} resourceId
 * @returns {ResourceRasterOverlayStyle | undefined}
 */
export function resourceRasterOverlayStyleForId(resourceId) {
  return RESOURCE_RASTER_OVERLAY_STYLES[resourceId]
}
