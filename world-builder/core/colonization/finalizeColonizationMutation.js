import {
  reduceEpochStepProgressOnFinalizeStepComplete,
  reduceEpochStepProgressOnFinalizeStepStart,
  reduceEpochStepProgressOnMapSubstepComplete,
  reduceEpochStepProgressOnMapSubstepStart,
} from './colonizationEpochProgress.js'
import { COLONIZATION_EPOCH_FINALIZE_STEPS } from './colonizationEpochSteps.js'

/** @typedef {import('./colonizationEpochProgress.js').EpochStepProgressState} EpochStepProgressState */
/** @typedef {import('../types.js').WorldDocument} WorldDocument */
/** @typedef {import('../../renderer/mapLayerRefresh.js').MapLayerId} MapLayerId */

const MAP_FINALIZE_STEP_INDEX = COLONIZATION_EPOCH_FINALIZE_STEPS.findIndex(
  (step) => step.id === 'map',
)

/**
 * @typedef {Object} ColonizationEpochMapPorts
 * @property {() => void | Promise<void>} persistSession
 * @property {() => WorldDocument | null | undefined} getBaseDocument
 * @property {() => void} rehydrate
 * @property {() => WorldDocument | null} mergeDocument
 * @property {(doc: WorldDocument, layerId: MapLayerId) => void | Promise<void>} applyLayer
 * @property {() => void | Promise<void>} onComplete
 */

/**
 * @typedef {Object} FinalizeColonizationMutationHandlers
 * @property {() => EpochStepProgressState} getProgress
 * @property {(progress: EpochStepProgressState) => void} onProgress
 * @property {() => Promise<void>} yieldToUi
 */

/**
 * @param {ColonizationEpochMapPorts} ports
 * @param {FinalizeColonizationMutationHandlers | null} handlers null to skip progress reporting
 * @returns {Promise<void>}
 */
async function runColonizationMapSubsteps(ports, handlers) {
  /**
   * @param {number} substepIndex
   * @param {() => void | Promise<void>} work
   */
  async function runSubstep(substepIndex, work) {
    if (handlers) {
      handlers.onProgress(
        reduceEpochStepProgressOnMapSubstepStart(handlers.getProgress(), { substepIndex }),
      )
      await handlers.yieldToUi()
    }
    await work()
    if (handlers) {
      handlers.onProgress(
        reduceEpochStepProgressOnMapSubstepComplete(handlers.getProgress(), { substepIndex }),
      )
      await handlers.yieldToUi()
    }
  }

  await runSubstep(0, () => ports.persistSession())

  const base = ports.getBaseDocument()
  if (!base) {
    return
  }

  await runSubstep(1, () => ports.rehydrate())

  let merged = null
  await runSubstep(2, () => {
    merged = ports.mergeDocument()
  })

  if (!merged) {
    return
  }

  await runSubstep(3, () => ports.applyLayer(merged, 'population'))
  await runSubstep(4, () => ports.applyLayer(merged, 'explorationFog'))
  await runSubstep(5, () => ports.applyLayer(merged, 'routes'))
  await runSubstep(6, async () => {
    await ports.applyLayer(merged, 'settlementNodes')
    await ports.onComplete()
  })
}

/**
 * @typedef {Object} FinalizeColonizationMutationOptions
 * @property {ColonizationEpochMapPorts | null | undefined} ports
 * @property {() => void | Promise<void>} [fallbackPersist] used only when ports are absent
 * @property {FinalizeColonizationMutationHandlers} [handlers]
 * @property {boolean} [reportFinalizeProgress] drive epoch finalize-step chips; default true
 */

/**
 * Shared session/map finalize mutation for begin-colonization and epoch-step. Persists the
 * session and, when map ports are wired up, rehydrates/merges/applies the map layers exactly
 * once. Falls back to a single caller-supplied persist when no ports are available.
 *
 * @param {FinalizeColonizationMutationOptions} options
 * @returns {Promise<void>}
 */
export async function finalizeColonizationMutation(options) {
  const { ports, fallbackPersist, handlers, reportFinalizeProgress = true } = options

  if (!ports) {
    await fallbackPersist?.()
    return
  }

  if (!reportFinalizeProgress || !handlers) {
    await runColonizationMapSubsteps(ports, null)
    return
  }

  handlers.onProgress(
    reduceEpochStepProgressOnFinalizeStepStart(handlers.getProgress(), {
      stepIndex: MAP_FINALIZE_STEP_INDEX,
    }),
  )
  await handlers.yieldToUi()

  await runColonizationMapSubsteps(ports, handlers)

  handlers.onProgress(
    reduceEpochStepProgressOnFinalizeStepComplete(handlers.getProgress(), {
      stepIndex: MAP_FINALIZE_STEP_INDEX,
    }),
  )
  await handlers.yieldToUi()
}
