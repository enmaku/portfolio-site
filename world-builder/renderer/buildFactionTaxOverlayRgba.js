/**
 * Faction tax inspect overlay — stained-glass primary-claim fill by last-epoch net tax.
 * Domain: world-builder/CONTEXT.md — faction tax overlay.
 */

import { computeSettlementFactionTaxSignals } from '../core/economy/computeSettlementFactionTaxSignals.js'
import {
  buildPrimaryClaimMagnitudeOverlayCanvas,
  buildPrimaryClaimMagnitudeOverlayRgba,
} from './buildPrimaryClaimMagnitudeOverlayRgba.js'

/**
 * @param {Parameters<typeof computeSettlementFactionTaxSignals>[0] & {
 *   gridWidth?: number,
 *   gridHeight?: number,
 *   primaryClaim?: Record<string, Array<{ x: number, y: number }>>,
 * }} worldDocument
 * @returns {Uint8ClampedArray | null}
 */
export function buildFactionTaxOverlayRgba(worldDocument) {
  const signals = computeSettlementFactionTaxSignals(worldDocument)
  return buildPrimaryClaimMagnitudeOverlayRgba(worldDocument, signals)
}

/**
 * @param {Parameters<typeof buildFactionTaxOverlayRgba>[0]} worldDocument
 * @returns {HTMLCanvasElement | null}
 */
export function buildFactionTaxOverlayCanvas(worldDocument) {
  const signals = computeSettlementFactionTaxSignals(worldDocument)
  return buildPrimaryClaimMagnitudeOverlayCanvas(worldDocument, signals)
}
