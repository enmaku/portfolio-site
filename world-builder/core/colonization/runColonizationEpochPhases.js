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
 * Canonical synchronous annual epoch tick: network → claims → survival → ruin → collapse.
 *
 * @param {ColonizationEpochContext} ctx
 * @param {{ saltSpoilageMultiplierForSettlement?: Function, network?: import('./applyNetworkPhase.js').ApplyNetworkPhaseOptions }} [options]
 */
export function runColonizationEpochPhasesSync(ctx, options = {}) {
  runColonizationEpochNetworkPhase(ctx, options)
  runColonizationEpochClaimsPhase(ctx)
  runColonizationEpochSurvivalPhase(ctx, options)
  runColonizationEpochRuinPhase(ctx)
  runColonizationEpochCollapsePhase(ctx)
}
