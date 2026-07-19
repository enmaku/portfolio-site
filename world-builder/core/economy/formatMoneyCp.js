/**
 * Format copper-piece amounts for author-facing chrome (gp / sp / cp).
 * Domain: world-builder/CONTEXT.md — gold-piece value, reference price, commodity catalog.
 */

import { CP_PER_GP, CP_PER_SP, commodityUnit } from './commodityCatalog.js'

/**
 * @param {number} value
 * @returns {string}
 */
function trimTrailingZeros(value) {
  return value
    .toFixed(2)
    .replace(/\.?0+$/, '')
}

/**
 * @param {number} value
 * @returns {string}
 */
function formatGroupedAmount(value) {
  const trimmed = trimTrailingZeros(value)
  const dot = trimmed.indexOf('.')
  const intPart = dot === -1 ? trimmed : trimmed.slice(0, dot)
  const fracPart = dot === -1 ? null : trimmed.slice(dot + 1)
  const grouped = Number(intPart).toLocaleString('en-US')
  return fracPart != null ? `${grouped}.${fracPart}` : grouped
}

/**
 * @param {number} value Absolute magnitude in the display unit (gp / sp / cp).
 * @returns {string}
 */
function formatAbbreviatedAmount(value) {
  if (value >= 1_000_000) {
    return `${trimTrailingZeros(value / 1_000_000)}M`
  }
  if (value >= 1_000) {
    return `${trimTrailingZeros(value / 1_000)}k`
  }
  return formatGroupedAmount(value)
}

/**
 * @param {number} amountCp
 * @param {{ compact?: boolean }} [options]
 * @returns {string}
 */
export function formatMoneyCp(amountCp, options = {}) {
  const value = Number.isFinite(amountCp) ? amountCp : 0
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  const formatAmount = options.compact === true ? formatAbbreviatedAmount : formatGroupedAmount
  if (abs >= CP_PER_GP) {
    return `${sign}${formatAmount(abs / CP_PER_GP)} gp`
  }
  if (abs >= CP_PER_SP) {
    return `${sign}${formatAmount(abs / CP_PER_SP)} sp`
  }
  return `${sign}${formatAmount(abs)} cp`
}

/**
 * Local / reference unit price for a catalog commodity (e.g. `5 cp/lb`, `5k gp/gem`).
 * Timber is shown per 10 lb to match the catalog reference quote.
 *
 * @param {number} amountCp Price in copper pieces per catalog unit (lb or gem).
 * @param {import('./commodityCatalog.js').CommodityId} commodityId
 * @param {{ compact?: boolean }} [options]
 * @returns {string}
 */
export function formatCommodityPriceCp(amountCp, commodityId, options = {}) {
  if (commodityId === 'timber') {
    return `${formatMoneyCp(amountCp * 10, options)}/10 lb`
  }
  return `${formatMoneyCp(amountCp, options)}/${commodityUnit(commodityId)}`
}
