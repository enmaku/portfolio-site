import { BIOMES_CATALOG } from './biomeCatalog.js'
import {
  classifyBiomesFromFields,
  classifyBiomesWithHydrology,
} from './classifyBiomesFromFields.js'
import { buildGenerationReport } from './buildGenerationReport.js'
import { computeCoastNavigability } from './coast/computeCoastNavigability.js'
import { deriveCoastalNodes } from './coast/deriveCoastalNodes.js'
import { applyErosion } from './erosion/applyErosion.js'
import { refreshFieldsAfterErosion } from './fields/refreshFieldsAfterErosion.js'
import { deriveAnnualMeanClimate } from './hydrology/seasonalClimatology.js'
import { generatePhysicalTerrainBaseline } from './generatePhysicalTerrainBaseline.js'
import { runHydrologySubsteps } from './hydrology/hydrologySubsteps.js'
import { assembleRiverNetworkFromFields } from './hydrology/riverNetwork.js'
import { generateArableRaster } from './resources/generateArableRaster.js'
import { generateTimberProductivity } from './resources/generateTimberProductivity.js'
import { computeMetalsRaster } from './resources/computeMetalsRaster.js'
import { placeMetalNodes } from './resources/placeMetalNodes.js'
import { placeSaltNodes } from './resources/placeSaltNodes.js'
import {
  DEFAULT_GRID_SIZE,
  PIPELINE_STAGE_DERIVED_GEOGRAPHY,
  PIPELINE_STAGE_PHYSICAL_TERRAIN_BASELINE,
} from './types.js'
import {
  LANDMASS_PIPELINE_STAGE_CONTRACTS,
  LANDMASS_PIPELINE_STEP_IDS,
  pickLandmassStageInput,
} from './landmassPipelineStageContracts.js'

export {
  LANDMASS_PIPELINE_STAGE_CONTRACTS,
  LANDMASS_PIPELINE_STEP_IDS,
  pickLandmassStageInput,
}
import { resolveWorldGenerationOptions } from './worldGenerationOptions.js'

/** @typedef {typeof LANDMASS_PIPELINE_STEP_IDS[number]} DerivedGeographyStepId */

/** @type {ReadonlyArray<{ id: DerivedGeographyStepId, label: string }>} */
export const DERIVED_GEOGRAPHY_STEPS = LANDMASS_PIPELINE_STEP_IDS.map((id) => ({
  id,
  label: LANDMASS_PIPELINE_STAGE_CONTRACTS[id].label,
}))

/**
 * @typedef {Object} DerivedGeographyPipelineState
 * @property {number} geographySeed
 * @property {number} prevailingWindDegrees
 * @property {import('./types.js').WorldGenerationOptions} options
 * @property {number} width
 * @property {number} height
 * @property {import('./types.js').WorldDocument | null} baselineDoc
 * @property {Float32Array | null} erodedElevation
 * @property {Float32Array[] | null} erosionSnapshots
 * @property {number} erosionStepCount
 * @property {Uint8Array | null} lakeMask
 * @property {import('./types.js').LakeRecord[] | null} lakes
 * @property {import('./types.js').LakeMetaRecord[] | null} lakeMeta
 * @property {Int32Array | null} lakeIdByCell
 * @property {import('./types.js').HydrologyPipelineStats | null} hydrologyStats
 * @property {Float32Array | null} workingElevation
 * @property {import('./types.js').RiverGraph | null} riverGraph
 * @property {Uint8Array | null} riverNetworkMask
 * @property {Uint8Array | null} riverCorridorMask
 * @property {Float32Array | null} channelWidth
 * @property {Int16Array | null} flowDirection
 * @property {import('./types.js').ScalarFields | null} fields
 * @property {Uint8Array | null} biomes
 * @property {Float32Array | null} coastNavigability
 * @property {import('./types.js').CoastalNode[] | null} coastalNodes
 * @property {import('./types.js').SaltNode[] | null} saltNodes
 * @property {Float32Array | null} metalsRaster
 * @property {import('./types.js').MetalNode[] | null} metalNodes
 * @property {Float32Array | null} arableRaster
 * @property {Float32Array | null} timberRaster
 * @property {import('./types.js').GenerationReport | null} generationReport
 * @property {import('./hydrology/hydrologySubsteps.js').HydrologySubstepTiming[] | null} hydrologySubstepTimings
 * @property {DerivedGeographyStepId | null} lastCompletedStep
 */

