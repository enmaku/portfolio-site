/**
 * Settlement inspect tooltip view-model: realm balance, port off-map credit, and
 * per-commodity local price with directional trade marks. Roles come only from the
 * last clearing's realized flows, never from local production alone, so a settlement
 * that merely produces a commodity is not shown as an exporter without movement.
 * Domain: world-builder/CONTEXT.md — settlement trade tooltip, local price, realm balance.
 */

import { COMMODITY_IDS, referencePriceCp } from './commodityCatalog.js'

/**
 * @typedef {import('./commodityCatalog.js').CommodityId} CommodityId
 * @typedef {import('./tradeClearing/runTradeClearing.js').CommodityTradeRole} CommodityTradeRole
 * @typedef {import('./tradeClearing/runTradeClearing.js').TradeClearingResult} TradeClearingResult
 */

/**
 * @typedef {Object} SettlementTradeTooltipCommodity
 * @property {CommodityId} commodityId
 * @property {number} localPriceCp
 * @property {CommodityTradeRole} role
 * @property {boolean} imports
 * @property {boolean} exports
 */

/**
 * @typedef {Object} SettlementTradeTooltip
 * @property {string} settlementId
 * @property {number} realmBalanceCp
 * @property {boolean} isPort
 * @property {number | null} portOffMapCreditCp Off-map credit for ports; null for inland.
 * @property {SettlementTradeTooltipCommodity[]} commodities Every catalog commodity, in catalog order.
 */

/**
 * @param {CommodityTradeRole | undefined} role
 * @returns {CommodityTradeRole}
 */
function normalizeRole(role) {
  return role === 'import' || role === 'export' || role === 'both' ? role : 'neither'
}

/**
 * @param {{
 *   settlements?: Array<{ id: string, maritimeRole?: string }>,
 *   lastTradeEpochResult?: TradeClearingResult | null,
 *   externalTradeAccounts?: Record<string, number>,
 * }} worldDocument
 * @param {string} settlementId
 * @returns {SettlementTradeTooltip | null}
 */
export function buildSettlementTradeTooltip(worldDocument, settlementId) {
  const settlement = (worldDocument?.settlements ?? []).find((s) => s?.id === settlementId)
  if (!settlement) {
    return null
  }

  const result = worldDocument.lastTradeEpochResult ?? null
  const isPort = settlement.maritimeRole === 'port'
  const roles = result?.settlementCommodityRoles?.[settlementId]
  const prices = result?.localPricesBySettlementId?.[settlementId]

  const commodities = COMMODITY_IDS.map((commodityId) => {
    const role = normalizeRole(roles?.[commodityId])
    const priceCp = prices?.[commodityId]
    return {
      commodityId,
      localPriceCp:
        typeof priceCp === 'number' && Number.isFinite(priceCp)
          ? priceCp
          : referencePriceCp(commodityId),
      role,
      imports: role === 'import' || role === 'both',
      exports: role === 'export' || role === 'both',
    }
  })

  const externalCredit = worldDocument.externalTradeAccounts?.[settlementId]

  return {
    settlementId,
    realmBalanceCp: result?.realmBalancesCp?.[settlementId] ?? 0,
    isPort,
    portOffMapCreditCp: isPort
      ? typeof externalCredit === 'number' && Number.isFinite(externalCredit)
        ? externalCredit
        : 0
      : null,
    commodities,
  }
}
