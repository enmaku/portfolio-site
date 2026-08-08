/**
 * Local commodity price signals for commodity price inspect overlays.
 * Neutral at catalog reference price (pre supply/demand); cheaper = red, dearer = green.
 * Domain: world-builder/CONTEXT.md — commodity price overlay, realm economy.
 */

import { referencePriceCp } from './commodityCatalog.js'
import { normalizeAroundAnchor } from './normalizeByRealmExtremes.js'

/**
 * @typedef {import('./commodityCatalog.js').CommodityId} CommodityId
 */

/**
 * @typedef {Object} SettlementMagnitudeSignal
 * @property {string} id
 * @property {number} valueCp
 * @property {number} normalized Relative to catalog reference in [-1, 1]
 */

/**
 * @param {{
 *   settlements?: Array<{ id: string, status?: string }>,
 *   lastTradeEpochResult?: {
 *     localPricesBySettlementId?: Record<string, Partial<Record<CommodityId, number>>>,
 *   } | null,
 * }} source
 * @param {CommodityId} commodityId
 * @returns {SettlementMagnitudeSignal[]}
 */
export function computeSettlementCommodityPriceSignals(source, commodityId) {
  const settlements = source?.settlements ?? []
  const pricesById = source?.lastTradeEpochResult?.localPricesBySettlementId ?? {}
  const referenceCp = referencePriceCp(commodityId)
  /** @type {Array<{ id: string, valueCp: number }>} */
  const drafts = []
  for (const settlement of settlements) {
    if (!settlement || settlement.status === 'ruin') continue
    if (typeof settlement.id !== 'string') continue
    const priceCp = pricesById[settlement.id]?.[commodityId]
    drafts.push({
      id: settlement.id,
      valueCp:
        typeof priceCp === 'number' && Number.isFinite(priceCp) ? priceCp : referenceCp,
    })
  }
  const normalized = normalizeAroundAnchor(
    drafts.map((d) => d.valueCp),
    referenceCp,
  )
  return drafts.map((draft, index) => ({
    id: draft.id,
    valueCp: draft.valueCp,
    normalized: normalized[index] ?? 0,
  }))
}
