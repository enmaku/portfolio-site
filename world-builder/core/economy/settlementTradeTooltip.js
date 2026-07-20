/**
 * Hover tooltip adapter over the neutral settlement economy inspect model.
 * Domain: world-builder/CONTEXT.md — settlement trade tooltip.
 */

export {
  PRICE_VS_REFERENCE_DEADZONE,
  comparePriceToReference,
  buildSettlementEconomyInspect as buildSettlementTradeTooltip,
} from './settlementEconomyInspect.js'

/**
 * @typedef {import('./settlementEconomyInspect.js').SettlementEconomyInspectCommodity} SettlementTradeTooltipCommodity
 * @typedef {import('./settlementEconomyInspect.js').SettlementEconomyInspect} SettlementTradeTooltip
 * @typedef {import('./settlementEconomyInspect.js').PriceVsReference} PriceVsReference
 */
