import { buildGenerationReport } from '../buildGenerationReport.js'
import { assembleRiverNetworkFromFields } from '../hydrology/riverNetwork.js'

/** @typedef {import('./moduleTypes.js').LandmassStageModule} LandmassStageModule */

/** @type {LandmassStageModule} */
export const validationStage = {
  id: 'validation',
  label: 'Geography validation',
  inputs: {
    prevailingWindDegrees: (state) => state.prevailingWindDegrees,
    options: (state) => state.options,
    width: (state) => state.width,
    height: (state) => state.height,
    erosionStepCount: (state) => state.erosionStepCount,
    fields: (state) => {
      if (state.lastCompletedStep !== 'coastAndResources') {
        throw new Error('coastAndResources required before validation')
      }
      if (!state.fields || !state.biomes || !state.riverGraph || !state.coastalNodes) {
        throw new Error('coastAndResources outputs required before validation')
      }
      return state.fields
    },
    biomes: (state) => {
      if (!state.biomes) {
        throw new Error('coastAndResources outputs required before validation')
      }
      return state.biomes
    },
    riverGraph: (state) => {
      if (!state.riverGraph) {
        throw new Error('coastAndResources outputs required before validation')
      }
      return state.riverGraph
    },
    coastalNodes: (state) => {
      if (!state.coastalNodes) {
        throw new Error('coastAndResources outputs required before validation')
      }
      return state.coastalNodes
    },
    hydrologyStats: (state) => state.hydrologyStats,
    hydrologySubstepTimings: (state) => state.hydrologySubstepTimings,
    simulationRiverMask: (state) => state.simulationRiverMask,
    riverNetworkMask: (state) => state.riverNetworkMask,
    riverCorridorMask: (state) => state.riverCorridorMask,
    flowDirection: (state) => state.flowDirection,
    channelWidth: (state) => state.channelWidth,
    arableRaster: (state) => state.arableRaster,
    saltNodes: (state) => state.saltNodes,
    metalNodes: (state) => state.metalNodes,
  },
  outputKeys: ['generationReport', 'lastCompletedStep'],
  run(input) {
    const {
      prevailingWindDegrees,
      options,
      width,
      height,
      erosionStepCount,
      fields,
      biomes,
      riverGraph,
      coastalNodes,
      hydrologyStats,
      hydrologySubstepTimings,
      simulationRiverMask,
      riverNetworkMask,
      riverCorridorMask,
      flowDirection,
      channelWidth,
      arableRaster,
      saltNodes,
      metalNodes,
    } = input
    const riverNetwork = assembleRiverNetworkFromFields({
      riverNetworkMask,
      riverCorridorMask,
      simulationRiverMask: simulationRiverMask ?? undefined,
      flowDirection,
      flowAccumulation: fields.drainage,
      channelWidth: channelWidth ?? undefined,
      riverGraph,
      width,
      height,
    })
    const generationReport = buildGenerationReport({
      erosionStepCount,
      riverGraph,
      riverNetwork,
      coastalNodes,
      fields,
      biomes,
      gridWidth: width,
      gridHeight: height,
      hydrologySubstepTimings: hydrologySubstepTimings ?? [],
      hydrologyStats: hydrologyStats ?? {
        breachCount: 0,
        endorheicCount: 0,
        endorheicFraction: 0,
        lakeCount: 0,
      },
      prevailingWindDegrees,
      validationOptions: options,
      arableRaster: arableRaster ?? undefined,
      saltNodes: saltNodes ?? undefined,
      metalNodes: metalNodes ?? undefined,
    })
    return {
      generationReport,
      lastCompletedStep: /** @type {const} */ ('validation'),
    }
  },
}
