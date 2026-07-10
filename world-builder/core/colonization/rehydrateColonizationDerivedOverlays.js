import { applyPopulationCollapse, applyPopulationCollapseAsync } from './applyPopulationCollapse.js'
import {
  hasPersistedPrimaryClaim,
  rehydratePrimaryClaimForSlice,
} from './computePrimaryClaimMap.js'
import { COLONIZATION_PHASE_RUNNING } from './createDefaultColonizationSlice.js'
import { COLONIZATION_SESSION_RESTORE_DERIVED_STEP_START, COLONIZATION_SESSION_RESTORE_COLLAPSE_STEP_INDEX, COLONIZATION_SESSION_RESTORE_STEPS, COLONIZATION_SESSION_RESTORE_VISITED_STEP_INDEX } from './colonizationRehydrationSteps.js'
import {
  createInitialRehydrateColonizationProgress,
  reduceRehydrateColonizationProgressOnCollapseSubstepComplete,
  reduceRehydrateColonizationProgressOnCollapseSubstepStart,
  reduceRehydrateColonizationProgressOnRunComplete,
  reduceRehydrateColonizationProgressOnStepComplete,
  reduceRehydrateColonizationProgressOnStepStart,
  reduceRehydrateColonizationProgressOnVisitedSubstepComplete,
  reduceRehydrateColonizationProgressOnVisitedSubstepItemProgress,
  reduceRehydrateColonizationProgressOnVisitedSubstepStart,
} from './rehydrateColonizationProgress.js'
import {
  hasFullLogisticsNodeSurvey,
  mergeLogisticsNodeSurveyFromStorage,
} from './logisticsNodes/scoreLogisticsNodes.js'
import { rebuildVisitRasterFromSession, rebuildVisitRasterFromSessionAsync } from './visitStatus/rebuildVisitRasterFromSession.js'

/** @typedef {import('./rehydrateColonizationProgress.js').RehydrateColonizationProgressState} RehydrateColonizationProgressState */

/**
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../types.js').WorldDocument} doc
 * @returns {boolean}
 */
export function needsColonizationDerivedOverlayRehydration(slice, doc) {
  if (slice.colonizationPhase !== COLONIZATION_PHASE_RUNNING) {
    return false
  }

  if (!hasFullLogisticsNodeSurvey(slice.logisticsNodeSurvey)) {
    return true
  }

  if (!hasPersistedPrimaryClaim(slice.primaryClaim, slice.settlements)) {
    return true
  }

  const cellCount = doc.gridWidth * doc.gridHeight
  const hasVisitRaster =
    slice.visitedCells instanceof Uint8Array && slice.visitedCells.length === cellCount
  const hasCollapseRaster =
    slice.populationCollapseRaster instanceof Float32Array &&
    slice.populationCollapseRaster.length === cellCount

  return !hasVisitRaster || !hasCollapseRaster
}

/**
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../types.js').WorldDocument} doc
 * @returns {import('./createDefaultColonizationSlice.js').ColonizationSlice}
 */
export function rehydrateColonizationDerivedOverlays(slice, doc) {
  if (slice.colonizationPhase !== COLONIZATION_PHASE_RUNNING) {
    return slice
  }

  let next = slice

  if (!hasFullLogisticsNodeSurvey(next.logisticsNodeSurvey)) {
    next = {
      ...next,
      logisticsNodeSurvey: mergeLogisticsNodeSurveyFromStorage(doc, next.logisticsNodeSurvey),
    }
  }

  if (!hasPersistedPrimaryClaim(next.primaryClaim, next.settlements)) {
    next = {
      ...next,
      primaryClaim: rehydratePrimaryClaimForSlice(next, doc),
    }
  }

  const cellCount = doc.gridWidth * doc.gridHeight
  const hasVisitRaster =
    next.visitedCells instanceof Uint8Array && next.visitedCells.length === cellCount
  const hasCollapseRaster =
    next.populationCollapseRaster instanceof Float32Array &&
    next.populationCollapseRaster.length === cellCount

  if (hasVisitRaster && hasCollapseRaster) {
    return next
  }

  const withVisit = hasVisitRaster
    ? next
    : {
        ...next,
        visitedCells: rebuildVisitRasterFromSession(next, doc),
      }

  if (hasCollapseRaster) {
    return withVisit
  }

  return applyPopulationCollapse(withVisit, doc).slice
}

/**
 * @typedef {Object} RehydrateColonizationDerivedOverlaysHandlers
 * @property {(progress: RehydrateColonizationProgressState) => void} [onProgress]
 */

/**
 * @typedef {Object} RehydrateColonizationDerivedOverlaysOptions
 * @property {RehydrateColonizationDerivedOverlaysHandlers} [handlers]
 * @property {() => Promise<void>} [yieldToUi]
 * @property {RehydrateColonizationProgressState} [initialProgress]
 * @property {boolean} [skipInitialYield]
 */

/**
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../types.js').WorldDocument} doc
 * @param {RehydrateColonizationDerivedOverlaysOptions} [options]
 * @returns {Promise<import('./createDefaultColonizationSlice.js').ColonizationSlice>}
 */
