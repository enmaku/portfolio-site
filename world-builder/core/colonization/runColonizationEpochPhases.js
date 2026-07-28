import {
  runColonizationEpochClaimsPhase,
  runColonizationEpochCollapsePhase,
  runColonizationEpochNetworkPhase,
  runColonizationEpochPoliticsPhase,
  runColonizationEpochRuinPhase,
  runColonizationEpochSurvivalPhase,
  runColonizationEpochTradePhase,
} from './applyColonizationEpoch.js'

/**
 * @typedef {import('./applyColonizationEpoch.js').ColonizationEpochContext} ColonizationEpochContext
 */

/**
 * Canonical annual epoch tick:
 * network → claims → trade → survival → ruin → collapse → politics.
 * Network, trade, and collapse phases yield to the UI between substeps when
 * `options.network.yieldToUi` / `options.trade.yieldToUi` / `options.collapse.yieldToUi`
 * are provided.
 *
 * @param {ColonizationEpochContext} ctx
 * @param {{
 *   network?: import('./expeditions/expeditionScheduler.js').ExpeditionNetworkPhaseOptions,
 *   trade?: { hooks?: import('../economy/tradeClearing/runTradeClearing.js').TradeClearingHooks, yieldToUi?: () => Promise<void> },
 *   collapse?: { hooks?: import('./collapsePopulation.js').CollapsePopulationHooks, yieldToUi?: () => Promise<void> },
 *   warOutcomes?: Array<{ loserFactionId: string, winnerFactionId: string }>,
 * }} [options]
 * @returns {Promise<void>}
 */
export async function runColonizationEpochPhases(ctx, options = {}) {
  await runColonizationEpochNetworkPhase(ctx, options)
  runColonizationEpochClaimsPhase(ctx)
  await runColonizationEpochTradePhase(ctx, options)
  runColonizationEpochSurvivalPhase(ctx, options)
  runColonizationEpochRuinPhase(ctx)
  await runColonizationEpochCollapsePhase(ctx, options)
  runColonizationEpochPoliticsPhase(ctx, options)
}
