import {
  classifyBiomesFromFields,
} from '../classifyBiomesFromFields.js'
import { applyErosion } from '../erosion/applyErosion.js'
import { refreshClimateScalarsAfterElevationMutation } from '../fields/refreshClimateScalarsAfterElevationMutation.js'

/** @typedef {import('./moduleTypes.js').LandmassStageModule} LandmassStageModule */

/** @type {LandmassStageModule} */
export const erosionStage = {
  id: 'erosion',
  label: 'Erosion',
  inputs: {
    geographySeed: (state) => state.geographySeed,
    prevailingWindDegrees: (state) => state.prevailingWindDegrees,
    options: (state) => state.options,
    width: (state) => state.width,
    height: (state) => state.height,
    baselineDoc: (state) => {
      if (state.lastCompletedStep !== 'physicalTerrainBaseline') {
        throw new Error('physicalTerrainBaseline required before erosion')
      }
      if (!state.baselineDoc) {
        throw new Error('physicalTerrainBaseline baselineDoc required before erosion')
      }
      return state.baselineDoc
    },
  },
  outputKeys: [
    'erodedElevation',
    'erosionSnapshots',
    'erosionStepCount',
    'workingElevation',
    'fields',
    'biomes',
    'lastCompletedStep',
  ],
  run(input) {
    const {
      geographySeed,
      prevailingWindDegrees,
      options,
      width,
      height,
      baselineDoc,
    } = input
    const { elevation: erodedElevation, snapshots, stepCount } = applyErosion({
      elevation: baselineDoc.fields.elevation,
      width,
      height,
      geographySeed,
      options,
    })
    const previewFields = refreshClimateScalarsAfterElevationMutation({
      geographySeed,
      prevailingWindDegrees,
      elevation: erodedElevation,
      drainage: baselineDoc.fields.drainage,
      width,
      height,
      options,
    })
    return {
      erodedElevation,
      erosionSnapshots: snapshots,
      erosionStepCount: stepCount,
      workingElevation: erodedElevation,
      fields: previewFields,
      biomes: classifyBiomesFromFields(
        previewFields,
        width,
        height,
        options.seaLevel,
        geographySeed,
        options.biomeEdgeNoiseStrength,
      ),
      lastCompletedStep: /** @type {const} */ ('erosion'),
    }
  },
}
