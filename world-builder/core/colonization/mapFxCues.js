/**
 * Mid-tick map cues for epoch step (display-only; never branch sim).
 * Domain: world-builder/CONTEXT.md — Progress chrome, Faction territory overlay.
 */

/**
 * @typedef {Object} MapFxControlOverlayRefreshCue
 * @property {'control_overlay_refresh'} type
 * @property {number} epoch
 * @property {'network' | 'claims' | 'ruin' | 'politics'} phaseId
 * @property {Record<string, Array<{ x: number, y: number }>>} [primaryClaim]
 * @property {string[]} [layers]
 */

/**
 * Mid-tick settlement/route layer refresh after founding (no animation).
 *
 * @typedef {Object} MapFxSettlementFoundedCue
 * @property {'settlement_founded'} type
 * @property {number} epoch
 * @property {'network'} phaseId
 * @property {string} settlementId
 * @property {number} x
 * @property {number} y
 * @property {string} [originSettlementId]
 */

/**
 * @typedef {MapFxControlOverlayRefreshCue | MapFxSettlementFoundedCue} MapFxCue
 */

/**
 * @param {MapFxCue} cue
 * @returns {cue is MapFxControlOverlayRefreshCue}
 */
export function isControlOverlayRefreshCue(cue) {
  return cue?.type === 'control_overlay_refresh'
}

/**
 * @param {{
 *   epoch: number,
 *   phaseId: MapFxControlOverlayRefreshCue['phaseId'],
 *   primaryClaim?: Record<string, Array<{ x: number, y: number }>>,
 *   layers?: string[],
 * }} params
 * @returns {MapFxControlOverlayRefreshCue}
 */
export function createControlOverlayRefreshCue(params) {
  return {
    type: 'control_overlay_refresh',
    epoch: params.epoch,
    phaseId: params.phaseId,
    primaryClaim: params.primaryClaim,
    layers: params.layers ?? [
      'factionTerritory',
      'settlementNodes',
      'recentConquestMarkers',
    ],
  }
}
