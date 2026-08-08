/**
 * Port-toll income signals for the port tolls inspect overlay.
 * Neutral at 0 cp (gray); positive income green; negative would be red.
 * Domain: world-builder/CONTEXT.md — port toll overlay, realm economy.
 */

import { normalizeAroundAnchor } from './normalizeByRealmExtremes.js'
import { portTollIncomeCpForSettlement } from './ledgers/portTollIncomeCpForSettlement.js'

/**
 * @typedef {Object} SettlementMagnitudeSignal
 * @property {string} id
 * @property {number} valueCp
 * @property {number} normalized Anchor-0 scale in [-1, 1]
 */

/**
 * @param {{
 *   settlements?: Array<{ id: string, x?: number, y?: number, maritimeRole?: string, status?: string }>,
 *   lastTradeEpochResult?: {
 *     portTollIncomeCpBySettlementId?: Record<string, number>,
 *   } | null,
 * }} source
 * @returns {SettlementMagnitudeSignal[]}
 */
export function computeSettlementPortTollSignals(source) {
  const settlements = source?.settlements ?? []
  const tradeResult = source?.lastTradeEpochResult ?? null
  /** @type {Array<{ id: string, valueCp: number }>} */
  const drafts = []
  for (const settlement of settlements) {
    if (!settlement || settlement.status === 'ruin') continue
    if (settlement.maritimeRole !== 'port') continue
    if (typeof settlement.id !== 'string') continue
    drafts.push({
      id: settlement.id,
      valueCp: portTollIncomeCpForSettlement(tradeResult, settlement.id),
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
