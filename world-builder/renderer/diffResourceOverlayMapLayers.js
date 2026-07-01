import { createResourceOverlayDefinitions } from '../resourceOverlays.js'

/** @typedef {import('./mapLayerRefresh.js').MapLayerId} MapLayerId */
/** @typedef {import('../resourceOverlayState.js').ResourceOverlayPageState} ResourceOverlayPageState */

/**
 * Map layers whose visible output depends on overlay owner state. Resource raster
 * layers share an id with their resource; node markers map to per-family vector layers.
 *
 * @param {ResourceOverlayPageState} previous
 * @param {ResourceOverlayPageState} next
 * @returns {MapLayerId[]}
 */
export function diffResourceOverlayMapLayers(previous, next) {
  /** @type {Set<MapLayerId>} */
  const changed = new Set()

  for (const definition of createResourceOverlayDefinitions()) {
    if (Boolean(previous.visibility[definition.id]) === Boolean(next.visibility[definition.id])) {
      continue
    }
    if (definition.kind === 'raster' || definition.kind === 'rasterAndNodes') {
      changed.add(/** @type {MapLayerId} */ (definition.id))
    }
    if (
      (definition.kind === 'nodes' || definition.kind === 'rasterAndNodes') &&
      definition.vectorLayerId
    ) {
      changed.add(definition.vectorLayerId)
    }
  }

  if (
    previous.displaySettings.arableMinimumProductivity !==
    next.displaySettings.arableMinimumProductivity
  ) {
    changed.add('arable')
  }

  return [...changed]
}
