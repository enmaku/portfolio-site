/**
 * Settlement inspect tooltip view-model: combined display balance (realm + off-map),
 * last-epoch port toll income for port settlements, and per-commodity local price with
 * directional trade marks. Roles come only from the last clearing's realized flows,
 * never from local production alone, so a settlement that merely produces a commodity
 * is not shown as an exporter without movement.
 * Domain: world-builder/CONTEXT.md — settlement trade tooltip, local price, realm balance,
 * port toll.
 */

import { referencePriceCp } from './commodityCatalog.js'
import { presentMapCommodityIds } from './presentMapCommodities.js'
import { realizedPortTollIncomeCpBySettlementId } from './ledgers/realizedIncome.js'

/**
 * @typedef {import('./commodityCatalog.js').CommodityId} CommodityId
 * @typedef {import('./tradeClearing/runTradeClearing.js').CommodityTradeRole} CommodityTradeRole
 * @typedef {import('./tradeClearing/runTradeClearing.js').TradeClearingResult} TradeClearingResult
 */

/**
 * @typedef {'above' | 'below' | 'equal'} PriceVsReference
 */

/**
 * @typedef {Object} SettlementTradeTooltipCommodity
 * @property {CommodityId} commodityId
 * @property {number} localPriceCp
 * @property {PriceVsReference} priceVsReference
 * @property {CommodityTradeRole} role
 * @property {boolean} imports
 * @property {boolean} exports
 */

/**
 * @typedef {Object} SettlementTradeTooltip
 * @property {string} settlementId
 * @property {number} population Living headcount at this settlement.
 * @property {number} balanceCp Combined realm mutual-credit balance plus any external
 *   trade-account credit for display. Simulation ledgers stay separate.
 * @property {number | null} portTollsCp Last-epoch collected port tolls for port
 *   settlements (on-map + off-map); null for non-ports (row omitted).
 * @property {SettlementTradeTooltipCommodity[]} commodities Present-on-map catalog
 *   commodities in catalog order (absent geography sources omitted).
 */

/**
 * @param {CommodityTradeRole | undefined} role
 * @returns {CommodityTradeRole}
 */
function normalizeRole(role) {
  return role === 'import' || role === 'export' || role === 'both' ? role : 'neither'
}

/** Relative band around reference where local price stays display-neutral. */
export const PRICE_VS_REFERENCE_DEADZONE = 0.1

/**
 * @param {number} localPriceCp
 * @param {number} referenceCp
 * @returns {PriceVsReference}
 */
export function comparePriceToReference(localPriceCp, referenceCp) {
  if (!(referenceCp > 0) || !Number.isFinite(localPriceCp) || !Number.isFinite(referenceCp)) {
    return 'equal'
  }
  const ratio = localPriceCp / referenceCp
  if (ratio > 1 + PRICE_VS_REFERENCE_DEADZONE) {
    return 'above'
  }
  if (ratio < 1 - PRICE_VS_REFERENCE_DEADZONE) {
    return 'below'
  }
  return 'equal'
}

/**
 * @param {TradeClearingResult | null | undefined} result
 * @param {string} settlementId
 * @returns {number}
 */
function portTollsCpFromResult(result, settlementId) {
  const mapped = result?.portTollIncomeCpBySettlementId?.[settlementId]
  if (typeof mapped === 'number' && Number.isFinite(mapped)) {
    return Math.max(0, mapped)
  }
  // Older clears may lack the aggregated field; recover on-map tolls at least.
  const recovered = realizedPortTollIncomeCpBySettlementId(result?.obligationDeltas, null)
  const amount = recovered[settlementId]
  return typeof amount === 'number' && Number.isFinite(amount) ? Math.max(0, amount) : 0
}

/**
 * @param {{
 *   settlements?: Array<{ id: string, population?: number, maritimeRole?: string }>,
 *   lastTradeEpochResult?: TradeClearingResult | null,
 *   externalTradeAccounts?: Record<string, number>,
 *   saltNodes?: ReadonlyArray<unknown>,
 *   metalNodes?: ReadonlyArray<{ kind?: string }>,
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
  const roles = result?.settlementCommodityRoles?.[settlementId]
  const prices = result?.localPricesBySettlementId?.[settlementId]

  const commodities = presentMapCommodityIds(worldDocument).map((commodityId) => {
    const role = normalizeRole(roles?.[commodityId])
    const priceCp = prices?.[commodityId]
    const localPriceCp =
      typeof priceCp === 'number' && Number.isFinite(priceCp)
        ? priceCp
        : referencePriceCp(commodityId)
    const referenceCp = referencePriceCp(commodityId)
    return {
      commodityId,
      localPriceCp,
      priceVsReference: comparePriceToReference(localPriceCp, referenceCp),
      role,
      imports: role === 'import' || role === 'both',
      exports: role === 'export' || role === 'both',
    }
  })

  const realmBalanceCp = result?.realmBalancesCp?.[settlementId] ?? 0
  const externalRaw = worldDocument.externalTradeAccounts?.[settlementId]
  const externalCreditCp =
    typeof externalRaw === 'number' && Number.isFinite(externalRaw) ? externalRaw : 0
  const populationRaw = settlement.population
  const population =
    typeof populationRaw === 'number' && Number.isFinite(populationRaw)
      ? Math.max(0, Math.floor(populationRaw))
      : 0

  const isPort = settlement.maritimeRole === 'port'

  return {
    settlementId,
    population,
    balanceCp: realmBalanceCp + externalCreditCp,
    portTollsCp: isPort ? portTollsCpFromResult(result, settlementId) : null,
    commodities,
  }
}
