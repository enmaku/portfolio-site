/**
 * Trade-aware founding viability: freshwater is the hard local survival gate; food
 * and salt may be covered by local production or by exportable surplus (after survival
 * reservation) buying the shortfall over the founding connection after transport and
 * tolls, valued at parent local prices.
 * Domain: world-builder/CONTEXT.md — founding viability, survival triad, exportable
 * surplus, local price, transport cost, port toll.
 */

import { cargoLbPerUnit } from '../commodityCatalog.js'
import {
  exportableSurplusValueCp,
  survivalFoodDemandLb,
  survivalSaltDemandLb,
} from '../tradeClearing/allocationTiers.js'
import { PORT_TOLL_RATE } from '../tradeClearing/tradeConstants.js'

/** @typedef {import('../commodityCatalog.js').CommodityId} CommodityId */

const EPSILON = 1e-6

/**
 * @typedef {Object} FoundingLink
 * @property {number} transportCostCpPerLb Base transport cost of the parent↔candidate link.
 * @property {number} [capacityLb] Shared cargo capacity of the link (defaults to unbounded).
 * @property {boolean} [importToll] Whether a port toll applies to goods crossing the link.
 */

/**
 * @typedef {Object} TradeAwareFoundingResult
 * @property {boolean} viable
 * @property {boolean} hasFreshwater
 * @property {'freshwater' | 'local' | 'import' | 'no-link' | 'unprofitable' | 'insufficient'} reason
 * @property {number} foodShortfallLb
 * @property {number} saltShortfallLb
 * @property {number} exportableSurplusCp
 * @property {number} importCostCp
 */

/**
 * @param {{
 *   production?: Partial<Record<CommodityId, number>>,
 *   population: number,
 *   hasFreshwater: boolean,
 *   parentLocalPrices?: Partial<Record<CommodityId, number>>,
 *   foundingLink?: FoundingLink | null,
 * }} params
 * @returns {TradeAwareFoundingResult}
 */
export function evaluateTradeAwareFounding(params) {
  const {
    production = {},
    population,
    hasFreshwater,
    parentLocalPrices = {},
    foundingLink = null,
  } = params

  if (!hasFreshwater) {
    return {
      viable: false,
      hasFreshwater: false,
      reason: 'freshwater',
      foodShortfallLb: 0,
      saltShortfallLb: 0,
      exportableSurplusCp: 0,
      importCostCp: 0,
    }
  }

  const localFoodLb = Math.max(0, production.grain ?? 0) + Math.max(0, production.fish ?? 0)
  const localSaltLb = Math.max(0, production.salt ?? 0)
  const foodShortfallLb = Math.max(0, survivalFoodDemandLb(population) - localFoodLb)
  const saltShortfallLb = Math.max(0, survivalSaltDemandLb(population) - localSaltLb)

  /** @type {TradeAwareFoundingResult} */
  const base = {
    viable: true,
    hasFreshwater: true,
    reason: 'local',
    foodShortfallLb,
    saltShortfallLb,
    exportableSurplusCp: 0,
    importCostCp: 0,
  }

  // Food is the survival substance; local food self-sufficiency alone founds the site.
  // Salt only scales preservation (never a hard gate) but is funded alongside food imports.
  if (foodShortfallLb <= EPSILON) {
    return base
  }

  if (!foundingLink) {
    return { ...base, viable: false, reason: 'no-link' }
  }

  const exportableSurplusCp = exportableSurplusValueCp({
    population,
    production,
    prices: parentLocalPrices,
  })

  const grainUnitCostCp = importUnitCostCp('grain', parentLocalPrices, foundingLink)
  if (grainUnitCostCp == null) {
    return { ...base, viable: false, reason: 'unprofitable', exportableSurplusCp }
  }

  const saltUnitCostCp = saltShortfallLb > EPSILON ? importUnitCostCp('salt', parentLocalPrices, foundingLink) : null
  const includeSalt = saltUnitCostCp != null
  const importedSaltLb = includeSalt ? saltShortfallLb : 0
  const importCostCp =
    foodShortfallLb * grainUnitCostCp + importedSaltLb * (saltUnitCostCp ?? 0)
  const importedLb = foodShortfallLb + importedSaltLb
  const capacityLb = Number.isFinite(foundingLink.capacityLb)
    ? /** @type {number} */ (foundingLink.capacityLb)
    : Number.POSITIVE_INFINITY
  const capacityOk = importedLb <= capacityLb + EPSILON
  const viable = capacityOk && exportableSurplusCp + EPSILON >= importCostCp

  return {
    ...base,
    viable,
    reason: viable ? 'import' : 'insufficient',
    exportableSurplusCp,
    importCostCp,
  }
}

/**
 * Per-unit draw against the candidate's credit to import one commodity over the link:
 * `(parent local price − transport) + toll`, mirroring on-map clearing. Returns null
 * when transport exceeds the goods value, i.e. no profitable import exists.
 *
 * @param {CommodityId} commodityId
 * @param {Partial<Record<CommodityId, number>>} prices
 * @param {FoundingLink} link
 * @returns {number | null}
 */
function importUnitCostCp(commodityId, prices, link) {
  const price = prices[commodityId] ?? 0
  const transportUnitCp = Math.max(0, link.transportCostCpPerLb ?? 0) * cargoLbPerUnit(commodityId)
  const netUnitValueCp = price - transportUnitCp
  if (!(netUnitValueCp > 0)) {
    return null
  }
  const tollUnitCp = link.importToll ? PORT_TOLL_RATE * price : 0
  return netUnitValueCp + tollUnitCp
}
