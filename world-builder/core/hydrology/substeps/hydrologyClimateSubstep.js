import { refreshFieldsAfterErosion } from '../../fields/refreshFieldsAfterErosion.js'
import {
  deriveSnowCapMask,
  deriveSnowMeltContribution,
} from '../deriveSnowCapMask.js'
import { baselineDrainageFromState } from '../baselineDrainageFromState.js'

/** @typedef {import('./moduleTypes.js').HydrologySubstepModule} HydrologySubstepModule */

/**
 * Prefer post-erosion climate fields when they were already computed on the same
 * erodedElevation buffer (erosion stage). Avoids a duplicate generateRainfall.
 * @param {import('../../types.js').ScalarFields | null | undefined} previewFields
 * @param {Float32Array} erodedElevation
 * @returns {boolean}
 */
function canReuseErosionClimate(previewFields, erodedElevation) {
  return Boolean(
    previewFields &&
      previewFields.elevation === erodedElevation &&
      previewFields.temperature instanceof Float32Array &&
      previewFields.rainfall instanceof Float32Array,
  )
}

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
    previewFields: (world) => world.state.fields,
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
    previewFields,
  }) {
    let temperature
    let rainfall
    if (canReuseErosionClimate(previewFields, erodedElevation)) {
      temperature = previewFields.temperature
      rainfall = previewFields.rainfall
    } else {
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
      temperature = climateFields.temperature
      rainfall = climateFields.rainfall
    }
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