/**
 * @typedef {Object} PipelineStepOptions
 * @property {(payload: { substepId: string, substepIndex: number, substepCount: number, label: string }) => void} [onSubstepStart]
 * @property {(payload: { substepId: string, substepIndex: number, substepCount: number, label: string, progress: number }) => void} [onSubstepProgress]
 * @property {(payload: { substepId: string, substepIndex: number, substepCount: number, label: string, progress: number }) => void} [onSubstepComplete]
 * @property {(payload: { substepId: string, substepIndex: number, substepCount: number, label: string, input: Record<string, unknown> }) => void} [onSubstepPrepare]
 * @property {() => boolean} [shouldCancel]
 */

/**
 * @typedef {'success' | 'cancelled' | 'error'} LandmassPipelineRunStatus
 */

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
  const input = pickLandmassStageInput(stepId, state)
  const output = executeLandmassPipelineStage(stepId, input, state, options)
  return {
    ...state,
    ...output,
  }
}

/**
 * @param {DerivedGeographyStepId} stepId
 * @param {Record<string, unknown>} input
 * @param {DerivedGeographyPipelineState} state
 * @param {PipelineStepOptions} options
 */
function executeLandmassPipelineStage(stepId, input, state, options) {
  switch (stepId) {
    case 'physicalTerrainBaseline':
      return runPhysicalTerrainBaselineStep(
        /** @type {import('./landmassPipelineStageContracts.js').PhysicalTerrainBaselineStageInput} */ (
          input
        ),
      )
    case 'erosion':
      return runErosionStep(
        /** @type {import('./landmassPipelineStageContracts.js').ErosionStageInput} */ (input),
      )
    case 'hydrology':
      return runHydrologyStep(
        /** @type {import('./landmassPipelineStageContracts.js').HydrologyStageInput} */ (input),
        state,
        options,
      )
    case 'fieldRefresh':
      return runFieldRefreshStep(
        /** @type {import('./landmassPipelineStageContracts.js').FieldRefreshStageInput} */ (input),
      )
    case 'coastAndResources':
      return runCoastAndResourcesStep(
        /** @type {import('./landmassPipelineStageContracts.js').CoastAndResourcesStageInput} */ (
          input
        ),
      )
    case 'validation':
      return runValidationStep(
        /** @type {import('./landmassPipelineStageContracts.js').ValidationStageInput} */ (input),
      )
    default:
      throw new Error(`Unknown pipeline step: ${stepId}`)
  }
}

/**
 * @param {DerivedGeographyPipelineState} state
 * @returns {import('./types.js').WorldDocument}
 */
export function buildWorldDocumentFromPipelineState(state) {
  const { width, height, geographySeed, prevailingWindDegrees } = state
  const baseline = state.baselineDoc
  if (!baseline) {
    throw new Error('Pipeline state missing baseline document')
  }

  const fields = state.fields ?? baseline.fields
  const biomes =
    state.biomes ??
    classifyBiomesFromFields(
      {
        ...baseline.fields,
        elevation: state.erodedElevation ?? baseline.fields.elevation,
      },
      width,
      height,
      state.options.seaLevel,
      geographySeed,
      state.options.biomeEdgeNoiseStrength,
    )

  const isComplete = state.lastCompletedStep === 'validation'

  return {
    geographySeed,
    prevailingWindDegrees,
    gridWidth: width,
    gridHeight: height,
    fields,
    biomes,
    biomeCatalog: BIOMES_CATALOG,
    generatedAt: baseline.generatedAt,
    pipelineStage: isComplete
      ? PIPELINE_STAGE_DERIVED_GEOGRAPHY
      : PIPELINE_STAGE_PHYSICAL_TERRAIN_BASELINE,
    riverGraph: state.riverGraph ?? undefined,
    lakes: state.lakes ?? undefined,
    lakeMeta: state.lakeMeta ?? undefined,
    lakeMask: state.lakeMask ?? undefined,
    riverNetworkMask: state.riverNetworkMask ?? undefined,
    riverCorridorMask: state.riverCorridorMask ?? undefined,
    channelWidth: state.channelWidth ?? undefined,
    flowDirection: state.flowDirection ?? undefined,
    coastNavigability: state.coastNavigability ?? undefined,
    coastalNodes: state.coastalNodes ?? undefined,
    saltNodes: state.saltNodes ?? undefined,
    metalsRaster: state.metalsRaster ?? undefined,
    metalNodes: state.metalNodes ?? undefined,
    arableRaster: state.arableRaster ?? undefined,
    timberRaster: state.timberRaster ?? undefined,
    generationReport: state.generationReport ?? undefined,
    erosionSnapshots: state.erosionSnapshots ?? undefined,
  }
}

