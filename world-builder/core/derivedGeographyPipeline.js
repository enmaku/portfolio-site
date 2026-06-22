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
import {
  buildRiverGraph,
} from './hydrology/buildRiverGraph.js'
import { buildRiverNetworkMask } from './hydrology/buildRiverNetworkMask.js'
import {
  connectNearbyRiverCorridors,
  riverAttractionRadiusForGrid,
} from './hydrology/connectNearbyRiverCorridors.js'
import { computeFlowAccumulation } from './hydrology/computeFlowAccumulation.js'
import { deriveDrainageFromFlow } from './hydrology/deriveDrainageFromFlow.js'
import {
  deriveSnowCapMask,
  deriveSnowMeltContribution,
} from './hydrology/deriveSnowCapMask.js'
import { fillLakes } from './hydrology/fillLakes.js'
import {
  meanderAndSettleRivers,
  riverSettlementStepsForGrid,
} from './hydrology/meanderAndSettleRivers.js'
import { generateTemperature } from './fields/generateTemperature.js'
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
 * @property {Float32Array | null} workingElevation
 * @property {import('./types.js').RiverGraph | null} riverGraph
 * @property {Uint8Array | null} riverNetworkMask
 * @property {import('./types.js').ScalarFields | null} fields
 * @property {Uint8Array | null} biomes
 * @property {Float32Array | null} coastNavigability
 * @property {import('./types.js').CoastalNode[] | null} coastalNodes
 * @property {import('./types.js').SaltNode[] | null} saltNodes
 * @property {import('./types.js').GenerationReport | null} generationReport
 * @property {DerivedGeographyStepId | null} lastCompletedStep
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
    workingElevation: null,
    riverGraph: null,
    riverNetworkMask: null,
    fields: null,
    biomes: null,
    coastNavigability: null,
    coastalNodes: null,
    saltNodes: null,
    generationReport: null,
    lastCompletedStep: null,
  }
}

/**
 * @param {DerivedGeographyPipelineState} state
 * @param {DerivedGeographyStepId} stepId
 * @returns {DerivedGeographyPipelineState}
 */
export function runPipelineStep(state, stepId) {
  switch (stepId) {
    case 'physicalTerrainBaseline':
      return runPhysicalTerrainBaselineStep(state)
    case 'erosion':
      return runErosionStep(state)
    case 'hydrology':
      return runHydrologyStep(state)
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
    lakeMask: state.lakeMask ?? undefined,
    riverNetworkMask: state.riverNetworkMask ?? undefined,
    coastNavigability: state.coastNavigability ?? undefined,
    coastalNodes: state.coastalNodes ?? undefined,
    saltNodes: state.saltNodes ?? undefined,
    generationReport: state.generationReport ?? undefined,
    erosionSnapshots: state.erosionSnapshots ?? undefined,
  }
}

/**
 * @param {import('./types.js').DerivedGeographyParams} params
 * @returns {import('./types.js').WorldDocument}
 */
