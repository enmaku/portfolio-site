/**
 * Faction-tax net signals for the faction tax inspect overlay.
 * Neutral at 0 cp (gray); net receipts green; net payments red.
 * Domain: world-builder/CONTEXT.md — faction tax overlay, realm economy.
 */

import { normalizeAroundAnchor } from './normalizeByRealmExtremes.js'

/**
 * @typedef {Object} SettlementMagnitudeSignal
 * @property {string} id
 * @property {number} valueCp
 * @property {number} normalized Anchor-0 scale in [-1, 1]
 */

/**
 * @param {{
 *   settlements?: Array<{ id: string, status?: string }>,
 *   lastTradeEpochResult?: {
 *     factionTaxNetCpBySettlementId?: Record<string, number>,
 *   } | null,
 * }} source
 * @returns {SettlementMagnitudeSignal[]}
 */
export function computeSettlementFactionTaxSignals(source) {
  const settlements = source?.settlements ?? []
  const taxMap = source?.lastTradeEpochResult?.factionTaxNetCpBySettlementId ?? {}
  /** @type {Array<{ id: string, valueCp: number }>} */
  const drafts = []
  for (const settlement of settlements) {
    if (!settlement || settlement.status === 'ruin') continue
    if (typeof settlement.id !== 'string') continue
    const raw = taxMap[settlement.id]
    drafts.push({
      id: settlement.id,
      valueCp: typeof raw === 'number' && Number.isFinite(raw) ? raw : 0,
    })
  }
  const normalized = normalizeAroundAnchor(
    drafts.map((d) => d.valueCp),
    0,
  )
  return drafts.map((draft, index) => ({
    id: draft.id,
    valueCp: draft.valueCp,
    normalized: normalized[index] ?? 0,
  }))
}
