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
import { generatePhysicalTerrainBaseline } from './generatePhysicalTerrainBaseline.js'
import { runHydrologySubsteps } from './hydrology/hydrologySubsteps.js'
import { placeSaltNodes } from './resources/placeSaltNodes.js'
import {
  DEFAULT_GRID_SIZE,
  PIPELINE_STAGE_DERIVED_GEOGRAPHY,
  PIPELINE_STAGE_PHYSICAL_TERRAIN_BASELINE,
} from './types.js'
import { resolveWorldGenerationOptions } from './worldGenerationOptions.js'

/** @typedef {'physicalTerrainBaseline' | 'erosion' | 'hydrology' | 'fieldRefresh' | 'coastAndResources' | 'validation'} DerivedGeographyStepId */

/** @type {ReadonlyArray<{ id: DerivedGeographyStepId, label: string }>} */
export const DERIVED_GEOGRAPHY_STEPS = [
  { id: 'physicalTerrainBaseline', label: 'Physical terrain baseline' },
  { id: 'erosion', label: 'Erosion' },
  { id: 'hydrology', label: 'Hydrology' },
  { id: 'fieldRefresh', label: 'Climate field refresh' },
  { id: 'coastAndResources', label: 'Coast and salt nodes' },
  { id: 'validation', label: 'Geography validation' },
]

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
 * @property {import('./types.js').HydrologyPipelineStats | null} hydrologyStats
 * @property {Float32Array | null} workingElevation
 * @property {import('./types.js').RiverGraph | null} riverGraph
 * @property {Uint8Array | null} riverNetworkMask
 * @property {Float32Array | null} channelWidth
 * @property {import('./types.js').ScalarFields | null} fields
 * @property {Uint8Array | null} biomes
 * @property {Float32Array | null} coastNavigability
 * @property {import('./types.js').CoastalNode[] | null} coastalNodes
 * @property {import('./types.js').SaltNode[] | null} saltNodes
 * @property {import('./types.js').GenerationReport | null} generationReport
 * @property {import('./hydrology/hydrologySubsteps.js').HydrologySubstepTiming[] | null} hydrologySubstepTimings
 * @property {DerivedGeographyStepId | null} lastCompletedStep
 */

/**
 * @typedef {Object} PipelineStepOptions
 * @property {(payload: { substepId: string, substepIndex: number, substepCount: number, label: string }) => void} [onSubstepStart]
 * @property {(payload: { substepId: string, substepIndex: number, substepCount: number, label: string, progress: number }) => void} [onSubstepProgress]
 * @property {(payload: { substepId: string, substepIndex: number, substepCount: number, label: string, progress: number }) => void} [onSubstepComplete]
 * @property {() => boolean} [shouldCancel]
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
    hydrologyStats: null,
    workingElevation: null,
    riverGraph: null,
    riverNetworkMask: null,
    channelWidth: null,
    fields: null,
    biomes: null,
    coastNavigability: null,
    coastalNodes: null,
    saltNodes: null,
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
  switch (stepId) {
    case 'physicalTerrainBaseline':
      return runPhysicalTerrainBaselineStep(state)
    case 'erosion':
      return runErosionStep(state)
    case 'hydrology':
      return runHydrologyStep(state, options)
    case 'fieldRefresh':
      return runFieldRefreshStep(state)
    case 'coastAndResources':
      return runCoastAndResourcesStep(state)
    case 'validation':
      return runValidationStep(state)
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
    channelWidth: state.channelWidth ?? undefined,
    coastNavigability: state.coastNavigability ?? undefined,
    coastalNodes: state.coastalNodes ?? undefined,
    saltNodes: state.saltNodes ?? undefined,
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
 * @param {import('./types.js').DerivedGeographyParams} params
 * @returns {import('./types.js').WorldDocument}
 */
export function runFullDerivedGeographyPipeline(params) {
  const options = resolveWorldGenerationOptions(params.options)
  const maxValidationRetries = options.maxValidationRetries
  const baseSeed = params.geographySeed | 0

  /** @type {import('./types.js').WorldDocument | null} */
  let lastDoc = null
  for (let attempt = 0; attempt <= maxValidationRetries; attempt += 1) {
    const attemptParams = {
      ...params,
      geographySeed: normalizeGeographySeed(baseSeed + attempt),
      options,
    }
    let state = createInitialPipelineState(attemptParams)
    for (const step of DERIVED_GEOGRAPHY_STEPS) {
      state = runPipelineStep(state, step.id)
    }
    lastDoc = buildWorldDocumentFromPipelineState(state)
    if (!lastDoc.generationReport?.shouldReject) {
      return lastDoc
    }
  }
  return lastDoc
}

/**
 * @param {DerivedGeographyPipelineState} state
 */
function runPhysicalTerrainBaselineStep(state) {
  const baselineDoc = generatePhysicalTerrainBaseline({
    geographySeed: state.geographySeed,
    prevailingWindDegrees: state.prevailingWindDegrees,
    width: state.width,
    height: state.height,
    options: state.options,
  })
  return {
    ...state,
    baselineDoc,
    fields: baselineDoc.fields,
    biomes: baselineDoc.biomes,
    lastCompletedStep: 'physicalTerrainBaseline',
  }
}

/**
 * @param {DerivedGeographyPipelineState} state
 */