export async function rehydrateColonizationDerivedOverlaysAsync(slice, doc, options = {}) {
  if (!needsColonizationDerivedOverlayRehydration(slice, doc)) {
    return rehydrateColonizationDerivedOverlays(slice, doc)
  }

  const yieldToUi = options.yieldToUi ?? (async () => {})
  const handlers = options.handlers ?? {}
  const derivedStart = COLONIZATION_SESSION_RESTORE_DERIVED_STEP_START

  let progress = options.initialProgress ?? createInitialRehydrateColonizationProgress()
  if (!options.initialProgress) {
    handlers.onProgress?.(progress)
    await yieldToUi()
  } else if (!options.skipInitialYield) {
    await yieldToUi()
  }

  let next = slice

  const runStep = async (stepIndex, needed, fn) => {
    if (needed) {
      const step = COLONIZATION_SESSION_RESTORE_STEPS[stepIndex]
      progress = reduceRehydrateColonizationProgressOnStepStart(progress, {
        stepIndex,
        label: step?.label ?? '',
      })
      handlers.onProgress?.(progress)
      await yieldToUi()
    }
    const result = needed ? await fn() : undefined
    progress = reduceRehydrateColonizationProgressOnStepComplete(progress, { stepIndex })
    handlers.onProgress?.(progress)
    await yieldToUi()
    return result
  }

  next = await runStep(
    derivedStart,
    !hasFullLogisticsNodeSurvey(next.logisticsNodeSurvey),
    async () => ({
      ...next,
      logisticsNodeSurvey: mergeLogisticsNodeSurveyFromStorage(doc, next.logisticsNodeSurvey),
    }),
  ).then((result) => result ?? next)

  next = await runStep(
    derivedStart + 1,
    !hasPersistedPrimaryClaim(next.primaryClaim, next.settlements),
    async () => ({
      ...next,
      primaryClaim: rehydratePrimaryClaimForSlice(next, doc),
    }),
  ).then((result) => result ?? next)

  const cellCount = doc.gridWidth * doc.gridHeight
  const hasVisitRaster =
    next.visitedCells instanceof Uint8Array && next.visitedCells.length === cellCount
  const hasCollapseRaster =
    next.populationCollapseRaster instanceof Float32Array &&
    next.populationCollapseRaster.length === cellCount

  const visitedStepIndex = COLONIZATION_SESSION_RESTORE_VISITED_STEP_INDEX
  if (!hasVisitRaster) {
    progress = reduceRehydrateColonizationProgressOnStepStart(progress, {
      stepIndex: visitedStepIndex,
      label: COLONIZATION_SESSION_RESTORE_STEPS[visitedStepIndex]?.label ?? 'Visited',
    })
    handlers.onProgress?.(progress)
    await yieldToUi()

    const visitedCells = await rebuildVisitRasterFromSessionAsync(next, doc, {
      yieldToUi,
      onVisitedSubstep(payload) {
        if (payload.type === 'substep-start') {
          progress = reduceRehydrateColonizationProgressOnVisitedSubstepStart(progress, {
            substepIndex: payload.substepIndex,
          })
        } else if (payload.type === 'substep-complete') {
          progress = reduceRehydrateColonizationProgressOnVisitedSubstepComplete(progress, {
            substepIndex: payload.substepIndex,
          })
        } else {
          progress = reduceRehydrateColonizationProgressOnVisitedSubstepItemProgress(progress, {
            itemIndex: payload.itemIndex,
            itemCount: payload.itemCount,
          })
        }
        handlers.onProgress?.(progress)
      },
    })

    next = {
      ...next,
      visitedCells,
    }

    progress = reduceRehydrateColonizationProgressOnStepComplete(progress, {
      stepIndex: visitedStepIndex,
    })
    handlers.onProgress?.(progress)
    await yieldToUi()
  } else {
    progress = reduceRehydrateColonizationProgressOnStepComplete(progress, {
      stepIndex: visitedStepIndex,
    })
    handlers.onProgress?.(progress)
    await yieldToUi()
  }

  const collapseStepIndex = COLONIZATION_SESSION_RESTORE_COLLAPSE_STEP_INDEX
  if (!hasCollapseRaster) {
    progress = reduceRehydrateColonizationProgressOnStepStart(progress, {
      stepIndex: collapseStepIndex,
      label: COLONIZATION_SESSION_RESTORE_STEPS[collapseStepIndex]?.label ?? 'Collapse',
    })
    handlers.onProgress?.(progress)
    await yieldToUi()

    const populationCollapseRaster = await collapsePopulationForRehydration(next, doc, {
      progress,
      handlers,
      yieldToUi,
    })

    next = {
      ...next,
      populationCollapseRaster,
    }

    progress = reduceRehydrateColonizationProgressOnStepComplete(progress, {
      stepIndex: collapseStepIndex,
    })
    handlers.onProgress?.(progress)
    await yieldToUi()
  } else {
    progress = reduceRehydrateColonizationProgressOnStepComplete(progress, {
      stepIndex: collapseStepIndex,
    })
    handlers.onProgress?.(progress)
    await yieldToUi()
  }

  progress = reduceRehydrateColonizationProgressOnRunComplete(progress)
  handlers.onProgress?.(progress)

  return next
}

/**
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../types.js').WorldDocument} doc
 * @param {{
 *   progress: RehydrateColonizationProgressState,
 *   handlers: RehydrateColonizationDerivedOverlaysHandlers,
 *   yieldToUi: () => Promise<void>,
 * }} context
 * @returns {Promise<Float32Array>}
 */
async function collapsePopulationForRehydration(slice, doc, context) {
  let { progress } = context

  return applyPopulationCollapseAsync(slice, doc, {
    yieldToUi: context.yieldToUi,
    hooks: {
      onCollapseSubstep(payload) {
        if (payload.type === 'substep-start') {
          progress = reduceRehydrateColonizationProgressOnCollapseSubstepStart(progress, {
            substepIndex: payload.substepIndex,
          })
        } else {
          progress = reduceRehydrateColonizationProgressOnCollapseSubstepComplete(progress, {
            substepIndex: payload.substepIndex,
          })
        }
        context.handlers.onProgress?.(progress)
      },
    },
  }).then((result) => result.populationCollapseRaster)
}
