import { refreshFieldsAfterErosion } from '../../fields/refreshFieldsAfterErosion.js'
import {
  deriveSnowCapMask,
  deriveSnowMeltContribution,
} from '../deriveSnowCapMask.js'
import { baselineDrainageFromState } from '../baselineDrainageFromState.js'

/** @typedef {import('./moduleTypes.js').HydrologySubstepModule} HydrologySubstepModule */

/** @type {HydrologySubstepModule} */
export const hydrologyClimateSubstep = {
  id: 'hydrologyClimate',
  label: 'Climate refresh',
  inputs: {
    geographySeed: (world) => world.state.geographySeed,
    prevailingWindDegrees: (world) => world.state.prevailingWindDegrees,
    secondaryMaximumDegrees: (world) => world.state.secondaryMaximumDegrees,
    options: (world) => world.state.options,
    width: (world) => world.width,
    height: (world) => world.height,
    erodedElevation: (world) => world.state.erodedElevation,
    baselineDrainage: (world) => baselineDrainageFromState(world.state),
  },
  outputKeys: ['temperature', 'rainfall', 'snowCapMask', 'meltContribution'],
  run({
    geographySeed,
    prevailingWindDegrees,
    secondaryMaximumDegrees,
    options,
    width,
    height,
    erodedElevation,
    baselineDrainage,
  }) {
    const climateFields = refreshFieldsAfterErosion({
      geographySeed,
      prevailingWindDegrees,
      secondaryMaximumDegrees,
      elevation: erodedElevation,
      drainage: baselineDrainage,
      width,
      height,
      options,
    })
    const { temperature, rainfall } = climateFields
    const snowCapMask = deriveSnowCapMask({
      elevation: erodedElevation,
      temperature,
      width,
      height,
      seaLevel: options.seaLevel,
    })
    const meltContribution = options.enableSeasonalHydrology
      ? new Float32Array(width * height)
      : deriveSnowMeltContribution({
          elevation: erodedElevation,
          temperature,
          snowCapMask,
          width,
          height,
          prevailingWindDegrees,
        })
    return { temperature, rainfall, snowCapMask, meltContribution }
  },
}