function runErosionStep(state) {
  if (!state.baselineDoc) throw new Error('Baseline required before erosion')
  const { elevation: erodedElevation, snapshots, stepCount } = applyErosion({
    elevation: state.baselineDoc.fields.elevation,
    width: state.width,
    height: state.height,
    geographySeed: state.geographySeed,
    options: state.options,
  })
  const previewFields = {
    ...state.baselineDoc.fields,
    elevation: erodedElevation,
  }
  return {
    ...state,
    erodedElevation,
    erosionSnapshots: snapshots,
    erosionStepCount: stepCount,
    workingElevation: erodedElevation,
    fields: previewFields,
    biomes: classifyBiomesFromFields(previewFields, state.width, state.height, state.options.seaLevel),
    lastCompletedStep: 'erosion',
  }
}

/**
 * @param {DerivedGeographyPipelineState} state
 * @param {PipelineStepOptions} [options]
 */
function runHydrologyStep(state, options = {}) {
  const { state: nextState, timings } = runHydrologySubsteps(state, {
    onSubstepStart: options.onSubstepStart,
    onSubstepProgress: options.onSubstepProgress,
    onSubstepComplete: options.onSubstepComplete,
    shouldCancel: options.shouldCancel,
  })
  return {
    ...nextState,
    hydrologySubstepTimings: timings,
  }
}

/**
 * @param {DerivedGeographyPipelineState} state
 */
function runFieldRefreshStep(state) {
  if (!state.workingElevation || !state.lakeMask || !state.riverNetworkMask) {
    throw new Error('Hydrology required before field refresh')
  }
  const { width, height } = state
  const drainage = state.fields?.drainage
  if (!drainage) throw new Error('Flow drainage required before field refresh')

  const fields = refreshFieldsAfterErosion({
    geographySeed: state.geographySeed,
    prevailingWindDegrees: state.prevailingWindDegrees,
    elevation: state.workingElevation,
    drainage,
    width,
    height,
    options: state.options,
  })
  const biomes = classifyBiomesWithHydrology(fields, width, height, {
    lakeMask: state.lakeMask,
    riverCorridorMask: state.riverNetworkMask,
    channelWidth: state.channelWidth ?? undefined,
  }, state.options.seaLevel)
  return {
    ...state,
    fields,
    biomes,
    lastCompletedStep: 'fieldRefresh',
  }
}

/**
 * @param {DerivedGeographyPipelineState} state
 */
function runCoastAndResourcesStep(state) {
  if (!state.workingElevation || !state.fields || !state.riverGraph) {
    throw new Error('Field refresh required before coast and resources')
  }
  const { width, height } = state
  const coastNavigability = computeCoastNavigability({
    elevation: state.workingElevation,
    width,
    height,
    seaLevel: state.options.seaLevel,
  })
  const coastalNodes = deriveCoastalNodes({
    riverGraph: state.riverGraph,
    coastNavigability,
    elevation: state.workingElevation,
    width,
    height,
    seaLevel: state.options.seaLevel,
  })
  const saltNodes = placeSaltNodes({
    elevation: state.workingElevation,
    salidity: state.fields.salidity,
    coastNavigability,
    lakes: state.lakes ?? [],
    width,
    height,
    geographySeed: state.geographySeed,
    maxNodes: state.options.maxSaltNodes,
    seaLevel: state.options.seaLevel,
  })
  return {
    ...state,
    coastNavigability,
    coastalNodes,
    saltNodes,
    lastCompletedStep: 'coastAndResources',
  }
}

/**
 * @param {DerivedGeographyPipelineState} state
 */
function runValidationStep(state) {
  if (!state.fields || !state.biomes || !state.riverGraph || !state.coastalNodes) {
    throw new Error('Coast and resources required before validation')
  }
  const generationReport = buildGenerationReport({
    erosionStepCount: state.erosionStepCount,
    riverGraph: state.riverGraph,
    coastalNodes: state.coastalNodes,
    fields: state.fields,
    biomes: state.biomes,
    gridWidth: state.width,
    gridHeight: state.height,
    hydrologySubstepTimings: state.hydrologySubstepTimings ?? [],
    hydrologyStats: state.hydrologyStats ?? {
      breachCount: 0,
      endorheicCount: 0,
      endorheicFraction: 0,
      lakeCount: 0,
    },
    riverNetworkMask: state.riverNetworkMask ?? undefined,
    validationOptions: state.options,
  })
  return {
    ...state,
    generationReport,
    lastCompletedStep: 'validation',
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
    salidity: new Float32Array(doc.fields.salidity),
  }
  return {
    ...doc,
    fields,
    biomes: new Uint8Array(doc.biomes),
    lakeMask: doc.lakeMask ? new Uint8Array(doc.lakeMask) : undefined,
    riverNetworkMask: doc.riverNetworkMask ? new Uint8Array(doc.riverNetworkMask) : undefined,
    channelWidth: doc.channelWidth ? new Float32Array(doc.channelWidth) : undefined,
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
    generationReport: doc.generationReport
      ? {
          ...doc.generationReport,
          validationRows: doc.generationReport.validationRows.map((row) => ({ ...row })),
          rejectionReasons: [...doc.generationReport.rejectionReasons],
          hydrologySubstepTimings: doc.generationReport.hydrologySubstepTimings.map((row) => ({
            ...row,
          })),
          hydrology: { ...doc.generationReport.hydrology },
        }
      : undefined,
  }
}
