import { buildDisplayBiomes } from './buildDisplayBiomes.js'
import { BIOMES_CATALOG } from './biomeCatalog.js'
import { classifyBiomesFromFields } from './classifyBiomesFromFields.js'
import { PIPELINE_STAGE_DERIVED_GEOGRAPHY, PIPELINE_STAGE_PHYSICAL_TERRAIN_BASELINE } from './types.js'
/** @typedef {import('./landmassPipelineTypes.js').DerivedGeographyPipelineState} DerivedGeographyPipelineState */

/**
 * @param {DerivedGeographyPipelineState} state
 * @returns {import('./types.js').WorldDocument}
 */
export function buildWorldDocumentFromPipelineState(state) {
  const { width, height, geographySeed, prevailingWindDegrees } = state
  const baseline = state.baselineDoc
  if (!baseline) throw new Error('Pipeline state missing baseline document')

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
  const displayBiomes = buildDisplayBiomes(biomes, fields, state.options.seaLevel)

  return {
    geographySeed,
    prevailingWindDegrees,
    gridWidth: width,
    gridHeight: height,
    fields,
    biomes,
    displayBiomes,
    biomeCatalog: BIOMES_CATALOG,
    generatedAt: baseline.generatedAt,
    pipelineStage: isComplete
      ? PIPELINE_STAGE_DERIVED_GEOGRAPHY
      : PIPELINE_STAGE_PHYSICAL_TERRAIN_BASELINE,
    riverGraph: state.riverGraph ?? undefined,
    lakes: state.lakes ?? undefined,
    lakeMeta: state.lakeMeta ?? undefined,
    lakeMask: state.lakeMask ?? undefined,
    simulationRiverMask: state.simulationRiverMask ?? undefined,
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