export function runFullDerivedGeographyPipeline(params) {
  let state = createInitialPipelineState(params)
  for (const step of DERIVED_GEOGRAPHY_STEPS) {
    state = runPipelineStep(state, step.id)
  }
  return buildWorldDocumentFromPipelineState(state)
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
 */
function runHydrologyStep(state) {
  if (!state.erodedElevation) throw new Error('Erosion required before hydrology')
  const { width, height } = state
  const { ocean } = computeFlowAccumulation({
    elevation: state.erodedElevation,
    width,
    height,
    seaLevel: state.options.seaLevel,
  })
  const { lakeMask, lakes, filledElevation } = fillLakes({
    elevation: state.erodedElevation,
    width,
    height,
    ocean,
    seaLevel: state.options.seaLevel,
    minLakeAreaScale: state.options.minLakeAreaScale,
  })
  const temperature = generateTemperature({
    geographySeed: state.geographySeed,
    width,
    height,
    elevation: state.erodedElevation,
    options: state.options,
  })
  const snowCapMask = deriveSnowCapMask({
    elevation: state.erodedElevation,
    temperature,
    width,
    height,
    seaLevel: state.options.seaLevel,
  })
  const meltContribution = deriveSnowMeltContribution({
    elevation: state.erodedElevation,
    temperature,
    snowCapMask,
    width,
    height,
    prevailingWindDegrees: state.prevailingWindDegrees,
  })
  const soilDrainage = state.baselineDoc?.fields.drainage ?? state.fields?.drainage
  const { flowDirection, flowAccumulation, ocean: lakeOcean } = computeFlowAccumulation({
    elevation: filledElevation,
    width,
    height,
    seaLevel: state.options.seaLevel,
    meltContribution,
    soilDrainage,
    soilDrainageScale: state.options.soilDrainageScale,
  })
  const baseRiverNetworkMask = buildRiverNetworkMask({
    flowAccumulation,
    flowDirection,
    ocean: lakeOcean,
    lakeMask,
    width,
    height,
    meltContribution,
    navigableFlowCutoffScale: state.options.navigableFlowCutoffScale,
  })
  const riverNetworkMask = connectNearbyRiverCorridors({
    riverNetworkMask: baseRiverNetworkMask,
    elevation: filledElevation,
    ocean: lakeOcean,
    width,
    height,
    geographySeed: state.geographySeed,
    flowDirection,
    attractionRadius: riverAttractionRadiusForGrid(
      width,
      state.options.riverAttractionRadiusScale,
    ),
  })
  const meandered = meanderAndSettleRivers({
    riverNetworkMask,
    elevation: filledElevation,
    ocean: lakeOcean,
    flowDirection,
    flowAccumulation,
    width,
    height,
    geographySeed: state.geographySeed,
    meanderStrength: state.options.riverMeanderStrength,
    settlementStepCount: riverSettlementStepsForGrid(
      width,
      state.options.riverSettlementSteps,
    ),
    mergeStrength: state.options.riverMergeStrength,
    channelWear: state.options.erosionChannelWear * 0.85,
    seaLevel: state.options.seaLevel,
  })
  const settledElevation = meandered.elevation
  const settledRiverNetworkMask = connectNearbyRiverCorridors({
    riverNetworkMask: meandered.riverNetworkMask,
    elevation: settledElevation,
    ocean: lakeOcean,
    width,
    height,
    geographySeed: state.geographySeed,
    flowDirection,
    attractionRadius: riverAttractionRadiusForGrid(
      width,
      state.options.riverAttractionRadiusScale,
    ),
  })
  const {
    flowDirection: settledFlowDirection,
    flowAccumulation: settledFlowAccumulation,
    ocean: settledOcean,
  } = computeFlowAccumulation({
    elevation: settledElevation,
    width,
    height,
    seaLevel: state.options.seaLevel,
    meltContribution,
    soilDrainage,
    soilDrainageScale: state.options.soilDrainageScale,
  })
  const settledDrainage = deriveDrainageFromFlow(settledFlowAccumulation)
  const settledRiverGraph = buildRiverGraph({
    elevation: settledElevation,
    flowAccumulation: settledFlowAccumulation,
    flowDirection: settledFlowDirection,
    ocean: settledOcean,
    lakeMask,
    width,
    height,
    navigableFlowCutoffScale: state.options.navigableFlowCutoffScale,
  })
  const previewFields = {
    ...(state.fields ?? state.baselineDoc.fields),
    elevation: settledElevation,
    drainage: settledDrainage,
  }
  return {
    ...state,
    lakeMask,
    lakes,
    workingElevation: settledElevation,
    riverGraph: settledRiverGraph,
    riverNetworkMask: settledRiverNetworkMask,
    fields: previewFields,
    biomes: classifyBiomesWithHydrology(previewFields, width, height, {
      lakeMask,
      riverCorridorMask: settledRiverNetworkMask,
    }, state.options.seaLevel),
    lastCompletedStep: 'hydrology',
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
    coastalNodes: doc.coastalNodes?.map((node) => ({ ...node })),
    saltNodes: doc.saltNodes?.map((node) => ({ ...node })),
    generationReport: doc.generationReport
      ? {
          ...doc.generationReport,
          validationRows: doc.generationReport.validationRows.map((row) => ({ ...row })),
        }
      : undefined,
  }
}
