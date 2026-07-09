import {
  reduceEpochStepProgressOnMapSubstepComplete,
  reduceEpochStepProgressOnMapSubstepStart,
} from './colonizationEpochProgress.js'

/** @typedef {import('./colonizationEpochProgress.js').EpochStepProgressState} EpochStepProgressState */
/** @typedef {import('../types.js').WorldDocument} WorldDocument */
/** @typedef {import('../../renderer/mapLayerRefresh.js').MapLayerId} MapLayerId */

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
 * @typedef {Object} RunColonizationEpochMapFinalizeHandlers
 * @property {() => EpochStepProgressState} getProgress
 * @property {(progress: EpochStepProgressState) => void} onProgress
 * @property {() => Promise<void>} yieldToUi
 */

/**
 * @param {ColonizationEpochMapPorts} ports
 * @param {RunColonizationEpochMapFinalizeHandlers} handlers
 * @returns {Promise<void>}
 */
export async function runColonizationEpochMapFinalize(ports, handlers) {
  /**
   * @param {number} substepIndex
   * @param {() => void | Promise<void>} work
   */
  async function runMapSubstep(substepIndex, work) {
    let progress = reduceEpochStepProgressOnMapSubstepStart(handlers.getProgress(), {
      substepIndex,
    })
    handlers.onProgress(progress)
    await handlers.yieldToUi()
    await work()
    progress = reduceEpochStepProgressOnMapSubstepComplete(progress, { substepIndex })
    handlers.onProgress(progress)
    await handlers.yieldToUi()
  }

  await runMapSubstep(0, () => ports.persistSession())

  const base = ports.getBaseDocument()
  if (!base) {
    return
  }

  await runMapSubstep(1, () => ports.rehydrate())

  let merged = null
  await runMapSubstep(2, () => {
    merged = ports.mergeDocument()
  })

  if (!merged) {
    return
  }

  await runMapSubstep(3, () => ports.applyLayer(merged, 'population'))
  await runMapSubstep(4, () => ports.applyLayer(merged, 'explorationFog'))
  await runMapSubstep(5, () => ports.applyLayer(merged, 'routes'))
  await runMapSubstep(6, async () => {
    await ports.applyLayer(merged, 'settlementNodes')
    await ports.onComplete()
  })
}
