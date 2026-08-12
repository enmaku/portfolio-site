import { generatePhysicalTerrainBaseline } from '../generatePhysicalTerrainBaseline.js'
import { isThenable } from '../asyncValue.js'

/** @typedef {import('./moduleTypes.js').LandmassStageModule} LandmassStageModule */

/** @type {LandmassStageModule} */
export const physicalTerrainBaselineStage = {
  id: 'physicalTerrainBaseline',
  label: 'Physical terrain baseline',
  inputs: {
    geographySeed: (state) => state.geographySeed,
    prevailingWindDegrees: (state) => state.prevailingWindDegrees,
    secondaryMaximumDegrees: (state) => state.secondaryMaximumDegrees,
    options: (state) => state.options,
    width: (state) => state.width,
    height: (state) => state.height,
  },
  outputKeys: ['baselineDoc', 'fields', 'biomes', 'lastCompletedStep'],
  run(input, options = {}) {
    const {
      geographySeed,
      prevailingWindDegrees,
      secondaryMaximumDegrees,
      options: generationOptions,
      width,
      height,
    } = input
    const baselineResult = generatePhysicalTerrainBaseline(
      {
        geographySeed,
        prevailingWindDegrees,
        secondaryMaximumDegrees,
        width,
        height,
        options: generationOptions,
      },
      options,
    )

    const finish = (baselineDoc) => ({
      baselineDoc,
      fields: baselineDoc.fields,
      biomes: baselineDoc.biomes,
      lastCompletedStep: /** @type {const} */ ('physicalTerrainBaseline'),
    })

    if (isThenable(baselineResult)) {
      return baselineResult.then(finish)
    }
    return finish(baselineResult)
  },
}
