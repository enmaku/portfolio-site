/**
 * Format copper-piece amounts for author-facing chrome (gp / sp / cp).
 * Domain: world-builder/CONTEXT.md — gold-piece value.
 */

import { CP_PER_GP, CP_PER_SP } from './commodityCatalog.js'

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
 * @param {number} amountCp
 * @returns {string}
 */
export function formatMoneyCp(amountCp) {
  const value = Number.isFinite(amountCp) ? amountCp : 0
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= CP_PER_GP) {
    return `${sign}${formatGroupedAmount(abs / CP_PER_GP)} gp`
  }
  if (abs >= CP_PER_SP) {
    return `${sign}${formatGroupedAmount(abs / CP_PER_SP)} sp`
  }
  return `${sign}${formatGroupedAmount(abs)} cp`
}
