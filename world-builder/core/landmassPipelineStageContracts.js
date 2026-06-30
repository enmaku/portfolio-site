/** @typedef {import('./landmassPipelineTypes.js').DerivedGeographyPipelineState} DerivedGeographyPipelineState */
/** @typedef {import('./landmassPipelineTypes.js').LandmassPipelineStepId} LandmassPipelineStepId */

/** @typedef {import('./types.js').WorldGenerationOptions} WorldGenerationOptions */

import {
  LANDMASS_PIPELINE_STEP_IDS,
} from './landmassPipelineTypes.js'

export { LANDMASS_PIPELINE_STEP_IDS }

/**
 * Shared generation parameters carried by every landmass pipeline stage.
 * @typedef {Object} LandmassPipelineParams
 * @property {number} geographySeed
 * @property {number} prevailingWindDegrees
 * @property {WorldGenerationOptions} options
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {Object} PhysicalTerrainBaselineStageInput
 * @property {number} geographySeed
 * @property {number} prevailingWindDegrees
 * @property {WorldGenerationOptions} options
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {Object} ErosionStageInput
 * @property {number} geographySeed
 * @property {number} prevailingWindDegrees
 * @property {WorldGenerationOptions} options
 * @property {number} width
 * @property {number} height
 * @property {import('./types.js').WorldDocument} baselineDoc
 */

/**
 * @typedef {Object} HydrologyStageInput
 * @property {number} geographySeed
 * @property {number} prevailingWindDegrees
 * @property {WorldGenerationOptions} options
 * @property {number} width
 * @property {number} height
 * @property {import('./types.js').WorldDocument} baselineDoc
 * @property {Float32Array} erodedElevation
 * @property {import('./types.js').ScalarFields | null} fields
 */

/**
 * @typedef {Object} FieldRefreshStageInput
 * @property {number} geographySeed
 * @property {number} prevailingWindDegrees
 * @property {WorldGenerationOptions} options
 * @property {number} width
 * @property {number} height
 * @property {Float32Array} workingElevation
 * @property {Uint8Array} lakeMask
 * @property {Uint8Array} riverNetworkMask
 * @property {import('./types.js').ScalarFields} fields
 * @property {Uint8Array | null} riverCorridorMask
 * @property {Int16Array | null} flowDirection
 */

/**
 * @typedef {Object} CoastAndResourcesStageInput
 * @property {number} geographySeed
 * @property {WorldGenerationOptions} options
 * @property {number} width
 * @property {number} height
 * @property {Float32Array} workingElevation
 * @property {import('./types.js').ScalarFields} fields
 * @property {import('./types.js').RiverGraph} riverGraph
 * @property {Uint8Array} biomes
 * @property {import('./types.js').LakeRecord[]} lakes
 * @property {Uint8Array | null} riverCorridorMask
 * @property {Uint8Array | null} riverNetworkMask
 * @property {Float32Array | null} channelWidth
 */

/**
 * @typedef {Object} ValidationStageInput
 * @property {number} prevailingWindDegrees
 * @property {WorldGenerationOptions} options
 * @property {number} width
 * @property {number} height
 * @property {number} erosionStepCount
 * @property {import('./types.js').ScalarFields} fields
 * @property {Uint8Array} biomes
 * @property {import('./types.js').RiverGraph} riverGraph
 * @property {import('./types.js').CoastalNode[]} coastalNodes
 * @property {import('./types.js').HydrologyPipelineStats | null} hydrologyStats
 * @property {import('./hydrology/hydrologySubsteps.js').HydrologySubstepTiming[] | null} hydrologySubstepTimings
 * @property {Uint8Array | null} riverNetworkMask
 * @property {Uint8Array | null} riverCorridorMask
 * @property {Int16Array | null} flowDirection
 * @property {Float32Array | null} channelWidth
 * @property {Float32Array | null} [arableRaster]
 * @property {import('./types.js').SaltNode[] | null} [saltNodes]
 * @property {import('./types.js').MetalNode[] | null} [metalNodes]
 */

/**
 * @typedef {Object} LandmassPipelineStageContract
 * @property {LandmassPipelineStepId} id
 * @property {string} label
 * @property {readonly string[]} inputKeys
 * @property {readonly string[]} outputKeys
 */

