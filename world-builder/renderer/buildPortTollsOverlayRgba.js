/**
 * Port tolls inspect overlay — stained-glass primary-claim fill by last-epoch toll income.
 * Domain: world-builder/CONTEXT.md — port toll overlay.
 */

import { computeSettlementPortTollSignals } from '../core/economy/computeSettlementPortTollSignals.js'
import {
  buildPrimaryClaimMagnitudeOverlayCanvas,
  buildPrimaryClaimMagnitudeOverlayRgba,
} from './buildPrimaryClaimMagnitudeOverlayRgba.js'

/**
 * @param {Parameters<typeof computeSettlementPortTollSignals>[0] & {
 *   gridWidth?: number,
 *   gridHeight?: number,
 *   primaryClaim?: Record<string, Array<{ x: number, y: number }>>,
 * }} worldDocument
 * @returns {Uint8ClampedArray | null}
 */
export function buildPortTollsOverlayRgba(worldDocument) {
  const signals = computeSettlementPortTollSignals(worldDocument)
  return buildPrimaryClaimMagnitudeOverlayRgba(worldDocument, signals)
}

/**
 * @param {Parameters<typeof buildPortTollsOverlayRgba>[0]} worldDocument
 * @returns {HTMLCanvasElement | null}
 */
export function buildPortTollsOverlayCanvas(worldDocument) {
  const signals = computeSettlementPortTollSignals(worldDocument)
  return buildPrimaryClaimMagnitudeOverlayCanvas(worldDocument, signals)
}
