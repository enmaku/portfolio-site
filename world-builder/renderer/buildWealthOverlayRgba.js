/**
 * Wealth inspect overlay: paints each living settlement's primary-claim hinterland by the
 * same combined balance as the settlement trade tooltip (realm balance plus port off-map
 * credit). Tint uses an HSB mix-in-black ramp (bright lime/scarlet → deep hunter/deep red)
 * with a high stained-glass alpha floor. Magnitude scales with that balance, rescaled so
 * the living extreme on the map hits full tint.
 * Paint is masked to dry land (not ocean, lake, or river).
 * Domain: world-builder/CONTEXT.md — wealth overlay, realm balance.
 */

import { computeSettlementWealthSignals } from '../core/economy/computeSettlementWealthSignals.js'
import {
  buildPrimaryClaimMagnitudeOverlayCanvas,
  buildPrimaryClaimMagnitudeOverlayRgba,
  WEALTH_CLAIM_OUTLINE_RGBA,
  WEALTH_DEFICIT_HUE,
  WEALTH_DEFICIT_RGB,
  WEALTH_NEUTRAL_RGB,
  WEALTH_OVERLAY_MAX_ALPHA,
  WEALTH_OVERLAY_MIN_ALPHA,
  WEALTH_SAT_MAX,
  WEALTH_SAT_MIN,
  WEALTH_SURPLUS_HUE,
  WEALTH_SURPLUS_RGB,
  WEALTH_VALUE_MAX,
  WEALTH_VALUE_MIN,
  wealthTintRgb,
} from './buildPrimaryClaimMagnitudeOverlayRgba.js'

export {
  WEALTH_CLAIM_OUTLINE_RGBA,
  WEALTH_DEFICIT_HUE,
  WEALTH_DEFICIT_RGB,
  WEALTH_NEUTRAL_RGB,
  WEALTH_OVERLAY_MAX_ALPHA,
  WEALTH_OVERLAY_MIN_ALPHA,
  WEALTH_SAT_MAX,
  WEALTH_SAT_MIN,
  WEALTH_SURPLUS_HUE,
  WEALTH_SURPLUS_RGB,
  WEALTH_VALUE_MAX,
  WEALTH_VALUE_MIN,
  wealthTintRgb,
}

/**
 * @param {{
 *   gridWidth: number,
 *   gridHeight: number,
 *   settlements?: Array<{ id: string, x?: number, y?: number, status?: string }>,
 *   primaryClaim?: Record<string, Array<{ x: number, y: number }>>,
 *   fields?: { elevation?: Float32Array },
 *   lakeMask?: Uint8Array,
 *   riverCorridorMask?: Uint8Array,
 *   lastTradeEpochResult?: import('../core/economy/economyEpochSnapshot.js').EconomyEpochSnapshot | null,
 *   tradeAccounts?: import('../core/economy/ledgers/bilateralObligations.js').TradeAccountsState,
 *   balancesBySettlementId?: Record<string, number>,
 *   externalTradeAccounts?: Record<string, number>,
 * }} worldDocument
 * @returns {Uint8ClampedArray | null}
 */
export function buildWealthOverlayRgba(worldDocument) {
  const signals = computeSettlementWealthSignals(worldDocument)
  return buildPrimaryClaimMagnitudeOverlayRgba(worldDocument, signals)
}

/**
 * @param {Parameters<typeof buildWealthOverlayRgba>[0]} worldDocument
 * @returns {HTMLCanvasElement | null}
 */
export function buildWealthOverlayCanvas(worldDocument) {
  const signals = computeSettlementWealthSignals(worldDocument)
  return buildPrimaryClaimMagnitudeOverlayCanvas(worldDocument, signals)
}