/** @type {Record<LandmassPipelineStepId, LandmassPipelineStageContract>} */
export const LANDMASS_PIPELINE_STAGE_CONTRACTS = {
  physicalTerrainBaseline: {
    id: 'physicalTerrainBaseline',
    label: 'Physical terrain baseline',
    inputKeys: ['geographySeed', 'prevailingWindDegrees', 'options', 'width', 'height'],
    outputKeys: ['baselineDoc', 'fields', 'biomes', 'lastCompletedStep'],
  },
  erosion: {
    id: 'erosion',
    label: 'Erosion',
    inputKeys: ['geographySeed', 'prevailingWindDegrees', 'options', 'width', 'height', 'baselineDoc'],
    outputKeys: [
      'erodedElevation',
      'erosionSnapshots',
      'erosionStepCount',
      'workingElevation',
      'fields',
      'biomes',
      'lastCompletedStep',
    ],
  },
  hydrology: {
    id: 'hydrology',
    label: 'Hydrology',
    inputKeys: [
      'geographySeed',
      'prevailingWindDegrees',
      'options',
      'width',
      'height',
      'baselineDoc',
      'erodedElevation',
      'fields',
    ],
    outputKeys: [
      'lakeMask',
      'lakes',
      'lakeMeta',
      'lakeIdByCell',
      'hydrologyStats',
      'workingElevation',
      'riverGraph',
      'riverNetworkMask',
      'riverCorridorMask',
      'channelWidth',
      'flowDirection',
      'fields',
      'biomes',
      'hydrologySubstepTimings',
      'lastCompletedStep',
    ],
  },
  fieldRefresh: {
    id: 'fieldRefresh',
    label: 'Climate field refresh',
    inputKeys: [
      'geographySeed',
      'prevailingWindDegrees',
      'options',
      'width',
      'height',
      'workingElevation',
      'lakeMask',
      'riverNetworkMask',
      'fields',
      'riverCorridorMask',
      'flowDirection',
    ],
    outputKeys: ['fields', 'biomes', 'lastCompletedStep'],
  },
  coastAndResources: {
    id: 'coastAndResources',
    label: 'Coast and resources',
    inputKeys: [
      'geographySeed',
      'options',
      'width',
      'height',
      'workingElevation',
      'fields',
      'riverGraph',
      'biomes',
      'lakes',
      'riverCorridorMask',
      'riverNetworkMask',
      'channelWidth',
    ],
    outputKeys: [
      'coastNavigability',
      'coastalNodes',
      'saltNodes',
      'arableRaster',
      'metalsRaster',
      'metalNodes',
      'timberRaster',
      'lastCompletedStep',
    ],
  },
  validation: {
    id: 'validation',
    label: 'Geography validation',
    inputKeys: [
      'prevailingWindDegrees',
      'options',
      'width',
      'height',
      'erosionStepCount',
      'fields',
      'biomes',
      'riverGraph',
      'coastalNodes',
      'hydrologyStats',
      'hydrologySubstepTimings',
      'riverNetworkMask',
      'riverCorridorMask',
      'flowDirection',
      'channelWidth',
      'arableRaster',
      'saltNodes',
      'metalNodes',
    ],
    outputKeys: ['generationReport', 'lastCompletedStep'],
  },
}

/**
 * @param {DerivedGeographyPipelineState} state
 * @returns {LandmassPipelineParams}
 */
export function pickLandmassPipelineParams(state) {
  return {
    geographySeed: state.geographySeed,
    prevailingWindDegrees: state.prevailingWindDegrees,
    options: state.options,
    width: state.width,
    height: state.height,
  }
}

/**
 * @param {LandmassPipelineStepId} stepId
 * @param {DerivedGeographyPipelineState} state
 * @returns {Record<string, unknown>}
 */
export function pickLandmassStageInput(stepId, state) {
  switch (stepId) {
    case 'physicalTerrainBaseline':
      return pickPhysicalTerrainBaselineInput(state)
    case 'erosion':
      return pickErosionStageInput(state)
    case 'hydrology':
      return pickHydrologyStageInput(state)
    case 'fieldRefresh':
      return pickFieldRefreshStageInput(state)
    case 'coastAndResources':
      return pickCoastAndResourcesStageInput(state)
    case 'validation':
      return pickValidationStageInput(state)
    default:
      throw new Error(`Unknown landmass pipeline step: ${stepId}`)
  }
}

/**
 * @param {DerivedGeographyPipelineState} state
 * @returns {PhysicalTerrainBaselineStageInput}
 */
function pickPhysicalTerrainBaselineInput(state) {
  return pickLandmassPipelineParams(state)
}

/**
 * @param {DerivedGeographyPipelineState} state
 * @returns {ErosionStageInput}
 */
function pickErosionStageInput(state) {
  if (state.lastCompletedStep !== 'physicalTerrainBaseline') {
    throw new Error('physicalTerrainBaseline required before erosion')
  }
  if (!state.baselineDoc) {
    throw new Error('physicalTerrainBaseline baselineDoc required before erosion')
  }
  return {
    geographySeed: state.geographySeed,
    prevailingWindDegrees: state.prevailingWindDegrees,
    options: state.options,
    width: state.width,
    height: state.height,
    baselineDoc: state.baselineDoc,
  }
}

/**
 * @param {DerivedGeographyPipelineState} state
 * @returns {HydrologyStageInput}
 */
