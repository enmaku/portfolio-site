import { DEFAULT_GRID_SIZE } from './types.js'
import {
  LANDMASS_PIPELINE_STAGE_CONTRACTS,
  LANDMASS_PIPELINE_STEP_IDS,
  assertLandmassStageOutputs,
  pickLandmassStageInput,
} from './landmassPipelineStageContracts.js'
import {
  LANDMASS_PIPELINE_STAGE_MODULE_BY_ID,
  selectLandmassStageInput,
} from './landmassPipelineStageModules.js'
import {
  createCooperativeLandmassPipelineHooks,
  createSyncLandmassPipelineHooks,
  isThenable,
  runLandmassPipelineWithRetryShared,
} from './landmassPipelineRunner.js'
import { resolveWorldGenerationOptions } from './worldGenerationOptions.js'

export {
  LANDMASS_PIPELINE_STAGE_CONTRACTS,
  LANDMASS_PIPELINE_STEP_IDS,
  pickLandmassStageInput,
}
export { buildWorldDocumentFromPipelineState } from './buildWorldDocumentFromPipelineState.js'
export { cloneWorldDocument } from './cloneWorldDocument.js'

/** @typedef {import('./landmassPipelineTypes.js').DerivedGeographyStepId} DerivedGeographyStepId */
/** @typedef {import('./landmassPipelineTypes.js').DerivedGeographyPipelineState} DerivedGeographyPipelineState */
/** @typedef {import('./landmassPipelineTypes.js').LandmassPipelineRunStatus} LandmassPipelineRunStatus */
/** @typedef {import('./landmassPipelineTypes.js').PipelineStepOptions} PipelineStepOptions */

/** @type {ReadonlyArray<{ id: DerivedGeographyStepId, label: string }>} */
export const DERIVED_GEOGRAPHY_STEPS = LANDMASS_PIPELINE_STEP_IDS.map((id) => ({
  id,
  label: LANDMASS_PIPELINE_STAGE_CONTRACTS[id].label,
}))

/**
 * @typedef {Object} LandmassPipelineRunResult
 * @property {LandmassPipelineRunStatus} status
 * @property {DerivedGeographyPipelineState | null} state
 * @property {import('./types.js').WorldDocument | null} worldDocument
 * @property {string | null} errorMessage
 */

/**
 * @typedef {Object} LandmassPipelineRunCallbacks
 * @property {(payload: { stepId: DerivedGeographyStepId, stepIndex: number, stepCount: number, label: string }) => void} [onStepStart]
 * @property {(payload: { stepId: DerivedGeographyStepId, stepIndex: number, stepCount: number, label: string, state: DerivedGeographyPipelineState, worldDocument?: import('./types.js').WorldDocument }) => void} [onStepComplete]
 * @property {PipelineStepOptions['onSubstepStart']} [onSubstepStart]
 * @property {PipelineStepOptions['onSubstepProgress']} [onSubstepProgress]
 * @property {PipelineStepOptions['onSubstepComplete']} [onSubstepComplete]
 * @property {PipelineStepOptions['onSubstepPrepare']} [onSubstepPrepare]
 * @property {() => boolean | Promise<boolean>} [shouldCancel]
 * @property {() => void | Promise<void>} [yield]
 */

/**
 * @param {import('./types.js').DerivedGeographyParams} params
 * @returns {DerivedGeographyPipelineState}
 */
export function createInitialPipelineState(params) {
  const width = params.width ?? DEFAULT_GRID_SIZE
  const height = params.height ?? DEFAULT_GRID_SIZE
  const geographySeed = params.geographySeed | 0
  const prevailingWindDegrees = normalizeWindDegrees(params.prevailingWindDegrees)
  const options = resolveWorldGenerationOptions(params.options)

  return {
    geographySeed: geographySeed >= 0 ? geographySeed : geographySeed + 4294967296,
    prevailingWindDegrees,
    options,
    width,
    height,
    baselineDoc: null,
    erodedElevation: null,
    erosionSnapshots: null,
    erosionStepCount: 0,
    lakeMask: null,
    lakes: null,
    lakeMeta: null,
    lakeIdByCell: null,
    hydrologyStats: null,
    workingElevation: null,
    riverGraph: null,
    simulationRiverMask: null,
    riverNetworkMask: null,
    riverCorridorMask: null,
    channelWidth: null,
    flowDirection: null,
    fields: null,
    biomes: null,
    coastNavigability: null,
    coastalNodes: null,
    saltNodes: null,
    metalsRaster: null,
    metalNodes: null,
    arableRaster: null,
    timberRaster: null,
    generationReport: null,
    hydrologySubstepTimings: null,
    lastCompletedStep: null,
  }
}

/**
 * @param {DerivedGeographyPipelineState} state
 * @param {DerivedGeographyStepId} stepId
 * @param {PipelineStepOptions} [options]
 * @returns {DerivedGeographyPipelineState}
 */
export function runPipelineStep(state, stepId, options = {}) {
  const module = LANDMASS_PIPELINE_STAGE_MODULE_BY_ID[stepId]
  if (!module) {
    throw new Error(`Unknown pipeline step: ${stepId}`)
  }
  const input = selectLandmassStageInput(module, state)
  const output = module.shouldSkip?.(state)
    ? module.runSkipped(input)
    : module.run(input, options)
  assertLandmassStageOutputs(stepId, output)
  return {
    ...state,
    ...output,
  }
}

/**
 * @param {DerivedGeographyStepId} stepId
 * @param {import('./types.js').WorldGenerationOptions} options
 * @returns {boolean}
 */
export function shouldAttachLandmassStepPreview(stepId, options) {
  if (options.enableIntermediateStepPreviews) {
    return true
  }
  return stepId === 'validation'
}

/**
 * @param {import('./types.js').DerivedGeographyParams} params
 * @param {LandmassPipelineRunCallbacks} [callbacks]
 * @returns {LandmassPipelineRunResult}
 */
export function runLandmassPipelineRun(params, callbacks = {}) {
  const result = runLandmassPipelineWithRetryShared(
    params,
    callbacks,
    createSyncLandmassPipelineHooks(callbacks),
  )
  if (isThenable(result)) {
    throw new TypeError('runLandmassPipelineRun does not support async pipeline hooks')
  }
  return result
}

/**
 * @param {import('./types.js').DerivedGeographyParams} params
 * @param {LandmassPipelineRunCallbacks} [callbacks]
 * @returns {Promise<LandmassPipelineRunResult>}
 */
export async function runLandmassPipeline(params, callbacks = {}) {
  const result = runLandmassPipelineWithRetryShared(
    params,
    callbacks,
    createCooperativeLandmassPipelineHooks(callbacks),
  )
  return result
}

/**
 * @param {import('./types.js').DerivedGeographyParams} params
 * @returns {import('./types.js').WorldDocument}
 */
export function runFullDerivedGeographyPipeline(params) {
  const result = runLandmassPipelineRun(params)
  if (result.status === 'exhausted') {
    throw new Error('Landmass pipeline validation retries exhausted')
  }
  if (result.status !== 'success' || !result.worldDocument) {
    throw new Error(result.errorMessage ?? 'Landmass pipeline failed')
  }
  return result.worldDocument
}

/**
 * @param {number} degrees
 */
function normalizeWindDegrees(degrees) {
  const rounded = Math.round(degrees)
  return ((rounded % 360) + 360) % 360
}
