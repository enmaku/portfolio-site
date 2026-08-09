/**
 * Format copper-piece amounts for author-facing chrome (gp / sp / cp).
 * Domain: world-builder/CONTEXT.md — gold-piece value, reference price, commodity catalog.
 */

import { CP_PER_GP, CP_PER_SP, commodityUnit } from './commodityCatalog.js'

/**
 * Nearest whole copper piece. Ledger balances and bilateral obligations use this unit;
 * unit prices may still be fractional cp per lb/gem.
 *
 * @param {unknown} amountCp
 * @returns {number}
 */
export function roundMoneyCp(amountCp) {
  if (typeof amountCp !== 'number' || !Number.isFinite(amountCp)) return 0
  const rounded = Math.round(amountCp)
  return rounded === 0 ? 0 : rounded
}

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
  const formatAmount = options.compact === true ? formatAbbreviatedAmount : formatGroupedAmount
  const amountText = formatAmount(abs)
  // Avoid "-0 cp" when float dust rounds away in the formatted magnitude.
  const sign = value < 0 && amountText !== '0' ? '-' : ''
  if (abs >= CP_PER_GP) {
    return `${sign}${formatAmount(abs / CP_PER_GP)} gp`
  }
  if (abs >= CP_PER_SP) {
    return `${sign}${formatAmount(abs / CP_PER_SP)} sp`
  }
  return `${sign}${amountText} cp`
}

/**
 * Local / reference unit price for a catalog commodity (e.g. `5 cp/lb`, `5k gp/gem`).
 *
 * @param {number} amountCp Price in copper pieces per catalog unit (lb or gem).
 * @param {import('./commodityCatalog.js').CommodityId} commodityId
 * @param {{ compact?: boolean }} [options]
 * @returns {string}
 */
export function formatCommodityPriceCp(amountCp, commodityId, options = {}) {
  return `${formatMoneyCp(amountCp, options)}/${commodityUnit(commodityId)}`
}
