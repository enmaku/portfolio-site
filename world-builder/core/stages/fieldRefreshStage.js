import { classifyBiomesWithHydrology } from '../classifyBiomesFromFields.js'
import { deriveAnnualMeanClimate } from '../hydrology/seasonalClimatology.js'

/** @typedef {import('./moduleTypes.js').LandmassStageModule} LandmassStageModule */

/** @type {LandmassStageModule} */
export const fieldRefreshStage = {
  id: 'fieldRefresh',
  label: 'Seasonal climate annualization',
  inputs: {
    geographySeed: (state) => state.geographySeed,
    options: (state) => state.options,
    width: (state) => state.width,
    height: (state) => state.height,
    lakeMask: (state) => {
      if (state.lastCompletedStep !== 'hydrology') {
        throw new Error('hydrology required before fieldRefresh')
      }
      if (!state.workingElevation || !state.lakeMask || !state.riverNetworkMask) {
        throw new Error('hydrology outputs required before fieldRefresh')
      }
      return state.lakeMask
    },
    riverNetworkMask: (state) => {
      if (!state.riverNetworkMask) {
        throw new Error('hydrology outputs required before fieldRefresh')
      }
      return state.riverNetworkMask
    },
    fields: (state) => {
      if (!state.fields?.drainage) {
        throw new Error('hydrology fields.drainage required before fieldRefresh')
      }
      return state.fields
    },
    biomes: (state) => {
      if (!state.biomes) {
        throw new Error('hydrology biomes required before fieldRefresh')
      }
      return state.biomes
    },
    riverCorridorMask: (state) => state.riverCorridorMask,
    flowDirection: (state) => state.flowDirection,
  },
  outputKeys: ['fields', 'biomes', 'lastCompletedStep'],
  shouldSkip: (state) => !state.options.enableSeasonalHydrology,
  runSkipped(input) {
    const { fields, biomes } = input
    return {
      fields,
      biomes,
      lastCompletedStep: /** @type {const} */ ('fieldRefresh'),
    }
  },
  run(input) {
    const {
      geographySeed,
      options,
      width,
      height,
      lakeMask,
      riverNetworkMask,
      fields,
      riverCorridorMask,
      flowDirection,
    } = input
    const annualClimate = deriveAnnualMeanClimate({
      baseRainfall: fields.rainfall,
      baseTemperature: fields.temperature,
      options,
    })
    const nextFields = {
      ...fields,
      rainfall: annualClimate.rainfall,
      temperature: annualClimate.temperature,
    }
    const nextBiomes = classifyBiomesWithHydrology(
      nextFields,
      width,
      height,
      {
        lakeMask,
        riverCorridorMask: riverCorridorMask ?? riverNetworkMask,
        flowDirection,
      },
      options.seaLevel,
      geographySeed,
      options.biomeEdgeNoiseStrength,
    )
    return {
      fields: nextFields,
      biomes: nextBiomes,
      lastCompletedStep: /** @type {const} */ ('fieldRefresh'),
    }
  },
}
