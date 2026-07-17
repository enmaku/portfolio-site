import {
  createColonizationEpochContext,
  runColonizationEpochClaimsPhase,
  runColonizationEpochCollapsePhase,
  runColonizationEpochNetworkPhase,
  runColonizationEpochRuinPhase,
  runColonizationEpochSurvivalPhase,
  runColonizationEpochTradePhase,
} from './applyColonizationEpoch.js'
import { runColonizationEpochPhases } from './runColonizationEpochPhases.js'
import {
  createInitialEpochStepProgress,
  reduceEpochStepProgressOnEpochComplete,
  reduceEpochStepProgressOnEpochStart,
  reduceEpochStepProgressOnCollapseSubstepComplete,
  reduceEpochStepProgressOnCollapseSubstepStart,
  reduceEpochStepProgressOnNetworkSubstepComplete,
  reduceEpochStepProgressOnNetworkSubstepItemProgress,
  reduceEpochStepProgressOnNetworkSubstepStart,
  reduceEpochStepProgressOnPhaseComplete,
  reduceEpochStepProgressOnPhaseStart,
  reduceEpochStepProgressOnTradeSubstepComplete,
  reduceEpochStepProgressOnTradeSubstepItemProgress,
  reduceEpochStepProgressOnTradeSubstepStart,
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

  const yieldToUi = options.yieldToUi ?? (async () => {})
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
      await runColonizationEpochNetworkPhase(ctx, {
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
                  phase: payload.phase,
                  phasePercent: payload.phasePercent,
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
    } else if (phase.id === 'trade') {
      await runColonizationEpochTradePhase(ctx, {
        trade: {
          yieldToUi,
          hooks: {
            onTradeSubstep(payload) {
              if (payload.type === 'substep-start') {
                progress = reduceEpochStepProgressOnTradeSubstepStart(progress, {
                  substepIndex: payload.substepIndex,
                })
              } else if (payload.type === 'substep-item') {
                progress = reduceEpochStepProgressOnTradeSubstepItemProgress(progress, {
                  substepIndex: payload.substepIndex,
                  itemIndex: payload.itemIndex ?? 0,
                  itemCount: payload.itemCount ?? 0,
                })
              } else {
                progress = reduceEpochStepProgressOnTradeSubstepComplete(progress, {
                  substepIndex: payload.substepIndex,
                })
              }
              handlers.onProgress?.(progress)
            },
          },
        },
      })
    } else if (phase.id === 'survival') {
      runColonizationEpochSurvivalPhase(ctx, epochOptions)
    } else if (phase.id === 'ruin') {
      runColonizationEpochRuinPhase(ctx)
    } else if (phase.id === 'collapse') {
      await runColonizationEpochCollapsePhase(ctx, {
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

  return {
    slice: current,
    ran: true,
  }
}

/**
 * Epoch step without progress reporting. Prefer {@link runColonizationEpochStep} in UI.
 *
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../types.js').WorldDocument} worldDocument
 * @param {{ saltSpoilageMultiplierForSettlement?: Function }} [options]
 * @returns {Promise<import('./createDefaultColonizationSlice.js').ColonizationSlice>}
 */
export async function applyEpochStep(slice, worldDocument, options = {}) {
  if (slice.colonizationPhase !== 'running') {
    return slice
  }

  const ctx = createColonizationEpochContext(slice, worldDocument)
  await runColonizationEpochPhases(ctx, options)

  return ctx.slice
}
