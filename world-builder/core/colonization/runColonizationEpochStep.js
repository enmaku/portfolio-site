import {
  createColonizationEpochContext,
  runColonizationEpochClaimsPhase,
  runColonizationEpochCollapsePhase,
  runColonizationEpochNetworkPhase,
  runColonizationEpochPoliticsPhase,
  runColonizationEpochRuinPhase,
  runColonizationEpochSurvivalPhase,
  runColonizationEpochTaxPhase,
  runColonizationEpochTradePhase,
} from './applyColonizationEpoch.js'
import { runColonizationEpochPhases } from './runColonizationEpochPhases.js'
import {
  createInitialEpochStepProgress,
  reduceEpochStepProgressOnEpochComplete,
  reduceEpochStepProgressOnEpochStart,
  reduceEpochStepProgressOnCollapseSubstepComplete,
  reduceEpochStepProgressOnCollapseSubstepItemProgress,
  reduceEpochStepProgressOnCollapseSubstepStart,
  reduceEpochStepProgressOnNetworkSubstepComplete,
  reduceEpochStepProgressOnNetworkSubstepItemProgress,
  reduceEpochStepProgressOnNetworkSubstepStart,
  reduceEpochStepProgressOnPhaseComplete,
  reduceEpochStepProgressOnPhaseStart,
  reduceEpochStepProgressOnTradeSubstepComplete,
  reduceEpochStepProgressOnTradeSubstepItemProgress,
  reduceEpochStepProgressOnTradeSubstepStart,
  reduceEpochStepProgressOnPoliticsSubstepComplete,
  reduceEpochStepProgressOnPoliticsSubstepItemProgress,
  reduceEpochStepProgressOnPoliticsSubstepStart,
} from './colonizationEpochProgress.js'
import { COLONIZATION_EPOCH_PHASES } from './colonizationEpochSteps.js'
import { createControlOverlayRefreshCue } from './mapFxCues.js'
import { wrapPoliticsHooksWithEpochIndices } from './politicsSubstepIndex.js'
import { wrapTradeClearingHooksWithEpochIndices } from './tradeSubstepIndex.js'

/** @typedef {import('./colonizationEpochProgress.js').EpochStepProgressState} EpochStepProgressState */
/** @typedef {import('./mapFxCues.js').MapFxCue} MapFxCue */

/**
 * @typedef {Object} MapFxLiveState
 * @property {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @property {Record<string, Array<{ x: number, y: number }>>} [primaryClaim]
 */

/**
 * @typedef {Object} RunColonizationEpochStepHandlers
 * @property {(progress: EpochStepProgressState) => void} [onProgress]
 * @property {(cue: MapFxCue, live: MapFxLiveState) => void | Promise<void>} [onMapFx]
 */

/**
 * @typedef {Object} RunColonizationEpochStepOptions
 * @property {RunColonizationEpochStepHandlers} [handlers]
 * @property {{ saltSpoilageMultiplierForSettlement?: Function }} [epochOptions]
 * @property {() => Promise<void>} [yieldToUi]
 */

/**
 * @param {RunColonizationEpochStepHandlers} handlers
 * @param {() => Promise<void>} yieldToUi
 * @param {MapFxCue} cue
 * @param {MapFxLiveState} live
 */
async function emitMapFx(handlers, yieldToUi, cue, live) {
  await handlers.onMapFx?.(cue, live)
  await yieldToUi()
}

/**
 * @param {import('./applyColonizationEpoch.js').ColonizationEpochContext} ctx
 * @returns {MapFxLiveState}
 */
