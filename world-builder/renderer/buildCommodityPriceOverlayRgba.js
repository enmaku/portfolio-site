/**
 * Commodity local-price inspect overlay — stained-glass primary-claim fill by realm extremes.
 * Domain: world-builder/CONTEXT.md — commodity price overlay.
 */

import { computeSettlementCommodityPriceSignals } from '../core/economy/computeSettlementCommodityPriceSignals.js'
import {
  buildPrimaryClaimMagnitudeOverlayCanvas,
  buildPrimaryClaimMagnitudeOverlayRgba,
} from './buildPrimaryClaimMagnitudeOverlayRgba.js'

/**
 * @typedef {import('../core/economy/commodityCatalog.js').CommodityId} CommodityId
 */

/**
 * @param {{
 *   gridWidth?: number,
 *   gridHeight?: number,
 *   settlements?: Array<{ id: string, status?: string }>,
 *   primaryClaim?: Record<string, Array<{ x: number, y: number }>>,
 *   lastTradeEpochResult?: {
 *     localPricesBySettlementId?: Record<string, Partial<Record<CommodityId, number>>>,
 *   } | null,
 * }} worldDocument
 * @param {CommodityId} commodityId
 * @returns {Uint8ClampedArray | null}
 */
export function buildCommodityPriceOverlayRgba(worldDocument, commodityId) {
  const signals = computeSettlementCommodityPriceSignals(worldDocument, commodityId)
  return buildPrimaryClaimMagnitudeOverlayRgba(worldDocument, signals)
}

/**
 * @param {Parameters<typeof buildCommodityPriceOverlayRgba>[0]} worldDocument
 * @param {CommodityId} commodityId
 * @returns {HTMLCanvasElement | null}
 */
export function buildCommodityPriceOverlayCanvas(worldDocument, commodityId) {
  const signals = computeSettlementCommodityPriceSignals(worldDocument, commodityId)
  return buildPrimaryClaimMagnitudeOverlayCanvas(worldDocument, signals)
}