/**
 * @param {number} geographySeed
 */
function normalizeGeographySeed(geographySeed) {
  const normalizedSeed = geographySeed | 0
  return normalizedSeed >= 0 ? normalizedSeed : normalizedSeed + 4294967296
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

class LandmassPipelineCancelledError extends Error {
  /**
   * @param {DerivedGeographyPipelineState | null} state
   */
  constructor(state) {
    super('Landmass pipeline cancelled')
    this.name = 'LandmassPipelineCancelledError'
    this.state = state
  }
}

/**
 * @typedef {Object} LandmassPipelineExecutionHooks
 * @property {() => boolean | Promise<boolean>} shouldCancel
 * @property {() => void | Promise<void>} [afterStep]
 */

/**
 * @param {unknown} value
 * @returns {value is Promise<unknown>}
 */
function isThenable(value) {
  return value != null && typeof /** @type {{ then?: unknown }} */ (value).then === 'function'
}

/**
 * @template T
 * @param {T | Promise<T>} value
 * @param {(resolved: T) => U} continuation
 * @param {(error: unknown) => V} [onError]
 * @returns {U | V | Promise<U | V>}
 * @template U
 * @template V
 */
function continuePipeline(value, continuation, onError) {
  if (isThenable(value)) {
    const next = value.then(continuation)
    return onError ? next.catch(onError) : next
  }
  try {
    return continuation(value)
  } catch (error) {
    if (onError) {
      return onError(error)
    }
    throw error
  }
}

/**
 * @param {LandmassPipelineRunCallbacks} callbacks
 * @returns {PipelineStepOptions | undefined}
 */
function createHydrologyStepOptions(callbacks) {
  return {
    onSubstepStart: callbacks.onSubstepStart,
    onSubstepProgress: callbacks.onSubstepProgress,
    onSubstepComplete: callbacks.onSubstepComplete,
    onSubstepPrepare: callbacks.onSubstepPrepare,
    shouldCancel: () => Boolean(callbacks.shouldCancel?.()),
  }
}

/**
 * @param {LandmassPipelineRunCallbacks} callbacks
 * @returns {LandmassPipelineExecutionHooks}
 */
function createSyncLandmassPipelineHooks(callbacks) {
  return {
    shouldCancel: () => Boolean(callbacks.shouldCancel?.()),
    afterStep: () => {},
  }
}

/**
 * @param {LandmassPipelineRunCallbacks} callbacks
 * @returns {LandmassPipelineExecutionHooks}
 */
function createCooperativeLandmassPipelineHooks(callbacks) {
  return {
    shouldCancel: async () => Boolean(await callbacks.shouldCancel?.()),
    afterStep: async () => {
      await callbacks.yield?.()
    },
  }
}

/**
 * Shared step runner for sync (`runLandmassPipelineRun`) and worker (`runLandmassPipeline`).
 * @param {DerivedGeographyPipelineState} state
 * @param {LandmassPipelineRunCallbacks} callbacks
 * @param {import('./types.js').WorldGenerationOptions} options
 * @param {LandmassPipelineExecutionHooks} hooks
 * @returns {DerivedGeographyPipelineState | Promise<DerivedGeographyPipelineState>}
 */
function runLandmassPipelineStepsShared(state, callbacks, options, hooks) {
  const stepCount = DERIVED_GEOGRAPHY_STEPS.length

  /**
   * @param {number} stepIndex
   * @param {DerivedGeographyPipelineState} currentState
   */
  const runFromStep = (stepIndex, currentState) => {
    if (stepIndex >= stepCount) {
      return currentState
    }

    return continuePipeline(
      hooks.shouldCancel(),
      (isCancelled) => {
        if (isCancelled) {
          throw new LandmassPipelineCancelledError(currentState)
        }

        const step = DERIVED_GEOGRAPHY_STEPS[stepIndex]
        callbacks.onStepStart?.({
          stepId: step.id,
          stepIndex,
          stepCount,
          label: step.label,
        })

        let nextState
        const stepOptions =
          step.id === 'hydrology' ? createHydrologyStepOptions(callbacks) : undefined
        nextState = runPipelineStep(currentState, step.id, stepOptions)

        return continuePipeline(hooks.shouldCancel(), (isCancelledAfterStep) => {
          if (isCancelledAfterStep) {
            throw new LandmassPipelineCancelledError(nextState)
          }

          const worldDocument = shouldAttachLandmassStepPreview(step.id, options)
            ? cloneWorldDocument(buildWorldDocumentFromPipelineState(nextState))
            : undefined

          callbacks.onStepComplete?.({
            stepId: step.id,
            stepIndex,
            stepCount,
            label: step.label,
            state: nextState,
            worldDocument,
          })

          return continuePipeline(hooks.afterStep?.() ?? undefined, () =>
            runFromStep(stepIndex + 1, nextState),
          )
        })
      },
    )
  }

  return runFromStep(0, state)
}

/**
 * @param {DerivedGeographyPipelineState | null} state
 * @param {unknown} error
 * @param {LandmassPipelineExecutionHooks} hooks
 * @returns {LandmassPipelineRunResult | Promise<LandmassPipelineRunResult>}
 */
function finalizeLandmassPipelineRun(state, error, hooks) {
  if (error instanceof LandmassPipelineCancelledError) {
    return {
      status: 'cancelled',
      state: error.state,
      worldDocument: null,
      errorMessage: null,
    }
  }

  return continuePipeline(hooks.shouldCancel(), (isCancelled) => {
    if (isCancelled) {
      return { status: 'cancelled', state, worldDocument: null, errorMessage: null }
    }
    return {
      status: 'error',
      state,
      worldDocument: null,
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  })
}

/**
 * Shared validation-retry runner for sync (`runLandmassPipelineRun`) and worker (`runLandmassPipeline`).
 * @param {import('./types.js').DerivedGeographyParams} params
 * @param {LandmassPipelineRunCallbacks} callbacks
 * @param {LandmassPipelineExecutionHooks} hooks
 * @returns {LandmassPipelineRunResult | Promise<LandmassPipelineRunResult>}
 */
function runLandmassPipelineWithRetryShared(params, callbacks, hooks) {
  const options = resolveWorldGenerationOptions(params.options)
  const maxValidationRetries = options.maxValidationRetries
  const baseSeed = params.geographySeed | 0

  /** @type {DerivedGeographyPipelineState | null} */
  let state = null

  /**
   * @param {number} attempt
   */
  const runAttempt = (attempt) => {
    if (attempt > maxValidationRetries) {
      const worldDocument = cloneWorldDocument(buildWorldDocumentFromPipelineState(state))
      return {
        status: 'success',
        state,
        worldDocument,
        errorMessage: null,
      }
    }

    return continuePipeline(
      hooks.shouldCancel(),
      (isCancelled) => {
        if (isCancelled) {
          return { status: 'cancelled', state, worldDocument: null, errorMessage: null }
        }

        const attemptParams = {
          ...params,
          geographySeed: normalizeGeographySeed(baseSeed + attempt),
          options,
        }
        state = createInitialPipelineState(attemptParams)
        return continuePipeline(
          runLandmassPipelineStepsShared(state, callbacks, options, hooks),
          (completedState) => {
            state = completedState
            if (!state.generationReport?.shouldReject) {
              const worldDocument = cloneWorldDocument(buildWorldDocumentFromPipelineState(state))
              return {
                status: 'success',
                state,
                worldDocument,
                errorMessage: null,
              }
            }
            return runAttempt(attempt + 1)
          },
          (error) => finalizeLandmassPipelineRun(state, error, hooks),
        )
      },
      (error) => finalizeLandmassPipelineRun(state, error, hooks),
    )
  }

  return runAttempt(0)
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
  if (result.status !== 'success' || !result.worldDocument) {
    throw new Error(result.errorMessage ?? 'Landmass pipeline failed')
  }
  return result.worldDocument
}

/**
 * @param {import('./landmassPipelineStageContracts.js').PhysicalTerrainBaselineStageInput} input
 */
function runPhysicalTerrainBaselineStep(input) {
  const baselineDoc = generatePhysicalTerrainBaseline({
    geographySeed: input.geographySeed,
    prevailingWindDegrees: input.prevailingWindDegrees,
    width: input.width,
    height: input.height,
    options: input.options,
  })
  return {
    baselineDoc,
    fields: baselineDoc.fields,
    biomes: baselineDoc.biomes,
    lastCompletedStep: /** @type {const} */ ('physicalTerrainBaseline'),
  }
}

/**
 * @param {import('./landmassPipelineStageContracts.js').ErosionStageInput} input
 */
function runErosionStep(input) {
  const { elevation: erodedElevation, snapshots, stepCount } = applyErosion({
    elevation: input.baselineDoc.fields.elevation,
    width: input.width,
    height: input.height,
    geographySeed: input.geographySeed,
    options: input.options,
  })
  const previewFields = {
    ...input.baselineDoc.fields,
    elevation: erodedElevation,
  }
  return {
    erodedElevation,
    erosionSnapshots: snapshots,
    erosionStepCount: stepCount,
    workingElevation: erodedElevation,
    fields: previewFields,
    biomes: classifyBiomesFromFields(
      previewFields,
      input.width,
      input.height,
      input.options.seaLevel,
      input.geographySeed,
      input.options.biomeEdgeNoiseStrength,
    ),
    lastCompletedStep: /** @type {const} */ ('erosion'),
  }
}

/**
 * @param {import('./landmassPipelineStageContracts.js').HydrologyStageInput} input
 * @param {DerivedGeographyPipelineState} state
 * @param {PipelineStepOptions} [options]
 */
function runHydrologyStep(input, state, options = {}) {
  const hydrologyState = {
    ...state,
    baselineDoc: input.baselineDoc,
    erodedElevation: input.erodedElevation,
    fields: input.fields,
  }
  const { state: nextState, timings } = runHydrologySubsteps(hydrologyState, {
    onSubstepStart: options.onSubstepStart,
    onSubstepProgress: options.onSubstepProgress,
    onSubstepComplete: options.onSubstepComplete,
    onSubstepPrepare: options.onSubstepPrepare,
    shouldCancel: options.shouldCancel,
  })
  return {
    lakeMask: nextState.lakeMask,
    lakes: nextState.lakes,
    lakeMeta: nextState.lakeMeta,
    lakeIdByCell: nextState.lakeIdByCell,
    hydrologyStats: nextState.hydrologyStats,
    workingElevation: nextState.workingElevation,
    riverGraph: nextState.riverGraph,
    riverNetworkMask: nextState.riverNetworkMask,
    riverCorridorMask: nextState.riverCorridorMask,
    channelWidth: nextState.channelWidth,
    flowDirection: nextState.flowDirection,
    fields: nextState.fields,
    biomes: nextState.biomes,
    hydrologySubstepTimings: timings,
    lastCompletedStep: /** @type {const} */ ('hydrology'),
  }
}

/**
 * @param {import('./landmassPipelineStageContracts.js').FieldRefreshStageInput} input
 */
function runFieldRefreshStep(input) {
  const { width, height } = input
  const refreshed = refreshFieldsAfterErosion({
    geographySeed: input.geographySeed,
    prevailingWindDegrees: input.prevailingWindDegrees,
    elevation: input.workingElevation,
    drainage: input.fields.drainage,
    width,
    height,
    options: input.options,
  })
  let fields = refreshed
  if (input.options.enableSeasonalHydrology) {
    const annualClimate = deriveAnnualMeanClimate({
      baseRainfall: refreshed.rainfall,
      baseTemperature: refreshed.temperature,
      options: input.options,
    })
    fields = {
      ...refreshed,
      rainfall: annualClimate.rainfall,
      temperature: annualClimate.temperature,
    }
  }
  const biomes = classifyBiomesWithHydrology(fields, width, height, {
    lakeMask: input.lakeMask,
    riverCorridorMask: input.riverCorridorMask ?? input.riverNetworkMask,
    flowDirection: input.flowDirection,
  }, input.options.seaLevel, input.geographySeed, input.options.biomeEdgeNoiseStrength)
  return {
    fields,
    biomes,
    lastCompletedStep: /** @type {const} */ ('fieldRefresh'),
  }
}

/**
 * @param {import('./landmassPipelineStageContracts.js').CoastAndResourcesStageInput} input
 */
function runCoastAndResourcesStep(input) {
  const { width, height } = input
  const coastNavigability = computeCoastNavigability({
    elevation: input.workingElevation,
    width,
    height,
    seaLevel: input.options.seaLevel,
  })
  const coastalNodes = deriveCoastalNodes({
    riverGraph: input.riverGraph,
    coastNavigability,
    elevation: input.workingElevation,
    width,
    height,
    seaLevel: input.options.seaLevel,
  })
  const saltNodes = placeSaltNodes({
    elevation: input.workingElevation,
    salinity: input.fields.salinity,
    coastNavigability,
    biomes: input.biomes,
    lakes: input.lakes,
    width,
    height,
    geographySeed: input.geographySeed,
    maxNodes: input.options.maxSaltNodes,
    seaLevel: input.options.seaLevel,
  })
  const arableRaster = generateArableRaster({
    elevation: input.workingElevation,
    temperature: input.fields.temperature,
    rainfall: input.fields.rainfall,
    drainage: input.fields.drainage,
    biomes: input.biomes,
    riverCorridorMask: input.riverCorridorMask ?? input.riverNetworkMask,
    riverNetworkMask: input.riverNetworkMask ?? undefined,
    channelWidth: input.channelWidth ?? undefined,
    width,
    height,
    geographySeed: input.geographySeed,
    seaLevel: input.options.seaLevel,
  })
  const metalsRaster = computeMetalsRaster({
    elevation: input.workingElevation,
    biomes: input.biomes,
    drainage: input.fields.drainage,
    riverNetworkMask: input.riverNetworkMask ?? undefined,
    width,
    height,
    seaLevel: input.options.seaLevel,
  })
  const metalNodes = placeMetalNodes({
    metalsRaster,
    elevation: input.workingElevation,
    width,
    height,
    geographySeed: input.geographySeed,
    maxNodes: input.options.maxMetalNodes,
    seaLevel: input.options.seaLevel,
  })
  const timberRaster = generateTimberProductivity({
    fields: input.fields,
    biomes: input.biomes,
    width,
    height,
    geographySeed: input.geographySeed,
  })
  return {
    coastNavigability,
    coastalNodes,
    saltNodes,
    arableRaster,
    metalsRaster,
    metalNodes,
    timberRaster,
    lastCompletedStep: /** @type {const} */ ('coastAndResources'),
  }
}

/**
 * @param {import('./landmassPipelineStageContracts.js').ValidationStageInput} input
 */
function runValidationStep(input) {
  const riverNetwork = assembleRiverNetworkFromFields({
    riverNetworkMask: input.riverNetworkMask,
    riverCorridorMask: input.riverCorridorMask,
    flowDirection: input.flowDirection,
    flowAccumulation: input.fields.drainage,
    channelWidth: input.channelWidth ?? undefined,
    riverGraph: input.riverGraph,
    width: input.width,
    height: input.height,
  })
  const generationReport = buildGenerationReport({
    erosionStepCount: input.erosionStepCount,
    riverGraph: input.riverGraph,
    riverNetwork,
    coastalNodes: input.coastalNodes,
    fields: input.fields,
    biomes: input.biomes,
    gridWidth: input.width,
    gridHeight: input.height,
    hydrologySubstepTimings: input.hydrologySubstepTimings ?? [],
    hydrologyStats: input.hydrologyStats ?? {
      breachCount: 0,
      endorheicCount: 0,
      endorheicFraction: 0,
      lakeCount: 0,
    },
    prevailingWindDegrees: input.prevailingWindDegrees,
    validationOptions: input.options,
  })
  return {
    generationReport,
    lastCompletedStep: /** @type {const} */ ('validation'),
  }
}

/**
 * @param {number} degrees
 */
function normalizeWindDegrees(degrees) {
  const rounded = Math.round(degrees)
  return ((rounded % 360) + 360) % 360
}

/**
 * Clone typed arrays so worker postMessage copies are independent on the main thread.
 * @param {import('./types.js').WorldDocument} doc
 * @returns {import('./types.js').WorldDocument}
 */
export function cloneWorldDocument(doc) {
  const fields = {
    elevation: new Float32Array(doc.fields.elevation),
    temperature: new Float32Array(doc.fields.temperature),
    rainfall: new Float32Array(doc.fields.rainfall),
    drainage: new Float32Array(doc.fields.drainage),
    salinity: new Float32Array(doc.fields.salinity),
  }
  return {
    ...doc,
    fields,
    biomes: new Uint8Array(doc.biomes),
    lakeMask: doc.lakeMask ? new Uint8Array(doc.lakeMask) : undefined,
    riverNetworkMask: doc.riverNetworkMask ? new Uint8Array(doc.riverNetworkMask) : undefined,
    riverCorridorMask: doc.riverCorridorMask ? new Uint8Array(doc.riverCorridorMask) : undefined,
    channelWidth: doc.channelWidth ? new Float32Array(doc.channelWidth) : undefined,
    flowDirection: doc.flowDirection ? new Int16Array(doc.flowDirection) : undefined,
    coastNavigability: doc.coastNavigability
      ? new Float32Array(doc.coastNavigability)
      : undefined,
    erosionSnapshots: doc.erosionSnapshots?.map((snapshot) => new Float32Array(snapshot)),
    riverGraph: doc.riverGraph
      ? {
          nodes: doc.riverGraph.nodes.map((node) => ({ ...node })),
          edges: doc.riverGraph.edges.map((edge) => ({
            ...edge,
            cellPath: edge.cellPath ? [...edge.cellPath] : undefined,
          })),
        }
      : undefined,
    lakes: doc.lakes?.map((lake) => ({ ...lake })),
    lakeMeta: doc.lakeMeta?.map((meta) => ({ ...meta })),
    coastalNodes: doc.coastalNodes?.map((node) => ({ ...node })),
    saltNodes: doc.saltNodes?.map((node) => ({ ...node })),
    metalsRaster: doc.metalsRaster ? new Float32Array(doc.metalsRaster) : undefined,
    metalNodes: doc.metalNodes?.map((node) => ({ ...node })),
    arableRaster: doc.arableRaster ? new Float32Array(doc.arableRaster) : undefined,
    timberRaster: doc.timberRaster ? new Float32Array(doc.timberRaster) : undefined,
    generationReport: doc.generationReport
      ? {
          ...doc.generationReport,
          validationRows: doc.generationReport.validationRows.map((row) => ({ ...row })),
          rejectionReasons: [...doc.generationReport.rejectionReasons],
          structuredRejectionReasons: doc.generationReport.structuredRejectionReasons.map(
            (row) => ({ ...row }),
          ),
          validationSignals: {
            hydrology: { ...doc.generationReport.validationSignals.hydrology },
            coast: { ...doc.generationReport.validationSignals.coast },
            climate: { ...doc.generationReport.validationSignals.climate },
            resources: { ...doc.generationReport.validationSignals.resources },
            landmassPlausibility: {
              ...doc.generationReport.validationSignals.landmassPlausibility,
            },
            movement: { ...doc.generationReport.validationSignals.movement },
          },
          hydrologySubstepTimings: doc.generationReport.hydrologySubstepTimings.map((row) => ({
            ...row,
          })),
          hydrology: { ...doc.generationReport.hydrology },
        }
      : undefined,
  }
}
