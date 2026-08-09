/**
 * Author-facing presentation helpers for campaign kit PDF text.
 * Quantities and money are rounded to integers for skim/LLM readability.
 */

import {
  COMMODITY_IDS,
  CP_PER_GP,
  CP_PER_SP,
  commodityUnit,
} from '../economy/commodityCatalog.js'
import { formatMoneyCp } from '../economy/formatMoneyCp.js'

/** @typedef {import('../economy/commodityCatalog.js').CommodityId} CommodityId */

/** @type {Readonly<Record<CommodityId, string>>} */
export const CAMPAIGN_KIT_COMMODITY_LABELS = Object.freeze({
  grain: 'grain',
  fish: 'fish',
  salt: 'salt',
  timber: 'timber',
  baseMetals: 'base metals',
  copper: 'copper',
  silver: 'silver',
  gold: 'gold',
  diamonds: 'diamonds',
})

/**
 * @param {string} commodityId
 * @returns {string}
 */
export function campaignKitCommodityLabel(commodityId) {
  if (commodityId in CAMPAIGN_KIT_COMMODITY_LABELS) {
    return CAMPAIGN_KIT_COMMODITY_LABELS[/** @type {CommodityId} */ (commodityId)]
  }
  return String(commodityId)
}

/**
 * @param {unknown} value
 * @returns {number}
 */
export function campaignKitInteger(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }
  return Math.round(value)
}

/**
 * @param {number} amountCp
 * @returns {string}
 */
export function formatCampaignKitMoneyCp(amountCp) {
  const value = campaignKitInteger(amountCp)
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= CP_PER_GP) {
    return `${sign}${Math.round(abs / CP_PER_GP)} gp`
  }
  if (abs >= CP_PER_SP) {
    return `${sign}${Math.round(abs / CP_PER_SP)} sp`
  }
  return `${sign}${abs} cp`
}

/**
 * @param {number} amountCp
 * @param {CommodityId} commodityId
 * @returns {string}
 */
export function formatCampaignKitCommodityPriceCp(amountCp, commodityId) {
  return `${formatMoneyCp(amountCp)}/${commodityUnit(commodityId)}`
}

/**
 * @param {number} amount
 * @param {CommodityId} commodityId
 * @returns {{ amount: number, unit: string, display: string }}
 */
export function formatCampaignKitCommodityAmount(amount, commodityId) {
  const rounded = campaignKitInteger(amount)
  const unit = commodityUnit(commodityId)
  const unitLabel = unit === 'gem' ? (rounded === 1 ? 'gem' : 'gems') : unit
  return {
    amount: rounded,
    unit: unitLabel,
    display: `${rounded} ${unitLabel}`,
  }
}

/**
 * @param {string} kind
 * @returns {string}
 */
export function formatCampaignKitHistoryKind(kind) {
  return String(kind).replaceAll('_', ' ')
}

/**
 * Resource map legend rows for the arable/timber/metals/salt PDF page.
 * @returns {ReadonlyArray<{ key: string, swatch: string, label: string }>}
 */
export function campaignKitResourceMapLegend() {
  return Object.freeze([
    { key: 'arable', swatch: 'yellow crosshatching', label: 'arable' },
    { key: 'timber', swatch: 'neon green crosshatching', label: 'timber' },
    { key: 'metals', swatch: 'black crosshatching', label: 'metals potential' },
    { key: 'copper', swatch: 'brown dot', label: 'copper deposit' },
    { key: 'silver', swatch: 'gray dot', label: 'silver deposit' },
    { key: 'gold', swatch: 'yellow dot', label: 'gold deposit' },
    { key: 'diamond', swatch: 'light blue dot', label: 'diamond deposit' },
    { key: 'salt', swatch: 'white dot', label: 'salt' },
  ])
}

/**
 * @param {Partial<Record<CommodityId, number>> | null | undefined} production
 * @returns {Array<{ commodityId: CommodityId, label: string, amount: number, unit: string, display: string }>}
 */
export function presentCampaignKitProduction(production) {
  if (!production) {
    return []
  }
  /** @type {Array<{ commodityId: CommodityId, label: string, amount: number, unit: string, display: string }>} */
  const rows = []
  for (const commodityId of COMMODITY_IDS) {
    const raw = production[commodityId]
    if (!(typeof raw === 'number' && Number.isFinite(raw) && raw > 0)) {
      continue
    }
    const formatted = formatCampaignKitCommodityAmount(raw, commodityId)
    if (formatted.amount <= 0) {
      continue
    }
    rows.push({
      commodityId,
      label: campaignKitCommodityLabel(commodityId),
      ...formatted,
    })
  }
  return rows
}
