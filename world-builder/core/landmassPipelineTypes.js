/** @typedef {typeof LANDMASS_PIPELINE_STEP_IDS[number]} LandmassPipelineStepId */
/** @typedef {LandmassPipelineStepId} DerivedGeographyStepId */

/** @type {readonly LandmassPipelineStepId[]} */
export const LANDMASS_PIPELINE_STEP_IDS = [
  'physicalTerrainBaseline',
  'erosion',
  'hydrology',
  'fieldRefresh',
  'coastAndResources',
  'validation',
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
 * @property {LandmassPipelineStepId | null} lastCompletedStep
 */

/**
 * @typedef {'success' | 'exhausted' | 'cancelled' | 'error'} LandmassPipelineRunStatus
 */

/**
 * @typedef {Object} PipelineStepOptions
 * @property {(payload: { substepId: string, substepIndex: number, substepCount: number, label: string }) => void} [onSubstepStart]
 * @property {(payload: { substepId: string, substepIndex: number, substepCount: number, label: string, progress: number }) => void} [onSubstepProgress]
 * @property {(payload: { substepId: string, substepIndex: number, substepCount: number, label: string, progress: number }) => void} [onSubstepComplete]
 * @property {(payload: { substepId: string, substepIndex: number, substepCount: number, label: string, input: Record<string, unknown> }) => void} [onSubstepPrepare]
 * @property {() => boolean} [shouldCancel]
 */

export class LandmassPipelineCancelledError extends Error {
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
 * @param {unknown} error
 * @returns {error is LandmassPipelineCancelledError}
 */
export function isLandmassPipelineCancelledError(error) {
  return error instanceof LandmassPipelineCancelledError
}
