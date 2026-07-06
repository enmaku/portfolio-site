import {
  createColonizationEpochContext,
  runColonizationEpochClaimsPhase,
  runColonizationEpochCollapsePhase,
  runColonizationEpochCollapsePhaseAsync,
  runColonizationEpochNetworkPhase,
  runColonizationEpochNetworkPhaseAsync,
  runColonizationEpochRuinPhase,
  runColonizationEpochSurvivalPhase,
} from './applyColonizationEpoch.js'
import { createCommittedTip } from './createCommittedTip.js'
import {
  createInitialEpochStepProgress,
  reduceEpochStepProgressOnEpochComplete,
  reduceEpochStepProgressOnEpochStart,
  reduceEpochStepProgressOnCollapseSubstepComplete,
  reduceEpochStepProgressOnCollapseSubstepStart,
  reduceEpochStepProgressOnNetworkSubstepComplete,
  reduceEpochStepProgressOnNetworkSubstepStart,
  reduceEpochStepProgressOnPhaseComplete,
  reduceEpochStepProgressOnPhaseStart,
  reduceEpochStepProgressOnRunComplete,
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
 * Advance epochBatch annual ticks with UI progress reporting and yields between phases.
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

  const batch = Math.max(1, Math.floor(slice.colonistSettings.epochBatch || 1))
  const yieldToUi = options.yieldToUi ?? yieldEpochStepProgressToUi
  const handlers = options.handlers ?? {}
  const epochOptions = options.epochOptions ?? {}

  let progress = createInitialEpochStepProgress(batch)
  handlers.onProgress?.(progress)
  await yieldToUi()

  let current = slice
  let currentDoc = worldDocument
  /** @type {object[]} */
  const eventTips = []

  for (let epochIndex = 0; epochIndex < batch; epochIndex += 1) {
    progress = reduceEpochStepProgressOnEpochStart(progress, { epochIndex, epochBatch: batch })
    handlers.onProgress?.(progress)
    await yieldToUi()

    const ctx = createColonizationEpochContext(current, currentDoc)

    for (let phaseIndex = 0; phaseIndex < COLONIZATION_EPOCH_PHASES.length; phaseIndex += 1) {
      const phase = COLONIZATION_EPOCH_PHASES[phaseIndex]
      progress = reduceEpochStepProgressOnPhaseStart(progress, {
        epochIndex,
        epochBatch: batch,
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

      progress = reduceEpochStepProgressOnPhaseComplete(progress, {
        epochIndex,
        epochBatch: batch,
        phaseIndex,
      })
      handlers.onProgress?.(progress)
      await yieldToUi()
    }

    current = ctx.slice
    currentDoc = ctx.worldDocument
    for (const event of ctx.events) {
      if (event?.retainTip) {
        eventTips.push(createCommittedTip(current, event))
      }
    }

    progress = reduceEpochStepProgressOnEpochComplete(progress, { epochIndex, epochBatch: batch })
    handlers.onProgress?.(progress)
    await yieldToUi()
  }

  const presentDayTip = createCommittedTip(current)
  const committedTips = [...current.committedTips, ...eventTips, presentDayTip]
  const nextSlice = {
    ...current,
    committedTips,
  }

  progress = reduceEpochStepProgressOnRunComplete(progress)
  handlers.onProgress?.(progress)

  return {
    slice: nextSlice,
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

  const batch = Math.max(1, Math.floor(slice.colonistSettings.epochBatch || 1))
  let current = slice
  let currentDoc = worldDocument
  /** @type {object[]} */
  const eventTips = []

  for (let i = 0; i < batch; i += 1) {
    const ctx = createColonizationEpochContext(current, currentDoc)
    runColonizationEpochNetworkPhase(ctx, options)
    runColonizationEpochClaimsPhase(ctx)
    runColonizationEpochSurvivalPhase(ctx, options)
    runColonizationEpochRuinPhase(ctx)
    runColonizationEpochCollapsePhase(ctx)

    current = ctx.slice
    currentDoc = ctx.worldDocument
    for (const event of ctx.events) {
      if (event?.retainTip) {
        eventTips.push(createCommittedTip(current, event))
      }
    }
  }

  const presentDayTip = createCommittedTip(current)
  return {
    ...current,
    committedTips: [...current.committedTips, ...eventTips, presentDayTip],
  }
}
