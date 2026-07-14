import {
  runColonizationEpochClaimsPhase,
  runColonizationEpochCollapsePhase,
  runColonizationEpochNetworkPhase,
  runColonizationEpochRuinPhase,
  runColonizationEpochSurvivalPhase,
} from './applyColonizationEpoch.js'

/**
 * @typedef {import('./applyColonizationEpoch.js').ColonizationEpochContext} ColonizationEpochContext
 */

/**
 * Canonical annual epoch tick: network → claims → survival → ruin → collapse.
 * Network and collapse phases yield to the UI between substeps when
 * `options.network.yieldToUi` / `options.collapse.yieldToUi` are provided.
 *
 * @param {ColonizationEpochContext} ctx
 * @param {{
 *   saltSpoilageMultiplierForSettlement?: Function,
 *   network?: import('./expeditions/expeditionScheduler.js').ExpeditionNetworkPhaseOptions,
 *   collapse?: { hooks?: import('./collapsePopulation.js').CollapsePopulationHooks, yieldToUi?: () => Promise<void> },
 * }} [options]
 * @returns {Promise<void>}
 */
export async function runColonizationEpochPhases(ctx, options = {}) {
  await runColonizationEpochNetworkPhase(ctx, options)
  runColonizationEpochClaimsPhase(ctx)
  runColonizationEpochSurvivalPhase(ctx, options)
  runColonizationEpochRuinPhase(ctx)
  await runColonizationEpochCollapsePhase(ctx, options)
}
