import { generatePhysicalTerrainBaseline } from '../generatePhysicalTerrainBaseline.js'

/** @typedef {import('./moduleTypes.js').LandmassStageModule} LandmassStageModule */

/** @type {LandmassStageModule} */
export const physicalTerrainBaselineStage = {
  id: 'physicalTerrainBaseline',
  label: 'Physical terrain baseline',
  inputs: {
    geographySeed: (state) => state.geographySeed,
    prevailingWindDegrees: (state) => state.prevailingWindDegrees,
    options: (state) => state.options,
    width: (state) => state.width,
    height: (state) => state.height,
  },
  outputKeys: ['baselineDoc', 'fields', 'biomes', 'lastCompletedStep'],
  run(input) {
    const {
      geographySeed,
      prevailingWindDegrees,
      options,
      width,
      height,
    } = input
    const baselineDoc = generatePhysicalTerrainBaseline({
      geographySeed,
      prevailingWindDegrees,
      width,
      height,
      options,
    })
    return {
      baselineDoc,
      fields: baselineDoc.fields,
      biomes: baselineDoc.biomes,
      lastCompletedStep: /** @type {const} */ ('physicalTerrainBaseline'),
    }
  },
}
