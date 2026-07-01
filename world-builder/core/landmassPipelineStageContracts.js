/** @typedef {import('./landmassPipelineTypes.js').DerivedGeographyPipelineState} DerivedGeographyPipelineState */
/** @typedef {import('./landmassPipelineTypes.js').LandmassPipelineStepId} LandmassPipelineStepId */

import {
  LANDMASS_PIPELINE_STEP_IDS,
} from './landmassPipelineTypes.js'
import {
  LANDMASS_PIPELINE_STAGE_MODULES,
  LANDMASS_PIPELINE_STAGE_MODULE_BY_ID,
} from './landmassPipelineStageModules.js'
import { selectLandmassStageInput } from './stages/moduleTypes.js'

export { LANDMASS_PIPELINE_STEP_IDS }

/**
 * @typedef {Object} LandmassPipelineStageContract
 * @property {LandmassPipelineStepId} id
 * @property {string} label
 * @property {readonly string[]} inputKeys
 * @property {readonly string[]} outputKeys
 */

/** @typedef {import('./landmassPipelineStageModules.js').LandmassStageModule} LandmassStageModule */

/**
 * @param {LandmassStageModule} module
 * @returns {LandmassPipelineStageContract}
 */
export function deriveLandmassStageContract(module) {
  return {
    id: module.id,
    label: module.label,
    inputKeys: Object.keys(module.inputs),
    outputKeys: [...module.outputKeys],
  }
}

/** @type {Record<LandmassPipelineStepId, LandmassPipelineStageContract>} */
export const LANDMASS_PIPELINE_STAGE_CONTRACTS = Object.fromEntries(
  LANDMASS_PIPELINE_STAGE_MODULES.map((module) => [
    module.id,
    deriveLandmassStageContract(module),
  ]),
)

/**
 * @param {LandmassPipelineStepId} stepId
 * @param {DerivedGeographyPipelineState} state
 * @returns {Record<string, unknown>}
 */
export function pickLandmassStageInput(stepId, state) {
  const module = LANDMASS_PIPELINE_STAGE_MODULE_BY_ID[stepId]
  if (!module) {
    throw new Error(`Unknown landmass pipeline step: ${stepId}`)
  }
  return selectLandmassStageInput(module, state)
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
 * @param {Record<string, unknown>} input
 * @returns {DerivedGeographyPipelineState}
 */
export function buildPipelineStateForHydrologySubsteps(input) {
  return {
    geographySeed: /** @type {number} */ (input.geographySeed),
    prevailingWindDegrees: /** @type {number} */ (input.prevailingWindDegrees),
    options: /** @type {import('./types.js').WorldGenerationOptions} */ (input.options),
    width: /** @type {number} */ (input.width),
    height: /** @type {number} */ (input.height),
    baselineDoc: /** @type {import('./types.js').WorldDocument} */ (input.baselineDoc),
    erodedElevation: /** @type {Float32Array} */ (input.erodedElevation),
    fields: /** @type {import('./types.js').ScalarFields | null} */ (input.fields),
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
