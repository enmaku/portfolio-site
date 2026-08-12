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
 * @property {number} secondaryMaximumDegrees
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
 * @property {Uint8Array | null} simulationRiverMask
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
 * @property {(payload: { substepId: string, substepIndex: number, substepCount: number, label: string, parentStepId?: string }) => void} [onSubstepStart]
 * @property {(payload: { substepId: string, substepIndex: number, substepCount: number, label: string, progress: number, parentStepId?: string, worldDocument?: import('./types.js').WorldDocument | null }) => void} [onSubstepProgress]
 * @property {(payload: { substepId: string, substepIndex: number, substepCount: number, label: string, progress: number, skipped?: boolean, parentStepId?: string, worldDocument?: import('./types.js').WorldDocument | null, maskLifecycle?: unknown }) => void} [onSubstepComplete]
 * @property {(payload: { substepId: string, substepIndex: number, substepCount: number, label: string, input: Record<string, unknown>, parentStepId?: string }) => void} [onSubstepPrepare]
 * @property {() => boolean | Promise<boolean>} [shouldCancel]
 * @property {() => void | Promise<void>} [yield]
 * @property {(payload: { substepId: string, world: Object, riverMaskPipeline: Object }) => import('./types.js').WorldDocument | null | undefined | Promise<import('./types.js').WorldDocument | null | undefined>} [buildSubstepPreview]
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
