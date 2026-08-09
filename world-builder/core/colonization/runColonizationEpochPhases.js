import {
  runColonizationEpochClaimsPhase,
  runColonizationEpochCollapsePhase,
  runColonizationEpochNetworkPhase,
  runColonizationEpochPoliticsPhase,
  runColonizationEpochRuinPhase,
  runColonizationEpochSurvivalPhase,
  runColonizationEpochTaxPhase,
  runColonizationEpochTradePhase,
} from './applyColonizationEpoch.js'

/**
 * @typedef {import('./applyColonizationEpoch.js').ColonizationEpochContext} ColonizationEpochContext
 */

/**
 * Canonical annual epoch tick:
 * network → claims → trade → tax → survival → ruin → collapse → politics.
 * Network, trade, collapse, and politics phases yield to the UI between substeps when
 * `options.network.yieldToUi` / `options.trade.yieldToUi` / `options.collapse.yieldToUi` /
 * `options.politics.yieldToUi` are provided.
 *
 * @param {ColonizationEpochContext} ctx
 * @param {{
 *   network?: import('./expeditions/expeditionScheduler.js').ExpeditionNetworkPhaseOptions,
 *   trade?: { hooks?: import('../economy/tradeClearing/runTradeClearing.js').TradeClearingHooks, yieldToUi?: () => Promise<void> },
 *   collapse?: { hooks?: import('./collapsePopulation.js').CollapsePopulationHooks, yieldToUi?: () => Promise<void> },
 *   politics?: { hooks?: import('./politics/applyPoliticsPhase.js').PoliticsPhaseHooks, yieldToUi?: () => Promise<void> },
 *   warOutcomes?: Array<{ loserFactionId: string, winnerFactionId: string }>,
 * }} [options]
 * @returns {Promise<void>}
 */
export async function runColonizationEpochPhases(ctx, options = {}) {
  await runColonizationEpochNetworkPhase(ctx, options)
  runColonizationEpochClaimsPhase(ctx)
  await runColonizationEpochTradePhase(ctx, options)
  runColonizationEpochTaxPhase(ctx, options)
  runColonizationEpochSurvivalPhase(ctx, options)
  runColonizationEpochRuinPhase(ctx)
  await runColonizationEpochCollapsePhase(ctx, options)
  await runColonizationEpochPoliticsPhase(ctx, options)
}
