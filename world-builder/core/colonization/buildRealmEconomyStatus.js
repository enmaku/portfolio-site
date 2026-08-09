/**
 * Realm economy extremes board view-model for running chrome.
 * Domain: world-builder/CONTEXT.md — realm economy.
 */

import { referencePriceCp } from '../economy/commodityCatalog.js'
import { combinedSettlementWealthCp } from '../economy/ledgers/combinedSettlementWealthCp.js'
import { portTollIncomeCpForSettlement } from '../economy/ledgers/portTollIncomeCpForSettlement.js'
import { presentMapCommodityIds } from '../economy/presentMapCommodities.js'
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
 * @property {SettlementValueExtreme | null} highestTolls
 * @property {SettlementValueExtreme | null} lowestTolls
 * @property {SettlementValueExtreme | null} highestFactionTax
 * @property {SettlementValueExtreme | null} lowestFactionTax
 */

/**
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {{
 *   saltNodes?: ReadonlyArray<unknown>,
 *   metalNodes?: ReadonlyArray<{ kind?: string }>,
 * } | null | undefined} [worldDocument]
 * @returns {RealmEconomyStatus}
 */
export function buildRealmEconomyStatus(slice, worldDocument) {
  const living = livingSettlements(slice.settlements ?? [])
  const tradeResult = slice.lastTradeEpochResult ?? null
  const pricesById = tradeResult?.localPricesBySettlementId ?? {}
  const externalAccounts = slice.externalTradeAccounts ?? {}

  /** @type {CommodityPriceExtremes[]} */
  const commodities = presentMapCommodityIds(worldDocument).map((commodityId) => {
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

  const wealthEntries = living.map((settlement) => ({
    id: settlement.id,
    valueCp: combinedSettlementWealthCp({
      settlementId: settlement.id,
      balancesBySettlementId: slice.tradeAccounts?.balancesBySettlementId,
      externalTradeAccounts: externalAccounts,
    }),
  }))
  const wealthExtremes = pickSettlementExtremes(wealthEntries, (entry) => entry.valueCp)

  const livingPorts = living.filter((settlement) => settlement.maritimeRole === 'port')
  const tollEntries = livingPorts.map((settlement) => ({
    id: settlement.id,
    valueCp: portTollIncomeCpForSettlement(tradeResult, settlement.id),
  }))
  const tollExtremes = pickSettlementExtremes(tollEntries, (entry) => entry.valueCp)

  const taxMap = tradeResult?.factionTaxNetCpBySettlementId ?? {}
  const taxEntries = living.map((settlement) => {
    const raw = taxMap[settlement.id]
    return {
      id: settlement.id,
      valueCp: typeof raw === 'number' && Number.isFinite(raw) ? raw : 0,
    }
  })
  const taxExtremes = pickSettlementExtremes(taxEntries, (entry) => entry.valueCp)

  return {
    commodities,
    wealthiest: wealthExtremes
      ? { settlementId: wealthExtremes.high.id, valueCp: wealthExtremes.high.valueCp }
      : null,
    poorest: wealthExtremes
      ? { settlementId: wealthExtremes.low.id, valueCp: wealthExtremes.low.valueCp }
      : null,
    highestTolls: tollExtremes
      ? { settlementId: tollExtremes.high.id, valueCp: tollExtremes.high.valueCp }
      : null,
    lowestTolls: tollExtremes
      ? { settlementId: tollExtremes.low.id, valueCp: tollExtremes.low.valueCp }
      : null,
    highestFactionTax: taxExtremes
      ? { settlementId: taxExtremes.high.id, valueCp: taxExtremes.high.valueCp }
      : null,
    lowestFactionTax: taxExtremes
      ? { settlementId: taxExtremes.low.id, valueCp: taxExtremes.low.valueCp }
      : null,
  }
}
