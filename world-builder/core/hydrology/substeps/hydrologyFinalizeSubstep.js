import { classifyBiomesWithHydrology } from '../../classifyBiomesFromFields.js'
import { refreshClimateScalarsAfterElevationMutation } from '../../fields/refreshClimateScalarsAfterElevationMutation.js'
import { isThenable } from '../../asyncValue.js'
import { getRiverMaskStage } from '../riverMaskLifecycle.js'

/** @typedef {import('./moduleTypes.js').HydrologySubstepModule} HydrologySubstepModule */

/** @type {HydrologySubstepModule} */
export const hydrologyFinalizeSubstep = {
  id: 'hydrologyFinalize',
  label: 'Finalize fields',
  inputs: {
    state: (world) => world.state,
    width: (world) => world.width,
    height: (world) => world.height,
    settledElevation: (world) => world.settledElevation,
    settledDrainage: (world) => world.settledDrainage,
    lakeMask: (world) => world.lakeMask,
    settledFlowDirection: (world) => world.settledFlowDirection,
  },
  outputKeys: ['fields', 'biomes'],
  run(input, { riverMaskPipeline, onProgress, yield: yieldFn }) {
    const {
      state,
      width,
      height,
      settledElevation,
      settledDrainage,
      lakeMask,
      settledFlowDirection,
    } = input

    const fieldsResult = refreshClimateScalarsAfterElevationMutation({
      geographySeed: state.geographySeed,
      prevailingWindDegrees: state.prevailingWindDegrees,
      secondaryMaximumDegrees: state.secondaryMaximumDegrees,
      elevation: settledElevation,
      drainage: settledDrainage,
      width,
      height,
      options: state.options,
      onProgress: (progress) => onProgress(progress * 0.92),
      yield: yieldFn,
    })

    const finish = (previewFields) => {
      onProgress(0.95)
      const biomes = classifyBiomesWithHydrology(
        previewFields,
        width,
        height,
        {
          lakeMask,
          riverCorridorMask: getRiverMaskStage(riverMaskPipeline, 'painted'),
          flowDirection: settledFlowDirection,
        },
        state.options.seaLevel,
        state.geographySeed,
        state.options.biomeEdgeNoiseStrength,
      )
      onProgress(1)
      return { fields: previewFields, biomes }
    }

    if (isThenable(fieldsResult)) {
      return fieldsResult.then(finish)
    }
    return finish(fieldsResult)
  },
}
