/**
 * Map trade clearing substep ids to colonization epoch progress indices.
 */

import { COLONIZATION_TRADE_SUBSTEPS } from './colonizationEpochSteps.js'

/**
 * @param {string} substepId
 * @returns {number}
 */
export function tradeSubstepIndexForId(substepId) {
  const index = COLONIZATION_TRADE_SUBSTEPS.findIndex((step) => step.id === substepId)
  if (index < 0) {
    throw new Error(`unknown trade substep: ${substepId}`)
  }
  return index
}

/**
 * Wrap economy trade hooks so epoch progress reducers receive catalog indices.
 *
 * @param {import('../economy/tradeClearing/runTradeClearing.js').TradeClearingHooks | undefined} hooks
 * @returns {import('../economy/tradeClearing/runTradeClearing.js').TradeClearingHooks | undefined}
 */
export function wrapTradeClearingHooksWithEpochIndices(hooks) {
  if (!hooks?.onTradeSubstep) {
    return hooks
  }
  const { onTradeSubstep } = hooks
  return {
    ...hooks,
    onTradeSubstep(payload) {
      onTradeSubstep({
        ...payload,
        substepIndex: tradeSubstepIndexForId(payload.substepId),
      })
    },
  }
}