function pickHydrologyStageInput(state) {
  if (state.lastCompletedStep !== 'erosion') {
    throw new Error('erosion required before hydrology')
  }
  if (!state.baselineDoc) {
    throw new Error('physicalTerrainBaseline baselineDoc required before hydrology')
  }
  if (!state.erodedElevation) {
    throw new Error('erosion erodedElevation required before hydrology')
  }
  return {
    geographySeed: state.geographySeed,
    prevailingWindDegrees: state.prevailingWindDegrees,
    options: state.options,
    width: state.width,
    height: state.height,
    baselineDoc: state.baselineDoc,
    erodedElevation: state.erodedElevation,
    fields: state.fields,
  }
}

/**
 * @param {DerivedGeographyPipelineState} state
 * @returns {FieldRefreshStageInput}
 */
function pickFieldRefreshStageInput(state) {
  if (state.lastCompletedStep !== 'hydrology') {
    throw new Error('hydrology required before fieldRefresh')
  }
  if (!state.workingElevation || !state.lakeMask || !state.riverNetworkMask) {
    throw new Error('hydrology outputs required before fieldRefresh')
  }
  const drainage = state.fields?.drainage
  if (!drainage) {
    throw new Error('hydrology fields.drainage required before fieldRefresh')
  }
  return {
    geographySeed: state.geographySeed,
    prevailingWindDegrees: state.prevailingWindDegrees,
    options: state.options,
    width: state.width,
    height: state.height,
    workingElevation: state.workingElevation,
    lakeMask: state.lakeMask,
    riverNetworkMask: state.riverNetworkMask,
    fields: state.fields,
    riverCorridorMask: state.riverCorridorMask,
    flowDirection: state.flowDirection,
  }
}

/**
 * @param {DerivedGeographyPipelineState} state
 * @returns {CoastAndResourcesStageInput}
 */
function pickCoastAndResourcesStageInput(state) {
  if (state.lastCompletedStep !== 'fieldRefresh') {
    throw new Error('fieldRefresh required before coastAndResources')
  }
  if (!state.workingElevation || !state.fields || !state.riverGraph || !state.biomes) {
    throw new Error('fieldRefresh outputs required before coastAndResources')
  }
  return {
    geographySeed: state.geographySeed,
    options: state.options,
    width: state.width,
    height: state.height,
    workingElevation: state.workingElevation,
    fields: state.fields,
    riverGraph: state.riverGraph,
    biomes: state.biomes,
    lakes: state.lakes ?? [],
    riverCorridorMask: state.riverCorridorMask,
    riverNetworkMask: state.riverNetworkMask,
    channelWidth: state.channelWidth,
  }
}

/**
 * @param {DerivedGeographyPipelineState} state
 * @returns {ValidationStageInput}
 */
function pickValidationStageInput(state) {
  if (state.lastCompletedStep !== 'coastAndResources') {
    throw new Error('coastAndResources required before validation')
  }
  if (!state.fields || !state.biomes || !state.riverGraph || !state.coastalNodes) {
    throw new Error('coastAndResources outputs required before validation')
  }
  return {
    prevailingWindDegrees: state.prevailingWindDegrees,
    options: state.options,
    width: state.width,
    height: state.height,
    erosionStepCount: state.erosionStepCount,
    fields: state.fields,
    biomes: state.biomes,
    riverGraph: state.riverGraph,
    coastalNodes: state.coastalNodes,
    hydrologyStats: state.hydrologyStats,
    hydrologySubstepTimings: state.hydrologySubstepTimings,
    riverNetworkMask: state.riverNetworkMask,
    riverCorridorMask: state.riverCorridorMask,
    flowDirection: state.flowDirection,
    channelWidth: state.channelWidth,
    arableRaster: state.arableRaster,
    saltNodes: state.saltNodes,
    metalNodes: state.metalNodes,
  }
}

/**
 * @param {LandmassPipelineStepId} stepId
 * @param {Record<string, unknown>} output
 */
export function assertLandmassStageOutputs(stepId, output) {
  const contract = LANDMASS_PIPELINE_STAGE_CONTRACTS[stepId]
  for (const key of contract.outputKeys) {
    if (output[key] === null || output[key] === undefined) {
      throw new Error(`${stepId} missing output ${key}`)
    }
  }
}

/**
 * @param {HydrologyStageInput} input
 * @returns {DerivedGeographyPipelineState}
 */
export function buildPipelineStateForHydrologySubsteps(input) {
  return {
    geographySeed: input.geographySeed,
    prevailingWindDegrees: input.prevailingWindDegrees,
    options: input.options,
    width: input.width,
    height: input.height,
    baselineDoc: input.baselineDoc,
    erodedElevation: input.erodedElevation,
    fields: input.fields,
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
    lastCompletedStep: 'erosion',
  }
}
