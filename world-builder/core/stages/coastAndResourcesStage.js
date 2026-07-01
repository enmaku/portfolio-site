import { computeCoastNavigability } from '../coast/computeCoastNavigability.js'
import { deriveCoastalNodes } from '../coast/deriveCoastalNodes.js'
import { generateArableRaster } from '../resources/generateArableRaster.js'
import { generateTimberProductivity } from '../resources/generateTimberProductivity.js'
import { computeMetalsRaster } from '../resources/computeMetalsRaster.js'
import { placeMetalNodes } from '../resources/placeMetalNodes.js'
import { placeSaltNodes } from '../resources/placeSaltNodes.js'

/** @typedef {import('./moduleTypes.js').LandmassStageModule} LandmassStageModule */

/** @type {LandmassStageModule} */
export const coastAndResourcesStage = {
  id: 'coastAndResources',
  label: 'Coast and resources',
  inputs: {
    geographySeed: (state) => state.geographySeed,
    options: (state) => state.options,
    width: (state) => state.width,
    height: (state) => state.height,
    workingElevation: (state) => {
      if (state.lastCompletedStep !== 'fieldRefresh') {
        throw new Error('fieldRefresh required before coastAndResources')
      }
      if (!state.workingElevation || !state.fields || !state.riverGraph || !state.biomes) {
        throw new Error('fieldRefresh outputs required before coastAndResources')
      }
      return state.workingElevation
    },
    fields: (state) => {
      if (!state.fields) {
        throw new Error('fieldRefresh outputs required before coastAndResources')
      }
      return state.fields
    },
    riverGraph: (state) => {
      if (!state.riverGraph) {
        throw new Error('fieldRefresh outputs required before coastAndResources')
      }
      return state.riverGraph
    },
    biomes: (state) => {
      if (!state.biomes) {
        throw new Error('fieldRefresh outputs required before coastAndResources')
      }
      return state.biomes
    },
    lakes: (state) => state.lakes ?? [],
    riverCorridorMask: (state) => state.riverCorridorMask,
    riverNetworkMask: (state) => state.riverNetworkMask,
    channelWidth: (state) => state.channelWidth,
  },
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
  run(input) {
    const {
      geographySeed,
      options,
      width,
      height,
      workingElevation,
      fields,
      riverGraph,
      biomes,
      lakes,
      riverCorridorMask,
      riverNetworkMask,
      channelWidth,
    } = input
    const coastNavigability = computeCoastNavigability({
      elevation: workingElevation,
      width,
      height,
      seaLevel: options.seaLevel,
    })
    const coastalNodes = deriveCoastalNodes({
      riverGraph,
      coastNavigability,
      elevation: workingElevation,
      width,
      height,
      seaLevel: options.seaLevel,
    })
    const saltNodes = placeSaltNodes({
      elevation: workingElevation,
      salinity: fields.salinity,
      biomes,
      lakes,
      width,
      height,
      geographySeed,
      maxNodes: options.maxSaltNodes,
      seaLevel: options.seaLevel,
    })
    const arableRaster = generateArableRaster({
      elevation: workingElevation,
      temperature: fields.temperature,
      rainfall: fields.rainfall,
      drainage: fields.drainage,
      biomes,
      riverCorridorMask: riverCorridorMask ?? riverNetworkMask,
      riverNetworkMask: riverNetworkMask ?? undefined,
      channelWidth: channelWidth ?? undefined,
      width,
      height,
      geographySeed,
      seaLevel: options.seaLevel,
      minimumProductivity: options.arableMinimumProductivity,
    })
    const metalsRaster = computeMetalsRaster({
      elevation: workingElevation,
      biomes,
      drainage: fields.drainage,
      riverNetworkMask: riverNetworkMask ?? undefined,
      width,
      height,
      seaLevel: options.seaLevel,
    })
    const metalNodes = placeMetalNodes({
      metalsRaster,
      elevation: workingElevation,
      width,
      height,
      geographySeed,
      maxNodes: options.maxMetalNodes,
      seaLevel: options.seaLevel,
    })
    const timberRaster = generateTimberProductivity({
      fields,
      biomes,
      width,
      height,
      geographySeed,
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
  },
}
