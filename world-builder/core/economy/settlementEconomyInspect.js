/**
 * Neutral settlement economy inspect model (balance, tolls, commodity prices/roles).
 * Domain: world-builder/CONTEXT.md — settlement trade tooltip, local price, realm balance,
 * port toll.
 */

import { referencePriceCp } from './commodityCatalog.js'
import { presentMapCommodityIds } from './presentMapCommodities.js'
import {
  balancesFromEconomyInspectSource,
} from './computeSettlementWealthSignals.js'
import { combinedSettlementWealthCp } from './ledgers/combinedSettlementWealthCp.js'
import { portTollIncomeCpForSettlement } from './ledgers/portTollIncomeCpForSettlement.js'

/**
 * @typedef {import('./commodityCatalog.js').CommodityId} CommodityId
 * @typedef {import('./tradeClearing/clearingState.js').CommodityTradeRole} CommodityTradeRole
 * @typedef {import('./economyEpochSnapshot.js').EconomyEpochSnapshot} EconomyEpochSnapshot
 * @typedef {import('./computeSettlementWealthSignals.js').EconomyInspectSource} EconomyInspectSource
 */

/**
 * @typedef {'above' | 'below' | 'equal'} PriceVsReference
 */

/**
 * @typedef {Object} SettlementEconomyInspectCommodity
 * @property {CommodityId} commodityId
 * @property {number} localPriceCp
 * @property {PriceVsReference} priceVsReference
 * @property {CommodityTradeRole} role
 * @property {boolean} imports
 * @property {boolean} exports
 */

/**
 * @typedef {Object} SettlementEconomyInspect
 * @property {string} settlementId
 * @property {number} population
 * @property {number} balanceCp Combined realm + nonnegative external claim.
 * @property {number | null} portTollsCp
 * @property {SettlementEconomyInspectCommodity[]} commodities
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
 * @param {EconomyInspectSource & {
 *   saltNodes?: ReadonlyArray<unknown>,
 *   metalNodes?: ReadonlyArray<{ kind?: string }>,
 * }} economyInspectSource
 * @param {string} settlementId
 * @returns {SettlementEconomyInspect | null}
 */
export function buildSettlementEconomyInspect(economyInspectSource, settlementId) {
  const settlement = (economyInspectSource?.settlements ?? []).find((s) => s?.id === settlementId)
  if (!settlement) {
    return null
  }

  const result = economyInspectSource.lastTradeEpochResult ?? null
  const roles = result?.settlementCommodityRoles?.[settlementId]
  const prices = result?.localPricesBySettlementId?.[settlementId]

  const commodities = presentMapCommodityIds(economyInspectSource).map((commodityId) => {
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

  const populationRaw = settlement.population
  const population =
    typeof populationRaw === 'number' && Number.isFinite(populationRaw)
      ? Math.max(0, Math.floor(populationRaw))
      : 0

  const isPort = settlement.maritimeRole === 'port'
  const balancesBySettlementId = balancesFromEconomyInspectSource(economyInspectSource)

  return {
    settlementId,
    population,
    balanceCp: combinedSettlementWealthCp({
      settlementId,
      balancesBySettlementId,
      externalTradeAccounts: economyInspectSource.externalTradeAccounts,
    }),
    portTollsCp: isPort ? portTollIncomeCpForSettlement(result, settlementId) : null,
    commodities,
  }
}
