import {
  createColonizationEpochContext,
  runColonizationEpochClaimsPhase,
  runColonizationEpochCollapsePhase,
  runColonizationEpochCollapsePhaseAsync,
  runColonizationEpochNetworkPhase,
  runColonizationEpochMergePhase,
  runColonizationEpochNetworkPhaseAsync,
  runColonizationEpochRuinPhase,
  runColonizationEpochSurvivalPhase,
} from './applyColonizationEpoch.js'
import {
  createInitialEpochStepProgress,
  reduceEpochStepProgressOnEpochComplete,
  reduceEpochStepProgressOnEpochStart,
  reduceEpochStepProgressOnCollapseSubstepComplete,
  reduceEpochStepProgressOnCollapseSubstepStart,
  reduceEpochStepProgressOnFinalizeStepComplete,
  reduceEpochStepProgressOnFinalizeStepStart,
  reduceEpochStepProgressOnNetworkSubstepComplete,
  reduceEpochStepProgressOnNetworkSubstepItemProgress,
  reduceEpochStepProgressOnNetworkSubstepStart,
  reduceEpochStepProgressOnPhaseComplete,
  reduceEpochStepProgressOnPhaseStart,
  yieldEpochStepProgressToUi,
} from './colonizationEpochProgress.js'
import { COLONIZATION_EPOCH_PHASES } from './colonizationEpochSteps.js'

/** @typedef {import('./colonizationEpochProgress.js').EpochStepProgressState} EpochStepProgressState */

/**
 * @typedef {Object} RunColonizationEpochStepHandlers
 * @property {(progress: EpochStepProgressState) => void} [onProgress]
 */

/**
 * @typedef {Object} RunColonizationEpochStepOptions
 * @property {RunColonizationEpochStepHandlers} [handlers]
 * @property {{ saltSpoilageMultiplierForSettlement?: Function }} [epochOptions]
 * @property {() => Promise<void>} [yieldToUi]
 */

/**
 * Advance one annual epoch tick with UI progress reporting and yields between phases.
 *
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../types.js').WorldDocument} worldDocument
 * @param {RunColonizationEpochStepOptions} [options]
 * @returns {Promise<{
 *   slice: import('./createDefaultColonizationSlice.js').ColonizationSlice,
 *   ran: boolean,
 * }>}
 */
export async function runColonizationEpochStep(slice, worldDocument, options = {}) {
  if (slice.colonizationPhase !== 'running') {
    return { slice, ran: false }
  }

  const yieldToUi = options.yieldToUi ?? yieldEpochStepProgressToUi
  const handlers = options.handlers ?? {}
  const epochOptions = options.epochOptions ?? {}

  let progress = createInitialEpochStepProgress()
  handlers.onProgress?.(progress)
  await yieldToUi()

  let current = slice
  let currentDoc = worldDocument
  const simulationEpoch = current.epoch

  progress = reduceEpochStepProgressOnEpochStart(progress, { simulationEpoch })
  handlers.onProgress?.(progress)
  await yieldToUi()

  const ctx = createColonizationEpochContext(current, currentDoc)

  for (let phaseIndex = 0; phaseIndex < COLONIZATION_EPOCH_PHASES.length; phaseIndex += 1) {
    const phase = COLONIZATION_EPOCH_PHASES[phaseIndex]
    progress = reduceEpochStepProgressOnPhaseStart(progress, {
      simulationEpoch,
      phaseIndex,
      phaseId: phase.id,
    })
    handlers.onProgress?.(progress)
    await yieldToUi()

    if (phase.id === 'network') {
      await runColonizationEpochNetworkPhaseAsync(ctx, {
        network: {
          yieldToUi,
          hooks: {
            onNetworkSubstep(payload) {
              if (payload.type === 'substep-start') {
                progress = reduceEpochStepProgressOnNetworkSubstepStart(progress, {
                  substepIndex: payload.substepIndex,
                })
              } else if (payload.type === 'substep-item') {
                progress = reduceEpochStepProgressOnNetworkSubstepItemProgress(progress, {
                  substepIndex: payload.substepIndex,
                  itemIndex: payload.itemIndex,
                  itemCount: payload.itemCount,
                })
              } else {
                progress = reduceEpochStepProgressOnNetworkSubstepComplete(progress, {
                  substepIndex: payload.substepIndex,
                })
              }
              handlers.onProgress?.(progress)
            },
          },
        },
      })
    } else if (phase.id === 'claims') {
      runColonizationEpochClaimsPhase(ctx)
    } else if (phase.id === 'survival') {
      runColonizationEpochSurvivalPhase(ctx, epochOptions)
    } else if (phase.id === 'merge') {
      runColonizationEpochMergePhase(ctx)
    } else if (phase.id === 'ruin') {
      runColonizationEpochRuinPhase(ctx)
    } else if (phase.id === 'collapse') {
      await runColonizationEpochCollapsePhaseAsync(ctx, {
        collapse: {
          yieldToUi,
          hooks: {
            onCollapseSubstep(payload) {
              if (payload.type === 'substep-start') {
                progress = reduceEpochStepProgressOnCollapseSubstepStart(progress, {
                  substepIndex: payload.substepIndex,
                })
              } else {
                progress = reduceEpochStepProgressOnCollapseSubstepComplete(progress, {
                  substepIndex: payload.substepIndex,
                })
              }
              handlers.onProgress?.(progress)
            },
          },
        },
      })
    }

    progress = reduceEpochStepProgressOnPhaseComplete(progress, { phaseIndex })
    handlers.onProgress?.(progress)
    await yieldToUi()
  }

  current = ctx.slice
  currentDoc = ctx.worldDocument

  progress = reduceEpochStepProgressOnEpochComplete(progress, { simulationEpoch })
  handlers.onProgress?.(progress)
  await yieldToUi()

  progress = reduceEpochStepProgressOnFinalizeStepStart(progress, { stepIndex: 0 })
  handlers.onProgress?.(progress)
  await yieldToUi()

  progress = reduceEpochStepProgressOnFinalizeStepComplete(progress, { stepIndex: 0 })
  handlers.onProgress?.(progress)
  await yieldToUi()

  return {
    slice: current,
    ran: true,
  }
}

/**
 * Synchronous epoch step without progress reporting. Prefer {@link runColonizationEpochStep} in UI.
 *
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../types.js').WorldDocument} worldDocument
 * @param {{ saltSpoilageMultiplierForSettlement?: Function }} [options]
 * @returns {import('./createDefaultColonizationSlice.js').ColonizationSlice}
 */
export function applyEpochStepSyncFromPhases(slice, worldDocument, options = {}) {
  if (slice.colonizationPhase !== 'running') {
    return slice
  }

  const ctx = createColonizationEpochContext(slice, worldDocument)
  runColonizationEpochNetworkPhase(ctx, options)
  runColonizationEpochClaimsPhase(ctx)
  runColonizationEpochSurvivalPhase(ctx, options)
  runColonizationEpochRuinPhase(ctx)
  runColonizationEpochCollapsePhase(ctx)

  return ctx.slice
}
