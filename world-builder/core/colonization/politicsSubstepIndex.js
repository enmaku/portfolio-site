/**
 * Map politics phase substep ids to colonization epoch progress indices.
 */

import { COLONIZATION_POLITICS_SUBSTEPS } from './colonizationEpochSteps.js'

/**
 * @param {string} substepId
 * @returns {number}
 */
export function politicsSubstepIndexForId(substepId) {
  const index = COLONIZATION_POLITICS_SUBSTEPS.findIndex((step) => step.id === substepId)
  if (index < 0) {
    throw new Error(`unknown politics substep: ${substepId}`)
  }
  return index
}

/**
 * Wrap politics hooks so epoch progress reducers receive catalog indices.
 *
 * @param {import('./politics/applyPoliticsPhase.js').PoliticsPhaseHooks | undefined} hooks
 * @returns {import('./politics/applyPoliticsPhase.js').PoliticsPhaseHooks | undefined}
 */
export function wrapPoliticsHooksWithEpochIndices(hooks) {
  if (!hooks?.onPoliticsSubstep) {
    return hooks
  }
  const { onPoliticsSubstep } = hooks
  return {
    ...hooks,
    onPoliticsSubstep(payload) {
      onPoliticsSubstep({
        ...payload,
        substepIndex: politicsSubstepIndexForId(payload.substepId),
      })
    },
  }
}
