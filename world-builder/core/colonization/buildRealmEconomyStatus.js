/**
 * Realm economy extremes board view-model for running chrome.
 * Domain: world-builder/CONTEXT.md — realm economy.
 */

import { COMMODITY_IDS, referencePriceCp } from '../economy/commodityCatalog.js'
import { livingSettlements } from './expeditions/expeditionConstants.js'
import { pickSettlementExtremes } from './pickSettlementExtreme.js'

/**
 * @typedef {import('../economy/commodityCatalog.js').CommodityId} CommodityId
 */

/**
 * @typedef {Object} SettlementValueExtreme
 * @property {string} settlementId
 * @property {number} valueCp
 */

/**
 * @typedef {Object} CommodityPriceExtremes
 * @property {CommodityId} commodityId
 * @property {SettlementValueExtreme | null} highest
 * @property {SettlementValueExtreme | null} lowest
 */

/**
 * @typedef {Object} RealmEconomyStatus
 * @property {CommodityPriceExtremes[]} commodities
 * @property {SettlementValueExtreme | null} wealthiest
 * @property {SettlementValueExtreme | null} poorest
 */

/**
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @returns {RealmEconomyStatus}
 */
export function buildRealmEconomyStatus(slice) {
  const living = livingSettlements(slice.settlements ?? [])
  const tradeResult = slice.lastTradeEpochResult ?? null
  const pricesById = tradeResult?.localPricesBySettlementId ?? {}
  const realmBalances =
    tradeResult?.realmBalancesCp ?? slice.tradeAccounts?.balancesBySettlementId ?? {}
  const externalAccounts = slice.externalTradeAccounts ?? {}

  /** @type {CommodityPriceExtremes[]} */
  const commodities = COMMODITY_IDS.map((commodityId) => {
    const priced = living.map((settlement) => {
      const priceCp = pricesById[settlement.id]?.[commodityId]
      return {
        id: settlement.id,
        valueCp:
          typeof priceCp === 'number' && Number.isFinite(priceCp)
            ? priceCp
            : referencePriceCp(commodityId),
      }
    })
    const extremes = pickSettlementExtremes(priced, (entry) => entry.valueCp)
    return {
      commodityId,
      highest: extremes
        ? { settlementId: extremes.high.id, valueCp: extremes.high.valueCp }
        : null,
      lowest: extremes
        ? { settlementId: extremes.low.id, valueCp: extremes.low.valueCp }
        : null,
    }
  })

  const wealthEntries = living.map((settlement) => {
    const realmCp = Number(realmBalances[settlement.id]) || 0
    const externalCp = Math.max(0, Number(externalAccounts[settlement.id]) || 0)
    return {
      id: settlement.id,
      valueCp: realmCp + externalCp,
    }
  })
  const wealthExtremes = pickSettlementExtremes(wealthEntries, (entry) => entry.valueCp)

  return {
    commodities,
    wealthiest: wealthExtremes
      ? { settlementId: wealthExtremes.high.id, valueCp: wealthExtremes.high.valueCp }
      : null,
    poorest: wealthExtremes
      ? { settlementId: wealthExtremes.low.id, valueCp: wealthExtremes.low.valueCp }
      : null,
  }
}