function liveFromCtx(ctx) {
  return {
    slice: ctx.slice,
    primaryClaim: ctx.primaryClaim,
  }
}

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
          onMapFx: async (cue) => {
            await emitMapFx(handlers, yieldToUi, cue, liveFromCtx(ctx))
          },
        },
      })
    } else if (phase.id === 'claims') {
      runColonizationEpochClaimsPhase(ctx)
      await emitMapFx(
        handlers,
        yieldToUi,
        createControlOverlayRefreshCue({
          epoch: ctx.slice.epoch,
          phaseId: 'claims',
          primaryClaim: ctx.primaryClaim,
        }),
        liveFromCtx(ctx),
      )
    } else if (phase.id === 'trade') {
      await runColonizationEpochTradePhase(ctx, {
        trade: {
          yieldToUi,
          hooks: wrapTradeClearingHooksWithEpochIndices({
            onTradeSubstep(payload) {
              if (payload.type === 'substep-start') {
                progress = reduceEpochStepProgressOnTradeSubstepStart(progress, {
                  substepIndex: payload.substepIndex ?? 0,
                })
              } else if (payload.type === 'substep-item') {
                progress = reduceEpochStepProgressOnTradeSubstepItemProgress(progress, {
                  substepIndex: payload.substepIndex ?? 0,
                  itemIndex: payload.itemIndex ?? 0,
                  itemCount: payload.itemCount ?? 0,
                })
              } else {
                progress = reduceEpochStepProgressOnTradeSubstepComplete(progress, {
                  substepIndex: payload.substepIndex ?? 0,
                })
              }
              handlers.onProgress?.(progress)
            },
          }),
        },
      })
    } else if (phase.id === 'tax') {
      runColonizationEpochTaxPhase(ctx, epochOptions)
    } else if (phase.id === 'survival') {
      runColonizationEpochSurvivalPhase(ctx, epochOptions)
    } else if (phase.id === 'ruin') {
      runColonizationEpochRuinPhase(ctx)
      await emitRuinControlOverlayFx(ctx, handlers, yieldToUi)
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
              } else if (payload.type === 'item-progress') {
                progress = reduceEpochStepProgressOnCollapseSubstepItemProgress(progress, {
                  substepIndex: payload.substepIndex,
                  itemIndex: payload.itemIndex ?? 0,
                  itemCount: payload.itemCount ?? 0,
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
    } else if (phase.id === 'politics') {
      await runColonizationEpochPoliticsPhase(ctx, {
        ...epochOptions,
        politics: {
          yieldToUi,
          hooks: wrapPoliticsHooksWithEpochIndices({
            onPoliticsSubstep(payload) {
              if (payload.type === 'substep-start') {
                progress = reduceEpochStepProgressOnPoliticsSubstepStart(progress, {
                  substepIndex: payload.substepIndex ?? 0,
                })
              } else if (payload.type === 'substep-item') {
                progress = reduceEpochStepProgressOnPoliticsSubstepItemProgress(progress, {
                  substepIndex: payload.substepIndex ?? 0,
                  itemIndex: payload.itemIndex ?? 0,
                  itemCount: payload.itemCount ?? 0,
                })
              } else {
                progress = reduceEpochStepProgressOnPoliticsSubstepComplete(progress, {
                  substepIndex: payload.substepIndex ?? 0,
                })
              }
              handlers.onProgress?.(progress)
            },
          }),
          onMapFx: async (cue, live) => {
            await emitMapFx(handlers, yieldToUi, cue, live)
          },
          primaryClaimForFx: () => ctx.primaryClaim,
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
 * @param {import('./applyColonizationEpoch.js').ColonizationEpochContext} ctx
 * @param {RunColonizationEpochStepHandlers} handlers
 * @param {() => Promise<void>} yieldToUi
 */
async function emitRuinControlOverlayFx(ctx, handlers, yieldToUi) {
  const abandonedAny = (ctx.events ?? []).some((event) => event?.kind === 'settlement_abandoned')
  if (!abandonedAny) return
  await emitMapFx(
    handlers,
    yieldToUi,
    createControlOverlayRefreshCue({
      epoch: ctx.slice.epoch,
      phaseId: 'ruin',
      primaryClaim: ctx.primaryClaim,
    }),
    liveFromCtx(ctx),
  )
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
