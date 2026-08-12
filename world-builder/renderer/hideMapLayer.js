import { clearRecentConquestMarkers, clearSettlementIdLabels } from './drawMapNodeOverlays.js'

/** @type {Readonly<Partial<Record<import('./mapLayerRefresh.js').MapLayerId, keyof MapLayerPresentation>>>} */
const NODE_OVERLAY_CLEAR_KEYS = Object.freeze({
  coastalNodes: 'coastalOverlay',
  metalNodes: 'metalOverlay',
  saltNodes: 'saltOverlay',
  settlementNodes: 'settlementOverlay',
})

/**
 * Sprites/overlays keyed for hide-by-layer-id.
 * @typedef {{
 *   contours: import('pixi.js').Sprite,
 *   arable: import('pixi.js').Sprite,
 *   timber: import('pixi.js').Sprite,
 *   metals: import('pixi.js').Sprite,
 *   sail: import('pixi.js').Sprite,
 *   freshwater: import('pixi.js').Sprite,
 *   population: import('pixi.js').Sprite,
 *   routes: import('pixi.js').Sprite,
 *   wealth: import('pixi.js').Sprite,
 *   portTolls: import('pixi.js').Sprite,
 *   factionTax: import('pixi.js').Sprite,
 *   factionTerritory: import('pixi.js').Sprite,
 *   loyalty: import('pixi.js').Sprite,
 *   [commodityPriceOverlayId: string]: import('pixi.js').Sprite,
 *   rivers: import('pixi.js').Sprite,
 *   lakes: import('pixi.js').Sprite,
 *   coastalOverlay: import('pixi.js').Graphics,
 *   metalOverlay: import('pixi.js').Graphics,
 *   saltOverlay: import('pixi.js').Graphics,
 *   settlementOverlay: import('pixi.js').Graphics,
 *   settlementIdOverlay: import('pixi.js').Container,
 *   recentConquestOverlay: import('pixi.js').Graphics,
 * }} MapLayerPresentation
 */

/**
 * @param {import('./mapLayerRefresh.js').MapLayerId} layerId
 * @param {MapLayerPresentation} layers
 */
export function hideMapLayer(layerId, layers) {
  if (layerId === 'terrain') {
    return
  }
  if (layerId === 'settlementIdLabels') {
    clearSettlementIdLabels(layers.settlementIdOverlay)
    return
  }
  if (layerId === 'recentConquestMarkers') {
    clearRecentConquestMarkers(layers.recentConquestOverlay)
    return
  }
  const overlayKey = NODE_OVERLAY_CLEAR_KEYS[layerId]
  if (overlayKey) {
    layers[overlayKey].clear()
    return
  }
  const sprite = /** @type {import('pixi.js').Sprite | undefined} */ (layers[layerId])
  if (sprite) {
    sprite.visible = false
  }
}
